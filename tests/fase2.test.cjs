'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(source.trimEnd().endsWith(tail),'Marcador final de app.js no coincide');
const exposed=source.trimEnd().slice(0,-tail.length) +
  '\nwindow.__fase2={getDB:()=>db,setDB:d=>{db=d;},defaults,asMoney,addIsoDays,extraPeopleOf:additionalPeopleOf,extensionTotalOf,stayHistoryEvents,extensionBlocker,' +
  'renderRoomAccount,renderClosedHistoryDialog,renderFinalAccountSection,renderStayTimeline,' +
  'processRoomExtra,processAdditionalPerson,processExtendStay,processFinalSettlement,finishStay,processPayment,totalOf,paidOf,dueOf,pendingChangeOf,cashTotals,renderCheckout};\n})();';
let messages=[],alerts=[],confirms=[],allowConfirm=true;
const elements={
 'toasts':{append(node){messages.push(node.textContent);}},
 'app-view':{innerHTML:''},'breadcrumb':{textContent:''},
 'sidebar':{classList:{remove(){}}},'year':{textContent:''},'current-date':{textContent:''}
};
const doc={
  getElementById(id){return elements[id]||null;},
  querySelectorAll(){return [];},querySelector(){return null},
  addEventListener(){},createElement(){return {className:'',textContent:'',remove(){}};}
};
const storage={};
const loc={getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}};
const win={scrollTo(){},confirm(msg){confirms.push(msg);return allowConfirm;},alert(msg){alerts.push(msg);}};
const fakeForm=class{constructor(el){this.obj=el.data||{};}entries(){return Object.entries(this.obj);}};
const sandbox={window:win,document:doc,localStorage:loc,console,Date,Intl,Number,Math,Array,String,Object,JSON,RegExp,
 setTimeout(){},FormData:fakeForm,URL,Blob};
