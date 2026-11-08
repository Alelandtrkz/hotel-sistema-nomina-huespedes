'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(src.trimEnd().endsWith(tail),'Se cambió el cierre de app.js');
const code=src.trimEnd().slice(0,-tail.length)+
  '\nwindow.__multi={getDB:()=>db,setDB:d=>{db=d;},getUI:()=>ui,setUI:val=>{ui=val;},defaults,checkinAssignments,checkinGroupEstimate,'+
  'prepareCheckinGroup,processCheckin,renderCheckin,renderRoomAccount,renderClientRooms,quoteCheckinVarios,filterCheckinProducts,renderCheckinVarios,stayHistoryEvents,checkEcuadorDocument,validDoc,getGuestByDocument,saveGuest,'+
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
 return {firstName:'FAMILIA',secondName:'',lastName:'PRUEBA',secondLastName:'',document:'0102030400',
  phone:'0990000000',email:'',arrival:DATE,departure:NEXT,
  type:'individual',roomId:'room-02',breakfast:'sin',batch1__type:'doble',
  batch1__breakfast:'sin',batch1__roomId:'room-03',
  paymentMethod:'efectivo',paymentVerified:'si',paymentAmount:'50',cashTendered:'55',changeStatus:'pendiente',shift:'dia',invoice:'no',notes:'',
  ...extra};
}
function wrapForm(data){return {data,elements:{namedItem(){return null;}}};}
function setup(extraRooms=[{key:'batch1'}]){
 const db=t.defaults();
 t.setDB(db);
 t.setUI({...t.getUI(),checkinExtraRooms:extraRooms,checkinRowSeq:extraRooms.length,checkinVarios:[],checkinVariosSeq:0,checkinProductSearch:'',checkinVariosOpen:false,selectedRoomId:null,prefillBookingId:null,
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
 assert(html.includes('TOTAL HOSPEDAJE + VARIOS'));
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
test('Transferencia de ingreso aplica todo el saldo sin permitir pago parcial manual',()=>{
 const d=setup();
 const form=bookingForm({paymentAmount:'25',paymentMethod:'transferencia',transferCode:'TEST-TRANSFER-001',cashTendered:''});
 const p=t.prepareCheckinGroup(form);
 assert.equal(p.error,null);
 assert.equal(p.payment,50);
 assert.equal(p.items[0].payment,20);
 assert.equal(p.items[1].payment,30);
 assert.equal(p.items[0].tender.change,0);
 fake['checkin-form']=wrapForm(form);
 t.processCheckin();
 assert.equal(t.dueOf(d.stays[0]),0);
 assert.equal(t.dueOf(d.stays[1]),0);
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
test('El formulario NO muestra importe editable y permite descuento solo por transferencia',()=>{
 const d=setup([]);
 const html=t.renderCheckin();
 assert(!html.includes('name="paymentAmount"'));
 assert(html.includes('Por cobrar · requiere doble confirmación'));
 assert(html.includes('Transferencia · precio con descuento'));
 assert(!html.includes('Efectivo · precio con descuento'));
 assert(!html.includes('Por cobrar · precio con descuento'));
 assert(html.includes('checkin-auto-payment'));
});
test('Por cobrar conserva el total pendiente y no registra dinero en caja',()=>{
 const d=setup([]);
 const form=bookingForm({paymentMethod:'por_cobrar',creditConfirmed:'si',paymentAmount:'9999',cashTendered:'200'});
 fake['checkin-form']=wrapForm(form);
 const p=t.prepareCheckinGroup(form);
 assert.equal(p.error,null);
 assert.equal(p.payment,0);
 assert.equal(p.tender.received,0);
 t.processCheckin();
 assert.equal(d.stays.length,1);
 assert.equal(d.stays[0].payments.length,0);
 assert.equal(t.dueOf(d.stays[0]),20);
 const local=new Date().toISOString().slice(0,10);
 assert.equal(t.cashTotals(local,'dia').cash,0);
});
test('Por cobrar con descuento se rechaza porque la tarifa especial es solo por transferencia',()=>{
 const d=setup([]);
 const form=bookingForm({paymentMethod:'por_cobrar_descuento'});
 const p=t.prepareCheckinGroup(form);
 assert(p.error);
 fake['checkin-form']=wrapForm(form);
 t.processCheckin();
 assert.equal(d.stays.length,0);
});
test('Efectivo con descuento se rechaza y no crea cargos',()=>{
 const d=setup([]);
 const form=bookingForm({paymentMethod:'efectivo_descuento',cashTendered:'20'});
 assert(t.prepareCheckinGroup(form).error);
 fake['checkin-form']=wrapForm(form);
 t.processCheckin();
 assert.equal(d.stays.length,0);
});
test('Tarifas de descuentos son exactamente las seis indicadas por recepción',()=>{
 for(const [type,roomId,floor] of [
  ['individual_ventilador','room-07',15],
  ['matrimonial_ventilador','room-08',20],
  ['individual','room-02',17],
  ['matrimonial','room-02',27],
  ['doble','room-03',27],
  ['triple','room-04',37]
 ]){
  setup([]);
  const f=bookingForm({type,roomId,paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-01'});
  const estimate=t.checkinGroupEstimate(f);
  assert.equal(estimate.items[0].nightly,floor,'Tarifa incorrecta: '+type);
  assert.equal(estimate.items[0].total,floor,'Total incorrecto: '+type);
 }
});
test('Tarifa especial en transferencia aplica $17 automáticamente, sin vuelto',()=>{
 const d=setup([]);
 const form=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-02'});
 const p=t.prepareCheckinGroup(form);
 assert.equal(p.error,null);assert.equal(p.payment,17);
 assert.equal(p.tender.change,0);
 fake['checkin-form']=wrapForm(form);t.processCheckin();
 assert.equal(d.stays[0].payments[0].amount,17);
 assert.equal(d.stays[0].payments[0].method,'transferencia');
 assert.equal(d.stays[0].discountTotal,3);
 assert.equal(t.dueOf(d.stays[0]),0);
});
test('Varias habitaciones con descuento suman $44 (17 + 27) y solo admiten transferencia',()=>{
 const d=setup();
 const form=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-GROUP'});
 const p=t.prepareCheckinGroup(form);
 assert.equal(p.error,null);
 assert.equal(p.total,44);
 assert.equal(p.payment,44);
 assert.equal(p.tender.change,0);
 fake['checkin-form']=wrapForm(form);t.processCheckin();
 assert.equal(d.stays[0].roomRate,17);
 assert.equal(d.stays[1].roomRate,27);
 assert.equal(d.stays[0].payments[0].cashChange,0);
 assert.equal(d.stays[1].payments[0].cashChange,0);
 assert.equal(t.dueOf(d.stays[0]),0);assert.equal(t.dueOf(d.stays[1]),0);
});
test('La tarifa con descuento NO se acepta si se solicita factura',()=>{
 const d=setup([]);
 const f=bookingForm({paymentMethod:'transferencia_descuento',invoice:'si',transferCode:'TEST-DESC-INV'});
 const p=t.prepareCheckinGroup(f);
 assert(p.error&&/factura/i.test(p.error));
 fake['checkin-form']=wrapForm(f);
 t.processCheckin();
 assert.equal(d.guests.length,0);
 assert.equal(d.stays.length,0);
});
test('La tarifa con descuento NO se acepta con desayuno',()=>{
 const d=setup([]);
 const f=bookingForm({paymentMethod:'transferencia_descuento',breakfast:'con',transferCode:'TEST-DESC-BREAKFAST'});
 const p=t.prepareCheckinGroup(f);
 assert(p.error&&/desayuno/i.test(p.error));
});
test('La tarifa con descuento NO modifica reservas confirmadas ni sus anticipos',()=>{
 const d=setup([]);
 d.reservations=[{id:'book',roomId:'room-02',type:'individual',breakfast:'sin',arrival:DATE,departure:NEXT,advance:10,status:'confirmada'}];
 const f=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-RESERVE'});
 const p=t.prepareCheckinGroup(f,d.reservations[0]);
 assert(p.error&&/reserva/i.test(p.error));
});
test('El descuento no reduce importes de acompañantes, niños ni consumos',()=>{
 const d=setup([]);
 const f=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-ADD'});
 fake['checkin-form']=wrapForm(f);t.processCheckin();
 const stay=d.stays[0];
 stay.additionalPeople=[{category:'adulto',amount:10},{category:'nino',amount:5}];
 assert.equal(stay.roomRate,17);
 assert.equal(t.totalOf(stay),32);
 assert.equal(t.dueOf(stay),15);
});
test('Tarifa de descuento nunca puede superar o alterar una tarifa configurada menor',()=>{
 const d=setup([]);
 d.config.rates.individual.sin=16;
 const f=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-DESC-FLOOR'});
 assert.equal(t.checkinGroupEstimate(f).total,null);
 assert(t.prepareCheckinGroup(f).error);
});

test('Buscar Varios filtra por nombre y categoría incluso con acentos',()=>{
 const d=setup([]);
 assert(t.renderCheckin().includes('Buscar producto en Varios'));
 assert(t.renderCheckin().includes('Varios para este mismo huésped'));
 const all=t.filterCheckinProducts('AGUA');
 assert(all.length>0);
 assert(all.some(x=>x.name.toLowerCase().includes('agua')));
 assert(t.filterCheckinProducts('shampu').some(x=>/shamp/i.test(x.name)));
 assert(t.filterCheckinProducts('aseo').some(x=>x.category==='aseo'));
 assert.equal(t.filterCheckinProducts('producto inexistente sin coincidencias').length,0);
});
test('Agregar dos Varios al ingreso deja productos en cuenta y descuenta stock una sola vez',()=>{
 const d=setup([]);
 d.products.find(p=>p.id==='producto-002').stock=3;
 d.products.find(p=>p.id==='producto-003').stock=5;
 t.setUI({...t.getUI(),checkinVarios:[
   {key:'checkvar1',productId:'producto-002',quantity:'1',roomKey:'principal'},
   {key:'checkvar2',productId:'producto-003',quantity:'2',roomKey:'principal'}
 ]});
 const form=bookingForm({cashTendered:'24',changeStatus:'dado'});
 fake['checkin-form']=wrapForm(form);
 const plan=t.prepareCheckinGroup(form);
 assert.equal(plan.error,null);
 assert.equal(plan.total,20);
 assert.equal(plan.variosTotal,2.5);
 assert.equal(plan.grandTotal,22.5);
 assert.equal(plan.tender.change,1.5);
 t.processCheckin();
 assert.equal(d.stays.length,1);assert.equal(d.extras.length,2);
 assert(d.extras.every(x=>x.stayId===d.stays[0].id&&x.method==='pendiente'));
 assert.equal(d.stays[0].payments[0].amount,22.5);
 assert.equal(t.dueOf(d.stays[0]),0);
 assert.equal(d.products.find(p=>p.id==='producto-002').stock,2);
 assert.equal(d.products.find(p=>p.id==='producto-003').stock,3);
 assert.equal(d.stockMoves.length,2);
 assert(t.stayHistoryEvents(d.stays[0]).some(x=>x.title.includes('Agua')));
});
test('Varios cargados en ingreso Por cobrar quedan pendientes y NO entran en caja',()=>{
 const d=setup([]);
 t.setUI({...t.getUI(),checkinVarios:[{key:'checkvar1',productId:'producto-002',quantity:'3',roomKey:'principal'}]});
 const form=bookingForm({paymentMethod:'por_cobrar',creditConfirmed:'si',cashTendered:'999',paymentAmount:'999'});
 fake['checkin-form']=wrapForm(form);
 t.processCheckin();
 assert.equal(d.stays[0].payments.length,0);
 assert.equal(d.extras.length,1);
 assert.equal(d.extras[0].quantity,3);
 assert.equal(t.dueOf(d.stays[0]),21.5);
 const local=new Date().toISOString().slice(0,10);
 assert.equal(t.cashTotals(local,'dia').cash,0);
});
test('Dos habitaciones con Varios distintos atribuyen cada cargo al cuarto correcto',()=>{
 const d=setup();
 t.setUI({...t.getUI(),checkinVarios:[
 {key:'checkvar1',productId:'producto-002',quantity:'1',roomKey:'principal'},
 {key:'checkvar2',productId:'producto-003',quantity:'2',roomKey:'batch1'}
 ]});
 const form=bookingForm({cashTendered:'54',changeStatus:'pendiente'});
 fake['checkin-form']=wrapForm(form);
 const plan=t.prepareCheckinGroup(form);
 assert.equal(plan.error,null);
 assert.equal(plan.grandTotal,52.5);
 assert.equal(plan.items[0].variosTotal,0.5);
 assert.equal(plan.items[1].variosTotal,2);
 assert.equal(plan.items[0].payment,20.5);
 assert.equal(plan.items[1].payment,32);
 assert.equal(plan.tender.change,1.5);
 t.processCheckin();
 assert.equal(d.extras.length,2);
 assert.equal(d.extras[0].stayId,d.stays[0].id);
 assert.equal(d.extras[1].stayId,d.stays[1].id);
 assert.equal(d.stays[0].payments[0].cashChange,1.5);
 assert.equal(d.stays[1].payments[0].cashChange,0);
 assert.equal(d.stays[0].payments[0].cashTendered+d.stays[1].payments[0].cashTendered,54);
 assert.equal(t.dueOf(d.stays[0]),0);assert.equal(t.dueOf(d.stays[1]),0);
});
test('Un producto sin precio o con cantidad inválida impide guardar el ingreso completo',()=>{
 for(const row of [
   {key:'checkvar1',productId:'producto-002',quantity:'0',roomKey:'principal'},
   {key:'checkvar1',productId:'producto-002',quantity:'1.5',roomKey:'principal'},
   {key:'checkvar1',productId:'producto-002',quantity:'1',roomKey:'hab-inexistente'}
 ]){
   const d=setup([]);
   t.setUI({...t.getUI(),checkinVarios:[row]});
   const form=bookingForm();
   const plan=t.prepareCheckinGroup(form);
   assert(plan.error);
   fake['checkin-form']=wrapForm(form);t.processCheckin();
   assert.equal(d.stays.length,0);assert.equal(d.extras.length,0);
 }
});
test('Stock compartido entre varios renglones se verifica antes de guardar',()=>{
 const d=setup([]),product=d.products.find(x=>x.id==='producto-002');
 product.stock=2;
 t.setUI({...t.getUI(),checkinVarios:[
 {key:'checkvar1',productId:product.id,quantity:'2',roomKey:'principal'},
 {key:'checkvar2',productId:product.id,quantity:'1',roomKey:'principal'}
 ]});
 const plan=t.prepareCheckinGroup(bookingForm());
 assert(plan.error&&/inventario insuficiente/i.test(plan.error));
 assert.equal(product.stock,2);
 assert.equal(d.stays.length,0);assert.equal(d.extras.length,0);
});
test('Transferencia descontada incluye Varios a precio normal, sin reducir los productos',()=>{
 const d=setup([]);
 t.setUI({...t.getUI(),checkinVarios:[{key:'checkvar1',productId:'producto-002',quantity:'2',roomKey:'principal'}]});
 const form=bookingForm({paymentMethod:'transferencia_descuento',transferCode:'TEST-VARIOS-DESC'});
 fake['checkin-form']=wrapForm(form);
 const plan=t.prepareCheckinGroup(form);
 assert.equal(plan.error,null);assert.equal(plan.total,17);
 assert.equal(plan.variosTotal,1);assert.equal(plan.grandTotal,18);
 t.processCheckin();
 assert.equal(d.stays[0].roomRate,17);
 assert.equal(d.stays[0].payments[0].method,'transferencia');
 assert.equal(d.stays[0].payments[0].amount,18);
 assert.equal(t.dueOf(d.stays[0]),0);
 assert.equal(d.extras[0].price,0.5);
});


test('La cédula se valida con provincia y dígito verificador módulo 10',()=>{
 const cases=[
   ['0102030400',true], // Secuencia sintética con estructura matemática válida
   ['0102030401',false], // Dígito final incorrecto
   ['0000000000',false], // Provincia inválida
   ['9902030400',false], // Provincia inexistente
   ['0162030400',false], // Tercer dígito inválido para cédula
   ['3040102034',true],  // Serie 30, inscripción consular, tercer dígito 4
   ['3051234569',true],  // Serie 30, inscripción consular, tercer dígito 5
   ['3010102031',false] // Serie 30 con tercer dígito no admitido
 ];
 for(const [document,expected] of cases)
   assert.equal(t.validDoc(document),expected,'Validación incorrecta para muestra sintética '+document);
});
test('Un RUC personal terminado en 001 hereda la validación de la cédula base',()=>{
 const good=t.checkEcuadorDocument('0102030400001');
 assert.equal(good.valid,true);
 assert.equal(good.canonical,'0102030400');
 assert.equal(good.kind,'ruc_persona_natural');
 for(const invalid of ['0102030401001','0102030400002','0102030400ABC','010203040000','01020304000011','1790000123001'])
   assert.equal(t.validDoc(invalid),false,'No debe aceptar '+invalid);
});
test('Una cédula y el RUC 001 del mismo titular no duplican su ficha',()=>{
 const db=setup([]);
 const data={firstName:'FAMILIA',lastName:'DE PRUEBA',secondName:'',secondLastName:'',
   document:'0102030400001',phone:'0990000000',email:''};
 const first=t.saveGuest(data);
 assert.equal(db.guests.length,1);
 assert.equal(t.getGuestByDocument('0102030400').id,first.id);
 assert.equal(t.getGuestByDocument('0102030400001').id,first.id);
 t.saveGuest({...data,document:'0102030400'});
 assert.equal(db.guests.length,1);
 assert.equal(db.guests[0].document,'0102030400001');
});
test('Efectivo es el pago inicial; por cobrar exige primero autorización marcada',()=>{
 const db=setup([]);
 assert(t.renderCheckin().includes('Confirmo que el pago se recibió'));
 const defaultPay=t.checkEcuadorDocument('0102030400');
 assert(defaultPay.valid);
 assert(t.renderCheckin().includes('checkin-payment-verified'));
 assert(t.renderCheckin().includes('checkin-credit-confirmed'));
 const f=bookingForm({paymentMethod:'por_cobrar',creditConfirmed:'',paymentVerified:''});
 const plan=t.prepareCheckinGroup(f);
 assert(plan.error&&/primera confirmación/i.test(plan.error));
 fake['checkin-form']=wrapForm(f);
 t.processCheckin();
 assert.equal(db.stays.length,0);
 assert.equal(db.guests.length,0);
});
test('Un pago no verificado impide registrar ingreso aunque figure como efectivo',()=>{
 const db=setup([]);
 const f=bookingForm({paymentVerified:'',cashTendered:'40'});
 assert(/confirma|confirmar|verific/i.test(t.prepareCheckinGroup(f).error));
 fake['checkin-form']=wrapForm(f);t.processCheckin();
 assert.equal(db.stays.length,0);
 assert.equal(db.rooms.find(r=>r.id==='room-02').status,'disponible');
});
test('El efectivo entregado debe declararse explícitamente antes del ingreso',()=>{
 const db=setup([]);
 const f=bookingForm({cashTendered:'',paymentVerified:'si'});
 assert(/efectivo recibido/i.test(t.prepareCheckinGroup(f).error));
 fake['checkin-form']=wrapForm(f);t.processCheckin();
 assert.equal(db.stays.length,0);
});
test('Una transferencia sin confirmación de acreditación se rechaza',()=>{
 const db=setup([]);
 const f=bookingForm({paymentMethod:'transferencia',transferCode:'TEST-REF',paymentVerified:''});
 const plan=t.prepareCheckinGroup(f);
 assert(/confirmar|verific/i.test(plan.error));
 fake['checkin-form']=wrapForm(f);t.processCheckin();
 assert.equal(db.stays.length,0);
});
test('La segunda confirmación rechazada NO escribe huéspedes, reservas ni caja',()=>{
 const db=setup([]);
 const f=bookingForm({paymentMethod:'por_cobrar',creditConfirmed:'si'});
 const previous=ctx.window.confirm;
 ctx.window.confirm=()=>false;
 try{
   fake['checkin-form']=wrapForm(f);t.processCheckin();
   assert.equal(db.stays.length,0);
   assert.equal(db.guests.length,0);
   assert.equal(db.extras.length,0);
   assert.equal(db.rooms.find(r=>r.id==='room-02').status,'disponible');
 }finally{ctx.window.confirm=previous;}
});
test('Por cobrar con doble confirmación guarda la excepción y saldo por habitación',()=>{
 const db=setup([]);
 const f=bookingForm({paymentMethod:'por_cobrar',creditConfirmed:'si',paymentVerified:''});
 const confirmations=[];
 const previous=ctx.window.confirm;
 ctx.window.confirm=msg=>{confirmations.push(msg);return true;};
 try{fake['checkin-form']=wrapForm(f);t.processCheckin();}
 finally{ctx.window.confirm=previous;}
 assert(confirmations.length>=1);
 assert(confirmations[0].includes('SEGUNDA CONFIRMACIÓN'));
 assert.equal(db.stays.length,1);
 assert.equal(db.stays[0].payments.length,0);
 assert.equal(db.stays[0].creditApproval?.mode,'doble_confirmacion');
 assert.equal(db.stays[0].creditApproval?.amount,20);
 assert.equal(t.dueOf(db.stays[0]),20);
 assert(t.stayHistoryEvents(db.stays[0]).some(x=>x.title==='Ingreso por cobrar autorizado'));
});
test('Los pagos correctos dejan verificación registrada y no requieren autorización de crédito',()=>{
 const db=setup([]);
 const f=bookingForm({paymentVerified:'si',cashTendered:'20'});
 fake['checkin-form']=wrapForm(f);t.processCheckin();
 assert.equal(db.stays.length,1);
 assert(db.stays[0].paymentVerifiedAt);
 assert.equal(db.stays[0].creditApproval,null);
 assert.equal(t.dueOf(db.stays[0]),0);
});


test('La sección Varios inicia cerrada con nombre, contador y total visible',()=>{
  setup([]);
  const html=t.renderCheckin();
  assert(html.includes('<details id="checkin-varios-panel"'));
  assert(!html.includes('id="checkin-varios-panel" class="group-rooms checkin-varios" aria-label="Varios para este huésped" open'));
  const summary=html.slice(html.indexOf('<summary class="checkin-varios-toggle">'),html.indexOf('</summary>'));
  assert(summary.includes('Varios para este mismo huésped'));
  assert(summary.includes('0 producto(s) seleccionados'));
  assert(summary.includes('Total de Varios'));
  assert(summary.includes('$0,00'));
  assert(html.includes('class="checkin-varios-content"'));
});
test('Al expandir Varios, se conservan buscador, artículos y subtotales',()=>{
  setup([]);
  const data=t.getUI();
  t.setUI({...data,checkinVariosOpen:true,checkinVarios:[
    {key:'checkvar1',productId:'producto-002',quantity:'2',roomKey:'principal'}
  ]});
  const html=t.renderCheckin();
  assert(html.includes('id="checkin-varios-panel" class="group-rooms checkin-varios" aria-label="Varios para este huésped" open'));
  const summary=html.slice(html.indexOf('<summary class="checkin-varios-toggle">'),html.indexOf('</summary>'));
  assert(summary.includes('1 producto(s) seleccionados'));
  assert(summary.includes('$1,00'));
  assert(html.includes('id="checkin-varios-search"'));
  assert(html.includes('checkvar1__qty'));
  assert(html.includes('Quitar'));
  assert.equal(t.quoteCheckinVarios(bookingForm()).total,1);
});
test('Cerrar el panel no elimina Varios ni invalida cálculos de hospedaje',()=>{
  setup([]);
  const data=t.getUI();
  t.setUI({...data,checkinVariosOpen:false,checkinVarios:[
    {key:'checkvar1',productId:'producto-002',quantity:'2',roomKey:'principal'}
  ]});
  const html=t.renderCheckin();
  assert(html.includes('1 producto(s) seleccionados'));
  assert(!html.includes('aria-label="Varios para este huésped" open'));
  const estimate=t.checkinGroupEstimate(bookingForm());
  assert.equal(estimate.variosTotal,1);
  assert.equal(estimate.grandTotal,51);
  assert.equal(t.getUI().checkinVarios.length,1);
});

console.log('Pruebas en memoria con cédulas ficticias; no se escriben datos en Supabase.');
