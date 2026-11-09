'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail));
const source=original.trimEnd().slice(0,-tail.length)+
 '\nwindow.__v23={defaults,initialCheckinDraft,sameGuestInvoiceData,syncSameGuestInvoice,renderCheckin,renderInvoices,invoiceQueue,invoiceAmountPending,invoiceAmountIssued,processInvoiceIssued,processCheckin,totalOf,paidOf,dueOf,today,tomorrow,render,setDB:x=>{db=x;},getDB:()=>db,setUI:x=>{ui=x;},getUI:()=>ui};\n})();';
const messages=[],listeners={},store={};
const nodes={
 'toasts':{append(node){messages.push(node.textContent)}},
 'app-view':{innerHTML:''},'breadcrumb':{textContent:''},year:{textContent:''},
 'current-date':{textContent:''},sidebar:{classList:{remove(){}}}
};
const document={
 getElementById(id){return nodes[id]||null},
 querySelectorAll(){return []},querySelector(){return null},
 addEventListener(name,cb){listeners[name]=cb},
 createElement(){return {className:'',textContent:'',append(){},remove(){}}},
 activeElement:null
};
let confirmResult=true;let confirmed=[];
const window={confirm(message){confirmed.push(message);return confirmResult},scrollTo(){}};
class FakeFormData{constructor(form){this.form=form;}entries(){return Object.entries(this.form.data||{})}}
const context={window,document,localStorage:{getItem(id){return store[id]||null},setItem(id,data){store[id]=data}},
 FormData:FakeFormData,Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,Map,Set,URL,Blob,
 setTimeout(){},console};
