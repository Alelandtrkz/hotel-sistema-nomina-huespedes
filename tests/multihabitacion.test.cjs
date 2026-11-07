'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(src.trimEnd().endsWith(tail),'Se cambió el cierre de app.js');
const code=src.trimEnd().slice(0,-tail.length)+
  '\nwindow.__multi={getDB:()=>db,setDB:d=>{db=d;},getUI:()=>ui,setUI:val=>{ui=val;},defaults,checkinAssignments,checkinGroupEstimate,'+
  'prepareCheckinGroup,processCheckin,renderCheckin,renderRoomAccount,renderClientRooms,'+
  'activeStays,totalOf,paidOf,dueOf,cashTotals,availableForCheckin,roomOf};\n})();';
const messages=[],fake={
  toasts:{append(n){messages.push(n.textContent);}},
  'app-view':{innerHTML:''},breadcrumb:{textContent:''},
  sidebar:{classList:{remove(){}}},year:{textContent:''},
  'current-date':{textContent:''}
};
const document={
 getElementById(id){return fake[id]||null;},
 querySelectorAll(){return [];},querySelector(){return null},addEventListener(){},
 createElement(){return {textContent:'',className:'',remove(){},append(){}};}
};
const local={};
const form=class{constructor(el){this.obj=el.data||{};}entries(){return Object.entries(this.obj);}};
const ctx={window:{scrollTo(){},confirm(){return true}},document,localStorage:{getItem(k){return local[k]||null},setItem(k,v){local[k]=v}},
 console,Date,Intl,Number,Math,Array,String,Object,JSON,RegExp,setTimeout(){},FormData:form,URL,Blob};
