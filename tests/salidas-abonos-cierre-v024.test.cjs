'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail));
const src=original.trimEnd().slice(0,-tail.length)+
  '\nwindow.__v24={defaults,renderCheckout,renderPaymentForm,renderFinalAccountSection,cashChangeFields,updateCashPreview,processPayment,processFinalSettlement,totalOf,paidOf,dueOf,setDB:x=>{db=x;},getDB:()=>db,setUI:x=>{ui=x;},getUI:()=>ui};\n})();';
const notes=[],confirmed=[],formNodes={},storage={};
const elements={
 'toasts':{append(node){notes.push(node.textContent)}},
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},
 sidebar:{classList:{remove(){}}},year:{textContent:''},'current-date':{textContent:''}
};
const document={
 getElementById(id){return formNodes[id]||elements[id]||null},
 querySelectorAll(){return []},querySelector(){return null},
 addEventListener(){},createElement(){return {className:'',textContent:'',remove(){},append(){}}}
};
const window={scrollTo(){},confirm(message){confirmed.push(message);return true}};
class FormDataFake{constructor(form){this.data=form.data||{}}entries(){return Object.entries(this.data)}}
const sandbox={document,window,FormData:FormDataFake,localStorage:{
 getItem(key){return storage[key]||null},setItem(key,value){storage[key]=value}
},Date,Intl,Number,Math,String,Array,Object,JSON,RegExp,Map,Set,URL,Blob,setTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(src,sandbox,{timeout:5000});
const api=window.__v24;
let failures=0;
const test=(name,fn)=>{try{fn();console.log('PASS',name)}catch(e){failures++;console.error('FAIL',name,e.stack||e)}};
function base(total=10.07){
 const db=api.defaults(),room=db.rooms.find(r=>r.id==='room-01');
 room.status='ocupada';db.guests=[{id:'g-test',firstName:'HUESPED',lastName:'FICTICIO',document:'0000000000'}];
 const stay={id:'test-stay',guestId:'g-test',roomId:room.id,roomRate:total,roomTotal:total,
 arrival:'2026-11-08',departure:'2026-11-09',advance:0,payments:[],status:'activa',createdAt:'2026-11-08T12:00:00Z'};
 db.stays=[stay];api.setDB(db);api.setUI({...api.getUI(),view:'salidas',selectedStayId:stay.id,selectedHistoryStayId:null});
 for(const key of Object.keys(formNodes))delete formNodes[key];notes.length=0;confirmed.length=0;
 return {db,room,stay};
}
function feed(id,data){formNodes[id]={data,querySelector(selector){
  const field=selector.match(/^\[name=([^\]]+)\]$/)?.[1];
  if(!field)return null;
  return {value:String(data[field]??'')};
}}}
test('Salidas y cobros contiene dos operaciones plegables independientes, sin botón check-out duplicado',()=>{
 const {stay}=base(),html=api.renderCheckout();
 assert(html.includes('id="checkout-abono"'));
 assert(html.includes('Abono a la cuenta pendiente'));
 assert(html.includes('Cierre de cuenta y registrar salida'));
 assert(html.includes('id="payment-form"'));
 assert(html.includes('id="finalize-form"'));
 assert(!html.includes('Importe a aplicar a la cuenta'));
 assert(!html.includes('data-action="checkout-stay"'));
 assert(html.includes('Saldo pendiente'));
 assert(html.includes('10,07'));
});
test('En ambas operaciones aparece Valor a cobrar, Efectivo recibido y Vuelto calculado',()=>{
 base();
 for(const prefix of ['payment','final']){
  const html=api.cashChangeFields(prefix,{},10.07);
  assert(html.includes('Valor a cobrar'));
  assert(html.includes('Efectivo entregado por el huésped'));
  assert(html.includes('Vuelto calculado'));
  assert(html.includes(prefix+'-amount-preview'));
  assert(html.includes('10,07'));
 }
 assert(!api.cashChangeFields('checkin').includes('id="checkin-amount-preview"'));
});
test('Saldo fijo sin campo de abono; el efectivo recibido define el importe aplicado',()=>{
 const {stay}=base();
 const html=api.renderPaymentForm(stay);
 assert(!html.includes('id="payment-amount"'));
 assert(!html.includes('Valor del abono (USD)'));
 assert(html.includes('Valor a cobrar'));
 assert(html.includes('$10,07'));
 assert(html.includes('Efectivo entregado por el huésped'));
 assert(html.includes('Registrar pago sin cerrar cuenta'));
 assert(html.includes('sin marcar la salida'));
});
test('El vuelto se calcula contra el abono y muestra el valor a cobrar en vivo',()=>{
 base();
 const amountDisplay={textContent:''},changeDisplay={textContent:'',classList:{toggle(){}}},
 zone={classList:{toggle() {}}},choice={classList:{toggle(){}}};
 feed('payment-form',{cashTendered:'20'});
 formNodes['payment-amount-preview']=amountDisplay;
 formNodes['payment-change-preview']=changeDisplay;
 formNodes['payment-cash-zone']=zone;
 formNodes['payment-change-choice']=choice;
 api.updateCashPreview('payment-form','payment',10.07,'efectivo');
 assert(amountDisplay.textContent.includes('10,07'));
 assert(changeDisplay.textContent.includes('9,93'));
});
test('Abono de 3,01 a una cuenta de 10,07 deja saldo 7,06 y no libera habitación',()=>{
 const {stay,room}=base();
 feed('payment-form',{stayId:stay.id,method:'efectivo',shift:'dia',cashTendered:'3.01'});
 api.processPayment();
 assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].amount,3.01);
 assert.equal(stay.payments[0].cashChange,0);
 assert.equal(api.dueOf(stay),7.06);
 assert.equal(stay.status,'activa');
 assert.equal(room.status,'ocupada');
 assert.equal(confirmed.length,0);
 assert(api.renderFinalAccountSection(stay).includes('7,06'));
});
test('Cierre cobra únicamente el saldo tras el abono y manda habitación a limpieza',()=>{
 const stay=api.getDB().stays[0],room=api.getDB().rooms.find(r=>r.id===stay.roomId);
 feed('finalize-form',{stayId:stay.id,method:'efectivo',shift:'dia',cashTendered:'10',changeStatus:'dado',operator:'Recepción'});
 api.processFinalSettlement();
 assert.equal(stay.payments.length,2);
 assert.equal(stay.payments[1].amount,7.06);
 assert.equal(stay.payments[1].cashChange,2.94);
 assert.equal(stay.status,'finalizada');
 assert.equal(room.status,'limpieza');
 assert.equal(api.dueOf(stay),0);
 assert(confirmed.some(text=>text.includes('Se cobrará')));
});
test('No registra pagos sin efectivo, ni efectivo con vuelto sin confirmar si fue entregado',()=>{
 const {stay}=base();
 feed('payment-form',{stayId:stay.id,method:'efectivo',cashTendered:'20'});
 api.processPayment();assert.equal(stay.payments.length,0);
 feed('payment-form',{stayId:stay.id,method:'efectivo',cashTendered:''});
 api.processPayment();assert.equal(stay.payments.length,0);
 assert(notes.some(m=>m.includes('efectivo recibido')));
 feed('payment-form',{stayId:stay.id,method:'efectivo',cashTendered:'20',changeStatus:'dado'});
 api.processPayment();assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].amount,10.07);
 assert.equal(stay.payments[0].cashChange,9.93);
});
test('Los abonos por transferencia requieren código y dejan trazabilidad',()=>{
 const {stay,room}=base();
 feed('payment-form',{stayId:stay.id,method:'transferencia',transferAmount:'4',shift:'noche',reference:''});
 api.processPayment();assert.equal(stay.payments.length,0);
 feed('payment-form',{stayId:stay.id,method:'transferencia',transferAmount:'4',shift:'noche',reference:'REF-PRUEBA'});
 api.processPayment();
 assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].reference,'REF-PRUEBA');
 assert.equal(api.dueOf(stay),6.07);
 assert.equal(room.status,'ocupada');
});
test('Si toda la cuenta fue abonada, el cierre no vuelve a cobrar dinero',()=>{
 const {stay,room}=base();
 feed('payment-form',{stayId:stay.id,method:'efectivo',shift:'dia',cashTendered:'10.07'});
 api.processPayment();
 assert.equal(api.dueOf(stay),0);
 const html=api.renderFinalAccountSection(stay);
 assert(html.includes('La cuenta está pagada'));
 feed('finalize-form',{stayId:stay.id,operator:'Recepción',shift:'dia'});
 api.processFinalSettlement();
 assert.equal(stay.payments.length,1);
 assert.equal(room.status,'limpieza');
 assert.equal(stay.status,'finalizada');
});
test('Si no se ha registrado efectivo para el cierre, no se permite dar salida',()=>{
 const {stay,room}=base();
 feed('finalize-form',{stayId:stay.id,operator:'Recepción',method:'efectivo',shift:'dia',cashTendered:''});
 api.processFinalSettlement();
 assert.equal(stay.status,'activa');
 assert.equal(room.status,'ocupada');
});
if(failures)process.exitCode=1;
