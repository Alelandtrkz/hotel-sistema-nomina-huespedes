'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const js=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),end='  render();\n})();';
assert(js.trimEnd().endsWith(end));
const code=js.trimEnd().slice(0,-end.length)+
'\nwindow.__v25={defaults,checkoutAbonoQuote,updateCheckoutAbonoPreview,updateCashPreview,renderPaymentForm,processPayment,dueOf,renderFinalAccountSection,setDB:x=>{db=x;},setUI:x=>{ui=x;},getUI:()=>ui};\n})();';
const nodes={},messages=[],confirmations=[],storage={};
const document={
 getElementById(id){return nodes[id]||null},
 addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}}
};
nodes.toasts={append(n){messages.push(n.textContent)}};
nodes['app-view']={innerHTML:''};nodes.breadcrumb={textContent:''};nodes.sidebar={classList:{remove(){}}};nodes.year={textContent:''};nodes['current-date']={textContent:''};
const window={scrollTo(){},confirm(t){confirmations.push(t);return true}};
class FakeFormData{constructor(f){this.f=f;}entries(){return Object.entries(this.f.fields||{}).map(([k,v])=>[k,v.value]);}}
const env={window,document,localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v}},
 FormData:FakeFormData,Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,Map,Set,URL,Blob,setTimeout(){},console};
vm.createContext(env);vm.runInContext(code,env,{timeout:7000});
const t=window.__v25;
let failed=0;
function test(title,fn){try{fn();console.log('PASS',title)}catch(e){failed++;console.error('FAIL',title,e.stack||e)}}
function cl(){const vals=new Set(['hidden']);return {contains:k=>vals.has(k),remove:k=>vals.delete(k),add:k=>vals.add(k),toggle(k,v){if(v)vals.add(k);else vals.delete(k)}}}
function setup({amount='20',cash='20',method='efectivo'}={}){
 for(const k of Object.keys(nodes))if(!['toasts','app-view','breadcrumb','sidebar','year','current-date'].includes(k))delete nodes[k];
 const db=t.defaults(),room=db.rooms.find(r=>r.id==='room-01');
 room.status='ocupada';const stay={id:'test-abono',guestId:'gtest',roomId:room.id,
 roomRate:10.07,roomTotal:10.07,arrival:'2026-11-08',departure:'2026-11-09',
 payments:[],status:'activa',createdAt:'2026-11-08T12:00:00Z'};
 db.stays=[stay];db.guests=[{id:'gtest',firstName:'HUÉSPED',lastName:'PRUEBA'}];
 t.setDB(db);t.setUI({...t.getUI(),view:'salidas',selectedStayId:stay.id});
 const fields={
  stayId:{value:stay.id},amount:{value:amount},cashTendered:{value:cash},method:{value:method},shift:{value:'dia'},
  changeStatus:{value:'dado'},reference:{value:''}
 };
 const form={
  fields,querySelector(query){let key=/^\[name=([^\]]+)\]$/.exec(query)?.[1];return key?fields[key]||null:null}
 };
 nodes['payment-form']=form;
 nodes['payment-amount-preview']={textContent:''};
 nodes['payment-change-preview']={textContent:'',classList:cl()};
 nodes['payment-cash-zone']={classList:cl()};
 nodes['payment-change-choice']={classList:cl()};
 nodes['payment-amount-warning']={textContent:'',classList:cl()};
 nodes['payment-remaining-preview']={textContent:''};
 messages.length=0;
 return {db,room,stay,form,fields};
}
test('Saldo de 10,07 y solicitud de 20: solo 10,07 se aplica',()=>{
 const q=t.checkoutAbonoQuote(10.07,20);
 assert.equal(q.applied,10.07);assert.equal(q.remaining,0);assert.equal(q.exceeds,true);
});
test('Un abono parcial de 5,00 deja saldo de 5,07',()=>{
 const q=t.checkoutAbonoQuote(10.07,5);
 assert.equal(q.applied,5);assert.equal(q.remaining,5.07);assert.equal(q.exceeds,false);
});
test('No se inventa un abono cuando no hay importe ingresado',()=>{
 const q=t.checkoutAbonoQuote(10.07,'');
 assert.equal(q.applied,0);assert.equal(q.remaining,10.07);
});
test('20 de abono solicitado con saldo 10,07 se normaliza a 10,07 y vuelto 9,93',()=>{
 const {fields}=setup();
 t.updateCheckoutAbonoPreview();
 assert.equal(fields.amount.value,'10.07');
 assert.equal(nodes['payment-amount-preview'].textContent,'$10,07');
 assert.equal(nodes['payment-change-preview'].textContent,'$9,93');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$0,00');
 assert(nodes['payment-amount-warning'].textContent.includes('Se ajustó'));
 assert(!nodes['payment-amount-warning'].classList.contains('hidden'));
});
test('El abono normalizado se registra a 10,07 sin duplicar el efectivo recibido',()=>{
 const {stay,room,fields}=setup();
 t.updateCheckoutAbonoPreview();t.processPayment();
 assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].amount,10.07);
 assert.equal(stay.payments[0].cashTendered,20);
 assert.equal(stay.payments[0].cashChange,9.93);
 assert.equal(t.dueOf(stay),0);
 assert.equal(stay.status,'activa');
 assert.equal(room.status,'ocupada');
});
test('Un abono de 5 y efectivo de 20 devuelve 15 y deja deuda de 5,07',()=>{
 const {stay}=setup({amount:'5',cash:'20'});
 t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-amount-preview'].textContent,'$5,00');
 assert.equal(nodes['payment-change-preview'].textContent,'$15,00');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$5,07');
 t.processPayment();assert.equal(t.dueOf(stay),5.07);
 assert.equal(stay.payments[0].cashChange,15);
});
test('Si no se especifica efectivo recibido, no se muestra vuelto 0 engañoso',()=>{
 setup({amount:'10.07',cash:''});
 t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-change-preview'].textContent,'—');
});
test('Si el dinero recibido es inferior al abono, advertir insuficiencia',()=>{
 setup({amount:'10.07',cash:'5'});
 t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-change-preview'].textContent,'Efectivo insuficiente');
});
test('Sin previsualización, el servidor de formulario sigue rechazando abonos superiores al saldo',()=>{
 const {stay}=setup({amount:'20',cash:'20'});
 t.processPayment();
 assert.equal(stay.payments.length,0);
 assert(messages.some(m=>m.includes('no superar el saldo')));
});
test('Cierre de cuenta sigue siendo independiente y se cobra solo saldo existente',()=>{
 const {stay}=setup({amount:'3',cash:'3'});
 t.processPayment();
 assert.equal(t.dueOf(stay),7.07);
 assert(t.renderFinalAccountSection(stay).includes('7,07'));
});
if(failed)process.exitCode=1;