vm.createContext(ctx);vm.runInContext(code,ctx,{timeout:5000});
const t=ctx.window.__multi;
function test(name,func){try{func();console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack||e);process.exitCode=1;}}
const DATE='2026-11-07',NEXT='2026-11-08';
function bookingForm(extra={}){
 return {firstName:'FAMILIA',secondName:'',lastName:'PRUEBA',secondLastName:'',document:'0000000000',
  phone:'0990000000',email:'',arrival:DATE,departure:NEXT,
  type:'individual',roomId:'room-02',breakfast:'sin',batch1__type:'doble',
  batch1__breakfast:'sin',batch1__roomId:'room-03',
  paymentMethod:'efectivo',paymentAmount:'50',cashTendered:'55',changeStatus:'pendiente',shift:'dia',invoice:'no',notes:'',
  ...extra};
}
function wrapForm(data){return {data,elements:{namedItem(){return null;}}};}
function setup(extraRooms=[{key:'batch1'}]){
 const db=t.defaults();
 t.setDB(db);
 t.setUI({...t.getUI(),checkinExtraRooms:extraRooms,checkinRowSeq:extraRooms.length,selectedRoomId:null,prefillBookingId:null,
   checkinDraft:bookingForm(),view:'ingreso'});
 fake['checkin-form']=wrapForm(bookingForm() );
 return db;
}
test('Cotización de habitaciones 02 individual $20 y 03 doble $30 suma $50',()=>{
 const d=setup(),estimate=t.checkinGroupEstimate(bookingForm());
 assert.equal(estimate.items.length,2);
 assert.equal(estimate.items[0].roomId,'room-02');
 assert.equal(estimate.items[1].roomId,'room-03');
 assert.equal(estimate.items[0].total,20);
 assert.equal(estimate.items[1].total,30);
 assert.equal(estimate.total,50);
 const html=t.renderCheckin();
 assert(html.includes('Más habitaciones para este mismo cliente'));
 assert(html.includes('Agregar otra habitación'));
 assert(html.includes('TOTAL DE LAS HABITACIONES'));
 assert(html.includes('50,00'));
});
test('Registrar 2 habitaciones crea UN cliente, 2 estadías y una cuenta por habitación',()=>{
 const d=setup();
 t.processCheckin();
 assert.equal(d.guests.length,1);
 assert.equal(d.stays.length,2);
 assert.equal(d.stays[0].guestId,d.stays[1].guestId);
 assert(d.stays[0].groupId&&d.stays[0].groupId===d.stays[1].groupId);
 assert.equal(d.rooms.find(r=>r.id==='room-02').status,'ocupada');
 assert.equal(d.rooms.find(r=>r.id==='room-03').status,'ocupada');
 assert.equal(t.dueOf(d.stays[0]),0);
 assert.equal(t.dueOf(d.stays[1]),0);
 const html=t.renderRoomAccount(d.rooms.find(r=>r.id==='room-02'),d.stays[0]);
 assert(html.includes('Habitaciones del mismo titular'));
 assert(html.includes('Hab. 03'));
 assert(html.includes('Por cobrar entre todas'));
});
test('Pago de $50 con $55 recibido mantiene efectivo neto $50 y vuelto $5 una sola vez',()=>{
 const d=setup();
 t.processCheckin();
 assert.equal(d.stays[0].payments.length,1);
 assert.equal(d.stays[1].payments.length,1);
 assert.equal(d.stays[0].payments[0].amount,20);
 assert.equal(d.stays[1].payments[0].amount,30);
 assert.equal(d.stays[0].payments[0].cashChange,5);
 assert.equal(d.stays[1].payments[0].cashChange,0);
 assert.equal(d.stays[0].payments[0].cashTendered+d.stays[1].payments[0].cashTendered,55);
 const local=new Date().toISOString().slice(0,10),cash=t.cashTotals(local,'dia');
 assert.equal(cash.cash,55);
 assert.equal(cash.changePendingTotal,5);
 assert.equal(cash.out,0);
});
test('Bloquea intentar asignar la habitación 02 dos veces en la misma familia',()=>{
 setup();
 const plan=t.prepareCheckinGroup(bookingForm({batch1__type:'individual',batch1__roomId:'room-02'}));
 assert(plan.error&&/dos veces/i.test(plan.error));
});
test('Habitación ocupada no puede agregarse a otro cliente',()=>{
 const d=setup();
 d.rooms.find(r=>r.id==='room-03').status='ocupada';
 d.stays=[{id:'other',guestId:'other-guest',roomId:'room-03',status:'activa',arrival:DATE,departure:NEXT}];
 const p=t.prepareCheckinGroup(bookingForm());
 assert(p.error&&/no está disponible/i.test(p.error));
 fake['checkin-form']=wrapForm(bookingForm() );
 t.processCheckin();
 assert.equal(d.guests.length,0);
 assert.equal(d.stays.length,1);
});
test('Aunque el estado de habitación fuera disponible, una estadía activa bloquea doble asignación',()=>{
 const d=setup();
 d.stays=[{id:'other',guestId:'other-guest',roomId:'room-03',status:'activa',arrival:DATE,departure:NEXT}];
 const r=d.rooms.find(r=>r.id==='room-03');
 assert.equal(r.status,'disponible');
 assert.equal(t.availableForCheckin(r,DATE,NEXT),false);
});
test('Anticipo reservado se descuenta una sola vez de la habitación principal',()=>{
 const d=setup();
 d.reservations=[{id:'book',roomId:'room-02',type:'individual',breakfast:'sin',
   arrival:DATE,departure:NEXT,advance:10,status:'confirmada'}];
 t.setUI({...t.getUI(),prefillBookingId:'book'});
 const p=t.prepareCheckinGroup(bookingForm({paymentAmount:'40',cashTendered:'40'}),d.reservations[0]);
 assert.equal(p.error,null);
 assert.equal(p.items[0].advance,10);
 assert.equal(p.items[1].advance,0);
 assert.equal(p.items[0].payment,10);
 assert.equal(p.items[1].payment,30);
 fake['checkin-form']=wrapForm(bookingForm({paymentAmount:'40',cashTendered:'40'}) );
 t.processCheckin();
 assert.equal(d.stays[0].advance,10);
 assert.equal(d.stays[1].advance,0);
 assert.equal(d.stays[0].payments[0].amount,10);
 assert.equal(d.stays[1].payments[0].amount,30);
 assert.equal(d.reservations[0].status,'alojada');
 assert.equal(d.stays[0].reservationId,'book');
 assert.equal(d.stays[1].reservationId,null);
});
test('Abono parcial por transferencia se distribuye sin generar vuelto ni duplicar el pago',()=>{
 const d=setup();
 const form=bookingForm({paymentAmount:'25',paymentMethod:'transferencia',transferCode:'TEST-TRANSFER-001',cashTendered:''});
 const p=t.prepareCheckinGroup(form);
 assert.equal(p.error,null);
 assert.equal(p.items[0].payment,20);
 assert.equal(p.items[1].payment,5);
 assert.equal(p.items[0].tender.change,0);
 fake['checkin-form']=wrapForm(form );
 t.processCheckin();
 assert.equal(t.dueOf(d.stays[0]),0);
 assert.equal(t.dueOf(d.stays[1]),25);
 assert.equal(d.stays[0].payments[0].reference,'TEST-TRANSFER-001');
 assert.equal(d.stays[1].payments[0].reference,'TEST-TRANSFER-001');
});
test('El formulario anterior con una sola habitación sigue funcionando',()=>{
 const d=setup([]);
 fake['checkin-form']=wrapForm(bookingForm({paymentAmount:'20',cashTendered:'20'}) );
 t.processCheckin();
 assert.equal(d.guests.length,1);
 assert.equal(d.stays.length,1);
 assert.equal(d.stays[0].roomId,'room-02');
 assert.equal(d.stays[0].groupId,null);
 assert.equal(d.stays[0].payments[0].amount,20);
});
test('Las reservas asignadas a otra persona bloquean una habitación adicional',()=>{
 const d=setup();
 d.reservations=[{id:'otherbooking',roomId:'room-03',arrival:DATE,departure:NEXT,
   status:'confirmada'}];
 const p=t.prepareCheckinGroup(bookingForm());
 assert(p.error);
});
test('Tarifas sin configurar se rechazan sin crear habitaciones',()=>{
 const d=setup();
 const form=bookingForm({batch1__type:'individual_ventilador',batch1__breakfast:'con',batch1__roomId:'room-07'});
 const p=t.prepareCheckinGroup(form);
 assert(p.error&&/tarifa/i.test(p.error));
 assert.equal(d.stays.length,0);
});
console.log('Pruebas en memoria con cédulas ficticias; no se escriben datos en Supabase.');
