const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(source.trimEnd().endsWith(tail), 'End marker of app missing');
const code=source.trimEnd().slice(0,-tail.length) + `
window.__test={
 getDB:()=>db,setDB:d=>{db=d;},defaults,
 resolveTendered,paidCashRecord,pendingChangeOf,changeMovements,cashTotals,roomTile,renderRoomAccount,
 processPayment,processCheckin,processReservation,processExtra,processManualExtra,renderRooms,renderCash,renderCheckout,
 totalOf,paidOf,dueOf,updateCashPreview
};
})();`;
let messages=[];
const fakeEls={
 'toasts':{append(node){messages.push(node.textContent);}},
 'app-view':{innerHTML:''},'breadcrumb':{textContent:''},'sidebar':{classList:{remove(){}}},
 'year':{textContent:''},'current-date':{textContent:''}
};
const document={getElementById(id){return fakeEls[id]||null;},querySelectorAll(){return []},
 querySelector(){return null},addEventListener(){},createElement(){return {className:'',textContent:'',remove(){}}}}
const storage={};const localStorage={getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}};
const context={window:{scrollTo(){},confirm(){return true}},document,localStorage,console,Date,Intl,Number,Math,Array,String,Object,JSON,RegExp,setTimeout(){},FormData:class{constructor(e){this.obj=e.data||{};}entries(){return Object.entries(this.obj)}},URL,Blob};
vm.createContext(context);vm.runInContext(code,context);
const t=context.window.__test;
const ok=(title,fn)=>{try{fn();console.log('PASS',title)}catch(e){console.error('FAIL',title,':',e.message);process.exitCode=1}};
const today=new Date().toISOString();
const localday=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-');
const q=f=>{fakeEls['payment-form']={data:f}};
let db=t.defaults();db.guests=[{id:'g-fake',document:'0000000000',firstName:'PRUEBA',lastName:'FICTICIA',phone:'0990000000'}];
db.rooms.find(x=>x.id==='room-01').status='ocupada';
db.stays.push({id:'s-test',guestId:'g-fake',roomId:'room-01',status:'activa',roomRate:39,roomTotal:39,advance:0,payments:[],arrival:'2026-11-07',departure:'2026-11-08',type:'matrimonial',breakfast:'con',createdAt:today});
t.setDB(db);
ok('Calcula 39 cobrado, 40 recibido, vuelto de 1',()=>{
 const r=t.resolveTendered('40','efectivo','39','pendiente');
 assert.equal(r.received,40);assert.equal(r.change,1);assert.equal(r.status,'pendiente');
});
ok('Rechaza efectivo insuficiente',()=>{
 const r=t.resolveTendered('38','efectivo','39','dado');assert(r.error);
});
ok('Exige estado si hay vuelto',()=>{
 const r=t.resolveTendered('40','efectivo','39','');assert(r.error);
});
ok('Transferencia nunca genera vuelto',()=>{
 const r=t.resolveTendered('100','transferencia','39','pendiente');assert.equal(r.received,39);assert.equal(r.change,0);
});
ok('Cobra 39 y guarda 40 con 1 pendiente',()=>{
 q({stayId:'s-test',amount:'39',cashTendered:'40',changeStatus:'pendiente',method:'efectivo',shift:'dia'});
 t.processPayment();
 const s=db.stays[0],p=s.payments[0];
 assert.equal(t.paidOf(s),39);assert.equal(t.dueOf(s),0);
 assert.equal(p.cashTendered,40);assert.equal(p.cashChange,1);assert.equal(p.changeStatus,'pendiente');
 assert.equal(t.pendingChangeOf(s),1);
});
ok('Caja incluye 40 recibido y 1 pendiente (no descuento aun)',()=>{
 const c=t.cashTotals(localday,'dia');assert.equal(c.cash,40);assert.equal(c.changeGiven,0);assert.equal(c.changePendingTotal,1);assert.equal(c.out,0);
});
ok('Vuelto marcado como dado descuenta 1 y liquida pendiente',()=>{
 const p=db.stays[0].payments[0];p.changeStatus='dado';p.changeDeliveredAt=today;p.changeDeliveredShift='dia';
 const c=t.cashTotals(localday,'dia');assert.equal(c.cash,40);assert.equal(c.changeGiven,1);assert.equal(c.out,1);assert.equal(c.changePendingTotal,0);
 assert.equal(c.cash-c.out,39);
});
ok('Alojamiento sin pagar muestra tarjeta roja-azul y saldo',()=>{
 const s=db.stays[0];s.payments=[];
 const card=t.roomTile(db.rooms.find(x=>x.id==='room-01'));
 assert(card.includes('occupied-due'));assert(card.includes('Por cobrar'));assert(card.includes('39,00'));
});
ok('Cuenta de habitación incluye tarifa, huésped, saldo y formulario de cobro',()=>{
 const room=db.rooms.find(x=>x.id==='room-01');const stay=db.stays[0];
 const markup=t.renderRoomAccount(room,stay);
 for(const x of ['PRUEBA','Saldo por cobrar','Cuenta','cashTendered','Vuelto dado','Agregar varios','Registrar pago'])assert(markup.includes(x),x);
});
ok('Varios reabre saldo y aparece como movimiento',()=>{
 db.extras.push({id:'e1',stayId:'s-test',productName:'Agua',price:0.5,quantity:1,category:'bebidas',createdAt:today});
 assert.equal(t.totalOf(db.stays[0]),39.5);assert.equal(t.dueOf(db.stays[0]),39.5);
 assert(t.renderRoomAccount(db.rooms[0],db.stays[0]).includes('Agua'));
});
ok('Dos cobros en efectivo con vuelto entregado cuadran caja',()=>{
 db.stays[0].payments=[];db.extras=[];
 q({stayId:'s-test',amount:'39',cashTendered:'50',changeStatus:'dado',method:'efectivo',shift:'dia'});
 t.processPayment();const p=db.stays[0].payments[0];assert.equal(p.cashChange,11);
 const c=t.cashTotals(localday,'dia');assert.equal(c.cash,50);assert.equal(c.changeGiven,11);assert.equal(c.out,11);assert.equal(c.cash-c.out,39);
});
ok('Estado ocupado pagado ya no tiene franja azul',()=>{
 const card=t.roomTile(db.rooms.find(x=>x.id==='room-01'));assert(!card.includes('occupied-due'));
});
console.log('Test results stored entirely offline; no real guests or Supabase writes performed.');