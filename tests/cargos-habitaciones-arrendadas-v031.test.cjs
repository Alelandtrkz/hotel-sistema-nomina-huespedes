'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const end='  render();\n})();';
assert(src.trimEnd().endsWith(end));
const expose=src.trimEnd().slice(0,-end.length)+
 '\nwindow.__rentalsV31={defaults,renderRoomAccount,renderRoomExtraSection,renderRentedRoomAccount,appendExtra,'+
 'processRoomExtra,processManualExtra,roomTile,renderExtras,resolveExtraDestination,rentalDueOf,paidDirect,'+
 'productOf,destinations,receptionShiftAt,roomOf,stayOf,extrasOf,setDB:x=>{db=x;},getDB:()=>db};\n})();';
const notices=[],listeners={},nodes={
 toasts:{append(node){notices.push(node.textContent)}},
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},year:{textContent:''},
 'current-date':{textContent:''},sidebar:{classList:{remove(){}}}
};
const document={
 getElementById(id){return nodes[id]||null},
 querySelectorAll(){return []},querySelector(){return null},
 addEventListener(event,fn){listeners[event]=fn},
 createElement(){return {textContent:'',className:'',remove(){},append(){}}},
 activeElement:null
};
const window={confirm(){return true},scrollTo(){},
 hotelCash:{canOperate(){return false},active(){return null}}};
class FakeFormData{constructor(el){this.fields=el.data||{}}entries(){return Object.entries(this.fields)}}
const sandbox={window,document,Date,Intl,Number,Math,Array,String,Object,JSON,RegExp,
 localStorage:{getItem(){return null},setItem(){}},FormData:FakeFormData,
 setTimeout(){},URL,Blob,console};
