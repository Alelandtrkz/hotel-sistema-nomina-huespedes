'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';assert(app.trimEnd().endsWith(tail));
const code=app.trimEnd().slice(0,-tail.length)+
'\nwindow.__v26={defaults,renderPaymentForm,checkoutAbonoQuote,updateCheckoutAbonoPreview,processPayment,dueOf,setDB:d=>{db=d;},setUI:u=>{ui=u;},getUI:()=>ui};\n})();';
const nodes={},messages=[],storage={};
const document={
 getElementById:id=>nodes[id]||null,addEventListener(){},querySelectorAll(){return []},querySelector(){return null},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}}
};
const window={confirm(){return true},scrollTo(){}};
class Data{constructor(f){this.fields=f.fields||{}}entries(){return Object.entries(this.fields).map(([k,v])=>[k,v.value])}}
const ctx={window,document,FormData:Data,localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v}},
 Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,Map,Set,URL,Blob,setTimeout(){},console};
nodes.toasts={append:x=>messages.push(x.textContent)};
nodes['app-view']={innerHTML:''};nodes.breadcrumb={textContent:''};nodes.sidebar={classList:{remove(){}}};
nodes.year={textContent:''};nodes['current-date']={textContent:''};
vm.createContext(ctx);vm.runInContext(code,ctx,{timeout:5000});
const t=window.__v26;
function cls(){return {toggle(){},add(){},remove(){}}}
function setup({cash='20',method='efectivo',transferAmount='',changeStatus='dado'}={}){
 const db=t.defaults(),room=db.rooms.find(x=>x.id==='room-01');room.status='ocupada';
 db.guests=[{id:'guest-test',firstName:'CASO',lastName:'PRUEBA'}];
 const stay={id:'stay-test',guestId:'guest-test',roomId:room.id,roomRate:3.25,roomTotal:3.25,
  arrival:'2026-11-08',departure:'2026-11-09',status:'activa',advance:0,payments:[]};
 db.stays=[stay];t.setDB(db);t.setUI({...t.getUI(),view:'salidas',selectedStayId:stay.id});
 const fields={stayId:{value:stay.id},method:{value:method},cashTendered:{value:cash},
  transferAmount:{value:transferAmount},changeStatus:{value:changeStatus},reference:{value:'ABC-TEST'},shift:{value:'dia'}};
 nodes['payment-form']={fields,querySelector(q){const key=q.match(/^\[name=([^\]]+)\]$/)?.[1];return key?fields[key]||null:null}};
 nodes['payment-cash-zone']={classList:cls()};
 nodes['payment-amount-preview']={textContent:''};
 nodes['payment-change-preview']={textContent:'',classList:cls()};
 nodes['payment-change-choice']={classList:cls()};
 nodes['payment-remaining-preview']={textContent:''};
 nodes['payment-partial-hint']={textContent:''};
 messages.length=0;return {db,room,stay,fields};
}
let fails=0;function test(name,fn){try{fn();console.log('PASS',name)}catch(e){fails++;console.error('FAIL',name,e.stack||e)}}
test('No existe valor del abono manual en el formulario; deuda fija $3,25',()=>{
 const {stay}=setup(),html=t.renderPaymentForm(stay);
 assert(!html.includes('id="payment-amount"'));
 assert(!html.includes('Valor del abono (USD)'));
 assert(html.includes('Valor a cobrar'));
 assert(html.includes('$3,25'));
});
test('3,25 pendientes y 20 en efectivo: valor a cobrar 3,25 y vuelto 16,75',()=>{
 setup();t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-amount-preview'].textContent,'$3,25');
 assert.equal(nodes['payment-change-preview'].textContent,'$16,75');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$0,00');
});
test('3,25 pendientes y 2 de efectivo: pago parcial y saldo restante 1,25',()=>{
 const {stay}=setup({cash:'2'});t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-amount-preview'].textContent,'$3,25');
 assert.equal(nodes['payment-change-preview'].textContent,'$0,00');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$1,25');
 t.processPayment();assert.equal(stay.payments[0].amount,2);assert.equal(t.dueOf(stay),1.25);
});
test('20 recibido para saldo 3,25 se registra como 3,25 más 16,75 de vuelto',()=>{
 const {room,stay}=setup();t.processPayment();
 assert.equal(stay.payments.length,1);assert.equal(stay.payments[0].amount,3.25);
 assert.equal(stay.payments[0].cashTendered,20);assert.equal(stay.payments[0].cashChange,16.75);
 assert.equal(stay.status,'activa');assert.equal(room.status,'ocupada');
});
test('No guarda efectivo con vuelto si no se confirma su entrega',()=>{
 const {stay}=setup({changeStatus:''});t.processPayment();
 assert.equal(stay.payments.length,0);
 assert(messages.some(x=>x.includes('vuelto')));
});
test('Transferencia parcial se registra con su propio monto sin textbox de abono',()=>{
 const {stay}=setup({cash:'',method:'transferencia',transferAmount:'1.50'});
 t.processPayment();assert.equal(stay.payments[0].amount,1.5);assert.equal(t.dueOf(stay),1.75);
 assert.equal(stay.payments[0].cashChange,0);
});
test('Transferencia mayor a saldo y pago vacío son rechazados',()=>{
 const {stay,fields}=setup({cash:'',method:'transferencia',transferAmount:'5'});
 t.processPayment();assert.equal(stay.payments.length,0);
 fields.method.value='efectivo';fields.cashTendered.value='';
 t.processPayment();assert.equal(stay.payments.length,0);
});
if(fails)process.exitCode=1;