vm.createContext(context);vm.runInContext(source,context,{timeout:7000});
const t=window.__v23;
let failures=0;
function test(name,action){try{action();console.log('PASS',name)}catch(error){failures++;console.error('FAIL',name,error.stack||error)}}
function setup(){
 const db=t.defaults(),room=db.rooms.find(r=>r.id==='room-01');room.status='disponible';
 const draft=t.initialCheckinDraft();
 t.setDB(db);
 t.setUI({...t.getUI(),view:'ingreso',checkinDraft:draft,invoiceFilter:'pendientes',
  checkinVarios:[],checkinExtraRooms:[],selectedRoomId:null,prefillBookingId:null});
 messages.length=0;confirmed=[];confirmResult=true;
 delete nodes['checkin-form'];return {db,room,draft};
}
function injectForm(id,data){nodes[id]={data}}
test('El registro incluye casilla Factura a los mismos datos al seleccionar Sí',()=>{
 const {draft}=setup();
 draft.invoice='si';draft.invoiceSameData='si';
 draft.firstName='MARÍA';draft.lastName='FICTICIA';draft.document='1203093214';
 draft.email='persona@ejemplo.test';draft.address='Calle de prueba 123';
 const html=t.renderCheckin();
 assert(html.includes('id="checkin-invoice-same"'));
 assert(html.includes('Factura a los mismos datos del huésped'));
 assert(html.includes('value="MARÍA FICTICIA"'));
 assert(html.includes('value="1203093214"'));
 assert(html.includes('value="Calle de prueba 123"'));
 assert(html.includes('value="persona@ejemplo.test"'));
});
test('Con factura No la casilla está escondida, y la opción Sí permite datos distintos',()=>{
 const {draft}=setup();draft.invoice='no';
 assert(t.renderCheckin().includes('invoice-same-wrap hidden'));
 draft.invoice='si';draft.invoiceSameData='';
 const html=t.renderCheckin();
 assert(html.includes('id="invoice-fields"'));
 assert(!html.includes('id="checkin-invoice-same" name="invoiceSameData" value="si" checked'));
});
test('Copiar datos no inventa dirección o correo ausentes',()=>{
 setup();
 const got=t.sameGuestInvoiceData({firstName:'JUAN',lastName:'PRUEBA',document:'1203093214'});
 assert.equal(got.invoiceName,'JUAN PRUEBA');
 assert.equal(got.invoiceId,'1203093214');
 assert.equal(got.invoiceAddress,'');assert.equal(got.invoiceEmail,'');
});
test('Al activar casilla se rellenan nombre, identificación, dirección y correo en pantalla',()=>{
 setup();
 const data={invoice:'si',invoiceSameData:'si',firstName:'ANA',lastName:'EJEMPLO',
 document:'1203093214',address:'Av. Test 456',email:'ana@ejemplo.test'};
 const inputs={};
 for(const name of ['invoiceName','invoiceId','invoiceAddress','invoiceEmail'])inputs[name]={value:'',readOnly:false};
 nodes['checkin-form']={data,querySelector(sel){return sel==='[name=invoice]'?{value:'si'}:null}};
 nodes['checkin-invoice-same']={checked:true};
 nodes['invoice-fields']={classList:{toggle(){}},querySelector(sel){return inputs[sel.match(/name=([^\]]+)/)?.[1]]||null},querySelectorAll(){return Object.values(inputs)}};
 nodes['invoice-same-wrap']={classList:{toggle(){}}};
 nodes['invoice-same-hint']={classList:{toggle(){}},textContent:''};
 t.syncSameGuestInvoice();
 assert.equal(inputs.invoiceName.value,'ANA EJEMPLO');
 assert.equal(inputs.invoiceId.value,'1203093214');
 assert.equal(inputs.invoiceAddress.value,'Av. Test 456');
 assert.equal(inputs.invoiceEmail.value,'ana@ejemplo.test');
 assert(inputs.invoiceName.readOnly&&inputs.invoiceId.readOnly);
 delete nodes['checkin-form'];delete nodes['checkin-invoice-same'];
 delete nodes['invoice-fields'];delete nodes['invoice-same-wrap'];delete nodes['invoice-same-hint'];
});
test('Ingreso real guarda solicitud de factura con los mismos datos',()=>{
 const {db}=setup();
 const data={firstName:'MARÍA',secondName:'',lastName:'FICTICIA',secondLastName:'',
 document:'1203093214',phone:'0990000000',email:'maria@ejemplo.test',address:'Calle 123',
 arrival:t.today(),departure:t.tomorrow(),type:'individual',roomId:'room-01',breakfast:'sin',
 paymentMethod:'efectivo',cashTendered:'20',paymentVerified:'si',shift:'dia',invoice:'si',
 invoiceSameData:'si',invoiceName:'',invoiceId:'',invoiceAddress:'',invoiceEmail:'',notes:'Prueba'};
 injectForm('checkin-form',data);
 t.processCheckin();
 assert.equal(db.stays.length,1,'El ingreso debe registrarse');
 assert.equal(db.stays[0].invoiceRequested,true);
 assert.equal(db.stays[0].invoiceSameData,true);
 assert.equal(db.stays[0].invoiceDetails.name,'MARÍA FICTICIA');
 assert.equal(db.stays[0].invoiceDetails.identification,'1203093214');
 assert.equal(db.stays[0].invoiceDetails.address,'Calle 123');
 assert.equal(db.stays[0].invoiceDetails.email,'maria@ejemplo.test');
 assert.equal(db.guests[0].address,'Calle 123');
 assert.equal(db.stays[0].roomTotal,20);
 delete nodes['checkin-form'];
});
test('Nómina muestra solo habitaciones con factura pedida y su total, no solo el saldo',()=>{
 const db=t.getDB(),first=db.stays[0];
 db.stays.push({...first,id:'s-no-invoice',roomId:'room-02',invoiceRequested:false});
 db.stays.push({...first,id:'s-other',roomId:'room-03',invoiceRequested:true,
    invoiceDetails:{name:'CLIENTE SEGUNDO',identification:'1203093214',address:'Dirección',email:'a@b.test'},
    invoiceRecords:[{number:'001-001-000000111',amount:20,issuedAt:'2026-11-08T00:00:00Z',status:'emitida'}]});
 const html=t.renderInvoices();
 assert(html.includes('Habitación 01'));
 assert(!html.includes('Habitación 02'));
 assert(!html.includes('Habitación 03')); // facturada y filtro 'pendientes'
 assert(html.includes('Marcar emitida'));
 assert(html.includes('20,00'));
 assert.equal(t.invoiceQueue().length,2);
 assert.equal(t.invoiceAmountPending(first),20);
 assert.equal(t.invoiceAmountPending(db.stays.at(-1)),0);
});
test('Marcar emitida exige referencia de sistema externo, conserva pagos y registra solo administración',()=>{
 const db=t.getDB(),stay=db.stays[0],before=t.totalOf(stay),paid=t.paidOf(stay);
 injectForm('invoice-issued-'+stay.id,{invoiceNumber:'001-001-000000123'});
 t.processInvoiceIssued(stay.id);
 assert.equal(stay.invoiceRecords.length,1);
 assert.equal(stay.invoiceRecords[0].amount,20);
 assert.equal(stay.invoiceRecords[0].number,'001-001-000000123');
 assert.equal(t.invoiceAmountPending(stay),0);
 assert.equal(t.totalOf(stay),before);assert.equal(t.paidOf(stay),paid);
 assert(confirmed.some(msg=>msg.includes('ya fue EMITIDA')));
 delete nodes['invoice-issued-'+stay.id];
});
test('Los nuevos cargos generan importe complementario por facturar',()=>{
 const db=t.getDB(),stay=db.stays[0];
 db.extras.push({id:'extra-test',stayId:stay.id,price:2,quantity:3,method:'pendiente'});
 assert.equal(t.totalOf(stay),26);
 assert.equal(t.invoiceAmountIssued(stay),20);
 assert.equal(t.invoiceAmountPending(stay),6);
 assert(t.renderInvoices().includes('Habitación 01'));
});
test('Un número emitido no puede duplicarse y no se marca factura por error',()=>{
 const db=t.getDB(),stay=db.stays[0];
 injectForm('invoice-issued-'+stay.id,{invoiceNumber:'001-001-000000111'});
 t.processInvoiceIssued(stay.id);
 assert.equal(stay.invoiceRecords.length,1);
 assert(messages.some(m=>m.includes('ya figura registrado')));
 delete nodes['invoice-issued-'+stay.id];
});
test('Filtro facturadas muestra registros cerrados y sus números externos',()=>{
 const db=t.getDB();t.setUI({...t.getUI(),view:'facturas',invoiceFilter:'emitidas'});
 const html=t.renderInvoices();
 assert(html.includes('Habitación 03'));
 assert(html.includes('001-001-000000111'));
});
if(failures)process.exitCode=1;
