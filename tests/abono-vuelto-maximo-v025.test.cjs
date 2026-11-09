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
function setup({cash='20',method='efectivo',transferAmount=''}={}){
 for(const k of Object.keys(nodes))if(!['toasts','app-view','breadcrumb','sidebar','year','current-date'].includes(k))delete nodes[k];
 const db=t.defaults(),room=db.rooms.find(r=>r.id==='room-01');
 room.status='ocupada';const stay={id:'test-abono',guestId:'gtest',roomId:room.id,
 roomRate:10.07,roomTotal:10.07,arrival:'2026-11-08',departure:'2026-11-09',
 payments:[],status:'activa',createdAt:'2026-11-08T12:00:00Z'};
 db.stays=[stay];db.guests=[{id:'gtest',firstName:'HUÉSPED',lastName:'PRUEBA'}];
 t.setDB(db);t.setUI({...t.getUI(),view:'salidas',selectedStayId:stay.id});
 const fields={
  stayId:{value:stay.id},transferAmount:{value:transferAmount},cashTendered:{value:cash},method:{value:method},shift:{value:'dia'},
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
test('Monto pendiente es siempre lo que aparece como Valor a cobrar, sin cuadro de abono',()=>{
 const {stay}=setup();const html=t.renderPaymentForm(stay);
 assert(!html.includes('id="payment-amount"'));
 assert(!html.includes('Valor del abono (USD)'));
 assert(html.includes('Valor a cobrar'));
 assert(html.includes('$10,07'));
});
test('Con saldo 10,07 y 20 entregados se aplican 10,07 y se devuelve 9,93',()=>{
 const quote=t.checkoutAbonoQuote(10.07,20);
 assert.equal(quote.due,10.07);
 assert.equal(quote.applied,10.07);
 assert.equal(quote.received,20);
 assert.equal(quote.change,9.93);
 assert.equal(quote.remaining,0);
 assert(quote.exceeds);
});
test('Con 5 entregados se registra un abono parcial sin cambio',()=>{
 const q=t.checkoutAbonoQuote(10.07,5);
 assert.equal(q.applied,5);assert.equal(q.change,0);assert.equal(q.remaining,5.07);
});
test('Con importe no indicado se muestra la deuda original y no se aplica pago',()=>{
 const q=t.checkoutAbonoQuote(10.07,'');
 assert.equal(q.applied,0);assert.equal(q.remaining,10.07);assert(q.missing);
});
test('La vista previa para 20 en efectivo no modifica otro campo, muestra vuelto y saldo cero',()=>{
 setup();t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-amount-preview'].textContent,'$10,07');
 assert.equal(nodes['payment-change-preview'].textContent,'$9,93');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$0,00');
});
test('Se registra el pago completo sin cerrar habitación',()=>{
 const {stay,room}=setup();t.updateCheckoutAbonoPreview();t.processPayment();
 assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].amount,10.07);
 assert.equal(stay.payments[0].cashTendered,20);
 assert.equal(stay.payments[0].cashChange,9.93);
 assert.equal(t.dueOf(stay),0);assert.equal(stay.status,'activa');assert.equal(room.status,'ocupada');
});
test('Se registra abono parcial si el efectivo entregado es inferior al saldo',()=>{
 const {stay}=setup({cash:'5'});
 t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-amount-preview'].textContent,'$10,07');
 assert.equal(nodes['payment-change-preview'].textContent,'$0,00');
 assert.equal(nodes['payment-remaining-preview'].textContent,'$5,07');
 t.processPayment();assert.equal(t.dueOf(stay),5.07);
 assert.equal(stay.payments[0].amount,5);assert.equal(stay.payments[0].cashChange,0);
});
test('Sin efectivo introducido no presupone un pago ni muestra vuelto 0',()=>{
 const {stay}=setup({cash:''});
 t.updateCheckoutAbonoPreview();
 assert.equal(nodes['payment-change-preview'].textContent,'—');
 t.processPayment();assert.equal(stay.payments.length,0);
});
test('Rechaza importes con más de dos decimales y transferencias superiores a saldo',()=>{
 const {stay,fields}=setup({cash:'3.251'});
 t.processPayment();assert.equal(stay.payments.length,0);
 fields.method.value='transferencia';fields.transferAmount.value='15';fields.reference.value='REF-EXCESO';
 t.processPayment();assert.equal(stay.payments.length,0);
});
test('Una transferencia parcial de 3 y sin vuelto deja 7,07 por cobrar',()=>{
 const {stay}=setup({cash:'',method:'transferencia',transferAmount:'3'});
 nodes['payment-form'].fields.reference.value='TRANSFER-OK';
 t.processPayment();assert.equal(stay.payments.length,1);
 assert.equal(stay.payments[0].amount,3);assert.equal(stay.payments[0].cashChange,0);
 assert.equal(t.dueOf(stay),7.07);assert(t.renderFinalAccountSection(stay).includes('7,07'));
});
if(failed)process.exitCode=1;