vm.createContext(sandbox);vm.runInContext(exposed,sandbox,{timeout:4000});
const t=win.__fase2;
function feed(form,data){elements[form]={data};}
function success(title,fn){
  try{fn();console.log('PASS',title);}
  catch(e){console.error('FAIL',title,e.stack||e);process.exitCode=1;}
}
function base(){
 const d=t.defaults(),r=d.rooms.find(x=>x.id==='room-01');
 r.status='ocupada';
 d.guests=[{id:'fake-guest',firstName:'PRUEBA',secondName:'',lastName:'FICTICIA',secondLastName:'',document:'0000000000',phone:'0990000000'}];
 d.stays=[{id:'fake-stay',guestId:'fake-guest',roomId:r.id,type:'matrimonial',status:'activa',
  arrival:'2026-11-07',departure:'2026-11-09',roomRate:39,roomTotal:78,advance:0,payments:[],
  breakfast:'sin',createdAt:'2026-11-07T14:00:00.000Z'}];
 return d;
}
let d=base();t.setDB(d);let s=d.stays[0];
success('Las cuentas previas sin campos adicionales siguen sumando correctamente',()=>{
 assert.equal(t.totalOf(s),78);assert.equal(t.dueOf(s),78);
 assert.equal(t.extraPeopleOf(s),0);assert.equal(t.extensionTotalOf(s),0);
});
success('Agregar un producto a Hab. 01 genera cargo sin pago inmediato',()=>{
 feed('room-extra-form',{stayId:s.id,productId:'producto-002',quantity:'1',shift:'dia'});
 t.processRoomExtra();
 assert.equal(d.extras.length,1);assert.equal(d.extras[0].stayId,s.id);
 assert.equal(d.extras[0].price,0.5);assert.equal(d.extras[0].method,'pendiente');
 assert.equal(t.totalOf(s),78.5);assert.equal(t.dueOf(s),78.5);
});
success('Niño adicional, dos noches, tarifa configurada $5: cargo $10',()=>{
 feed('room-person-form',{stayId:s.id,name:'ACOMPAÑANTE FICTICIO',category:'nino',nights:'2',shift:'dia',operator:'PRUEBA'});
 t.processAdditionalPerson();
 assert.equal(s.additionalPeople.length,1);
 assert.equal(s.additionalPeople[0].amount,10);
 assert.equal(t.totalOf(s),88.5);
});
success('Adulto adicional una noche: cargo $10',()=>{
 feed('room-person-form',{stayId:s.id,name:'ADULTO DE PRUEBA',category:'adulto',nights:'1',shift:'dia'});
 t.processAdditionalPerson();
 assert.equal(s.additionalPeople[1].unitPrice,10);assert.equal(s.additionalPeople[1].amount,10);
 assert.equal(t.totalOf(s),98.5);
});
success('No permite cargar más noches de acompañante que la estadía',()=>{
 feed('room-person-form',{stayId:s.id,name:'PRUEBA',category:'adulto',nights:'3'});
 t.processAdditionalPerson();
 assert.equal(s.additionalPeople.length,2);assert.equal(t.totalOf(s),98.5);
});
success('Una reserva futura impide extender la habitación',()=>{
 d.reservations=[{id:'future-booking',roomId:s.roomId,status:'confirmada',arrival:'2026-11-09',departure:'2026-11-10'}];
 feed('room-extension-form',{stayId:s.id,shift:'dia'});
 t.processExtendStay();
 assert.equal(s.departure,'2026-11-09');assert.equal(s.roomTotal,78);
 assert.equal((s.extensions||[]).length,0);
});
success('Extender un día sin conflicto añade exactamente la tarifa de la estadía',()=>{
 d.reservations=[];
 t.processExtendStay();
 assert.equal(s.departure,'2026-11-10');assert.equal(s.roomTotal,117);
 assert.equal(s.extensions.length,1);assert.equal(s.extensions[0].amount,39);
 assert.equal(t.totalOf(s),137.5);assert.equal(t.dueOf(s),137.5);
});
success('La ficha presenta cinco operaciones y el desglose de acompañantes',()=>{
 const html=t.renderRoomAccount(d.rooms.find(r=>r.id===s.roomId),s);
 for(const word of ['Agregar varios','Agregar persona adicional','Extender estadía','Cierre de cuenta final',
 'Historial de movimientos','ACOMPAÑANTE FICTICIO','137,50'])assert(html.includes(word),'Falta '+word);
});
success('Historial incluye todos los cargos sin duplicar la noche extendida',()=>{
 const entries=t.stayHistoryEvents(s);
 assert(entries.some(x=>x.title.includes('Noche adicional')));
 assert(entries.filter(x=>x.title.includes('Persona adicional')).length===2);
 assert(entries.some(x=>x.title.includes('Varios')));
 assert.equal(entries.filter(x=>x.kind==='cargo').reduce((a,x)=>a+x.amount,0),137.5);
});
success('Abono parcial conserva saldo y deja registro de caja',()=>{
 feed('payment-form',{stayId:s.id,amount:'20',cashTendered:'20',method:'efectivo',shift:'dia'});
 t.processPayment();assert.equal(t.dueOf(s),117.5);assert.equal(s.payments.length,1);
});
success('Cerrar en un único pago aplica el saldo, calcula vuelto y envía a limpieza',()=>{
 feed('finalize-form',{stayId:s.id,operator:'RECEPCIÓN PRUEBA',method:'efectivo',shift:'dia',cashTendered:'120',changeStatus:'dado'});
 t.processFinalSettlement();
 assert.equal(s.payments.length,2);assert.equal(s.payments[1].amount,117.5);
 assert.equal(s.payments[1].cashTendered,120);assert.equal(s.payments[1].cashChange,2.5);
 assert.equal(s.status,'finalizada');assert.equal(t.dueOf(s),0);
 assert.equal(d.rooms.find(r=>r.id===s.roomId).status,'limpieza');
 assert.equal(s.closureSummary.total,137.5);assert.equal(s.closureSummary.balance,0);
});
success('Historial final incluye cobro, vuelto y cierre',()=>{
 const events=t.stayHistoryEvents(s);
 assert(events.some(x=>x.title==='Cuenta cerrada y salida'));
 assert(events.some(x=>x.title==='Vuelto entregado'));
 assert(t.renderClosedHistoryDialog(s).includes('Historial de movimientos'));
});
success('Pago final con vuelto pendiente registra obligación a favor del huésped',()=>{
 d=base();t.setDB(d);s=d.stays[0];s.roomTotal=39;s.departure='2026-11-08';
 feed('finalize-form',{stayId:s.id,operator:'PRUEBA',method:'efectivo',shift:'dia',cashTendered:'40',changeStatus:'pendiente'});
 t.processFinalSettlement();
 assert.equal(s.status,'finalizada');assert.equal(t.pendingChangeOf(s),1);
 assert.equal(t.dueOf(s),0);assert.equal(s.closureSummary.cashChangePending,1);
});
success('Rechazo del cierre cancela el movimiento sin generar pagos',()=>{
 d=base();t.setDB(d);s=d.stays[0];allowConfirm=false;
 feed('finalize-form',{stayId:s.id,operator:'PRUEBA',method:'efectivo',shift:'dia',cashTendered:'78'});
 t.processFinalSettlement();
 assert.equal(s.status,'activa');assert.equal(s.payments.length,0);
 assert.equal(d.rooms.find(r=>r.id===s.roomId).status,'ocupada');
 allowConfirm=true;
});
success('Cierre de cuenta saldada no genera otro pago',()=>{
 d=base();t.setDB(d);s=d.stays[0];
 s.payments.push({id:'fake-paid',amount:78,method:'transferencia',reference:'FAKE',shift:'dia',createdAt:'2026-11-07T15:00:00Z'});
 feed('finalize-form',{stayId:s.id,operator:'PRUEBA',shift:'dia'});
 t.processFinalSettlement();
 assert.equal(s.status,'finalizada');assert.equal(s.payments.length,1);assert.equal(t.dueOf(s),0);
});
success('El historial conserva navegación de más de 30 salidas',()=>{
 d=base();d.stays=Array.from({length:31},(_,i)=>({...d.stays[0],
  id:'fake-closed-'+i,status:'finalizada',actualCheckout:'2026-11-'+String(30-i%20).padStart(2,'0')+'T12:00:00Z'
 }));
 t.setDB(d);
 const html=t.renderCheckout();
 assert(html.includes('Página 1 de 2'),'Debe indicar dos páginas');
 assert.equal(html.split('data-action="show-stay-history"').length-1,30,'Debe mostrar 30 acciones de historial por página');
 assert(html.includes('Más antiguas'),'Debe permitir consultar salidas anteriores');
});
console.log('Todos los datos utilizados son ficticios; Supabase no fue modificado en estas pruebas.');