vm.createContext(sandbox);vm.runInContext(expose,sandbox,{timeout:7000});
const api=window.__rentalsV31,db=api.defaults();api.setDB(db);
const rental=db.rooms.find(r=>r.type==='arrendada'&&r.status==='arrendada');
const water=db.products.find(p=>p.name==='Agua ½ litro');
assert(rental&&water);
water.stockNevera=4;water.stockBodega=0;water.stock=4;
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(err){failures++;console.error('FAIL',name,err.stack||err)}}
test('Arrendadas permanecen fuera de hospedaje y muestran cuenta',()=>{
 assert.equal(rental.status,'arrendada');
 const html=api.renderRoomAccount(rental,null);
 assert(html.includes('Consumos pendientes de la habitación arrendada'));
 assert(html.includes('id="room-extra-form"'));
 assert(html.includes('id="rental-manual-extra-form"'));
 assert(html.includes('name="stayId" value="arrendada:'+rental.id+'"'));
 assert(html.includes('Buscar producto'));assert(html.includes('Escanear código'));
 assert(html.includes('Saldo por cobrar'));
});
test('Varios incluye arrendadas sin tratarlas como caja',()=>{
 assert(api.destinations().some(([value,label])=>value==='arrendada:'+rental.id&&label.includes('Arrendada')));
 assert.equal(api.resolveExtraDestination('arrendada:'+rental.id).rentalRoomId,rental.id);
 assert(api.resolveExtraDestination('arrendada:room-no-existe').error);
 assert(api.resolveExtraDestination('arrendada:room-01').error);
});
test('Agua se carga a arrendada como pendiente, sin efectivo',()=>{
 assert.equal(api.appendExtra({stayId:'arrendada:'+rental.id,quantity:'2',method:'efectivo',operator:'Recepción'},water),true);
 assert.equal(db.extras.length,1);
 const e=db.extras[0];
 assert.equal(e.rentalRoomId,rental.id);assert.equal(e.stayId,'');
 assert.equal(e.method,'pendiente');assert.equal(e.cashTendered,0);
 assert.equal(e.cashChange,0);assert.equal(api.paidDirect(e),false);
 assert.equal(api.rentalDueOf(rental.id),1);assert.equal(water.stockNevera,2);
 assert.equal(db.stockMoves.length,1);assert(db.stockMoves[0].note.includes('arrendada'));
});
test('Cuenta y mapa muestran el saldo de agua arrendada',()=>{
 const html=api.renderRoomAccount(rental,null),tile=api.roomTile(rental);
 assert(html.includes('Agua ½ litro'));assert(html.includes('$1,00'));
 assert(tile.includes('Por cobrar'));assert(tile.includes('room-tile arrendada'));
 assert(api.renderExtras().includes('Arrendada Hab. '+rental.number));
 assert(api.renderExtras().includes('Pendiente en cuenta'));
});
test('Cargo manual se acumula sin cambiar estado de arrendada',()=>{
 nodes['rental-manual-extra-form']={data:{stayId:'arrendada:'+rental.id,name:'Lavandería',
   category:'otros',amount:'3.50',operator:'Recepción'}};
 api.processManualExtra('rental-manual-extra-form');
 assert.equal(db.extras.length,2);assert.equal(db.extras[1].method,'pendiente');
 assert.equal(db.extras[1].rentalRoomId,rental.id);assert.equal(db.extras[1].cashTendered,0);
 assert.equal(api.rentalDueOf(rental.id),4.5);assert.equal(rental.status,'arrendada');
 delete nodes['rental-manual-extra-form'];
});
test('Formulario con escáner carga el producto a la arrendada',()=>{
 nodes['room-extra-form']={data:{stayId:'arrendada:'+rental.id,productId:water.id,quantity:'1',operator:'Turno'}};
 api.processRoomExtra();
 assert.equal(db.extras.length,3);assert.equal(db.extras[2].rentalRoomId,rental.id);
 assert.equal(db.extras[2].method,'pendiente');assert.equal(api.rentalDueOf(rental.id),5);
 assert.equal(water.stockNevera,1);delete nodes['room-extra-form'];
});
test('Stock insuficiente se rechaza sin alterar saldo',()=>{
 const before=db.extras.length;
 assert.equal(api.appendExtra({stayId:'arrendada:'+rental.id,quantity:'20',method:'efectivo'},water),false);
 assert.equal(db.extras.length,before);assert.equal(water.stockNevera,1);
});
test('Venta directa sigue bloqueada cuando caja está cerrada',()=>{
 const before=db.extras.length;
 assert.equal(api.appendExtra({stayId:'caja',quantity:'1',method:'efectivo'},water),false);
 assert.equal(db.extras.length,before);
});
test('Consumos de huéspedes siguen ligados a estadías activas',()=>{
 const room=db.rooms.find(r=>r.type==='flex_aire');room.status='ocupada';
 db.stays=[{id:'s-test',roomId:room.id,status:'activa',arrival:'2026-11-09',departure:'2026-11-10',
   roomTotal:20,roomRate:20,advance:0,payments:[]}];
 assert.equal(api.appendExtra({stayId:'s-test',quantity:'1',method:'efectivo'},water),true);
 const e=db.extras.at(-1);
 assert.equal(e.stayId,'s-test');assert.equal(e.rentalRoomId,'');
 assert.equal(e.method,'pendiente');assert.equal(api.paidDirect(e),false);
 assert.equal(api.extrasOf('s-test'),water.price);assert.equal(api.rentalDueOf(rental.id),5);
});
test('Corte de día hasta 22:59 y noche a las 23:00 hora Ecuador',()=>{
 assert.equal(api.receptionShiftAt(new Date('2026-11-10T12:59:00Z')),'noche');
 assert.equal(api.receptionShiftAt(new Date('2026-11-10T13:00:00Z')),'dia');
 assert.equal(api.receptionShiftAt(new Date('2026-11-11T03:59:00Z')),'dia');
 assert.equal(api.receptionShiftAt(new Date('2026-11-11T04:00:00Z')),'noche');
});
if(failures)process.exitCode=1;
