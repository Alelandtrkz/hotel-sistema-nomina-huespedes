'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail),'Cambió el marcador de cierre de app.js');
const source=original.trimEnd().slice(0,-tail.length)+
  '\nwindow.__roomsTest={defaults,roomOverviewCounts,renderRoomsOverview,renderRooms,activeStays,roomOf,dueOf,setDB:value=>{db=value;},setUI:value=>{ui=value;},getUI:()=>ui};\n})();';
const items={
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},year:{textContent:''},
 'current-date':{textContent:''},sidebar:{classList:{remove(){}}}
};
const listeners={};
const doc={
 getElementById(id){return items[id]||null;},querySelectorAll(){return [];},querySelector(){return null;},
 addEventListener(event,handler){listeners[event]=handler;},
 createElement(){return {textContent:'',className:'',remove(){}};}
};
const storage={};
const sandbox={window:{scrollTo(){},confirm(){return true}},document:doc,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,val){storage[k]=val}},
 Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,setTimeout(){},FormData:class {},URL,Blob,console};
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{timeout:5000});
const t=sandbox.window.__roomsTest;
let failed=false;
function test(name,fn){try{fn();console.log('PASS',name);}catch(error){failed=true;console.error('FAIL',name,error.stack||error);}}
function dateOffset(n){
 const d=new Date();
 d.setDate(d.getDate()+n);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function setup(){
 const db=t.defaults(),rooms=db.rooms;
 // Two occupied rooms, one of them with outstanding balance.
 rooms.find(r=>r.id==='room-01').status='ocupada';
 rooms.find(r=>r.id==='room-02').status='ocupada';
 rooms.find(r=>r.id==='room-03').status='limpieza';
 db.stays=[
  {id:'stay-a',roomId:'room-01',guestId:'fake-guest',status:'activa',arrival:dateOffset(-1),departure:dateOffset(1),
   roomRate:20,roomTotal:20,advance:0,payments:[],createdAt:new Date().toISOString()},
  {id:'stay-b',roomId:'room-02',guestId:'fake-guest2',status:'activa',arrival:dateOffset(-1),departure:dateOffset(1),
   roomRate:20,roomTotal:20,advance:0,payments:[{amount:20,method:'efectivo',createdAt:new Date().toISOString()}],
   createdAt:new Date().toISOString()}
 ];
 db.reservations=[
  {id:'booking-a',roomId:'room-04',status:'pendiente',arrival:dateOffset(2),departure:dateOffset(3)},
  {id:'booking-b',roomId:'room-04',status:'confirmada',arrival:dateOffset(4),departure:dateOffset(5)},
  {id:'booking-c',roomId:'room-07',status:'confirmada',arrival:dateOffset(1),departure:dateOffset(2)},
  {id:'booking-old',roomId:'room-08',status:'confirmada',arrival:dateOffset(-5),departure:dateOffset(-4)},
  {id:'booking-canceled',roomId:'room-10',status:'cancelada',arrival:dateOffset(1),departure:dateOffset(2)},
  {id:'booking-alojada',roomId:'room-11',status:'alojada',arrival:dateOffset(1),departure:dateOffset(2)},
  {id:'booking-no-room',roomId:'',status:'confirmada',arrival:dateOffset(1),departure:dateOffset(2)},
  {id:'booking-arrendada',roomId:'room-05',status:'pendiente',arrival:dateOffset(1),departure:dateOffset(2)}
 ];
 t.setDB(db);
 t.setUI({...t.getUI(),selectedRoomId:null,roomFilter:'todos',roomTypeFilter:'todos'});
 return db;
}
test('Cuenta ocupadas, limpias, X/C y reservadas con habitaciones únicas',()=>{
 const db=setup(),v=t.roomOverviewCounts();
 assert.equal(v.occupied,2);
 assert.equal(v.clean,db.rooms.filter(r=>r.status==='disponible').length);
 assert.equal(v.owing,1);
 assert.equal(v.receivable,20);
 assert.equal(v.reserved,2,'No debe duplicar reservas para una misma habitación ni incluir reservas vencidas');
});
test('X/C es parte de Ocupadas y se actualiza cuando se registra un pago',()=>{
 const db=setup();
 db.stays[0].payments.push({amount:20,method:'transferencia',createdAt:new Date().toISOString()});
 assert.equal(t.roomOverviewCounts().owing,0);
 assert.equal(t.roomOverviewCounts().occupied,2);
 assert.equal(t.roomOverviewCounts().receivable,0);
});
test('Limpias significa disponibles y no incluye pendientes de limpieza ni arrendadas',()=>{
 const db=setup(),before=t.roomOverviewCounts();
 db.rooms.find(r=>r.id==='room-03').status='disponible';
 assert.equal(t.roomOverviewCounts().clean,before.clean+1);
 const room=db.rooms.find(r=>r.id==='room-05');
 assert.equal(room.status,'arrendada');
 assert(!db.rooms.filter(r=>r.status==='disponible').includes(room));
});
test('El resumen se muestra antes del mapa, con cuatro tarjetas del panel general',()=>{
 setup();
 const html=t.renderRooms();
 const summary=html.indexOf('class="metrics rooms-overview"');
 const map=html.indexOf('Mapa de habitaciones');
 assert(summary>0&&map>summary);
 const indicators=html.slice(summary,map);
 for(const word of ['Ocupadas','Limpias','X/C','Reservadas','ocupadas','Por cobrar'])
   assert(indicators.toLowerCase().includes(word.toLowerCase()),'Debe mostrar '+word);
 assert.equal((indicators.match(/class="metric rooms-kpi /g)||[]).length,4);
});
test('El mapa y los filtros Todos los estados y Todos los tipos permanecen operativos',()=>{
 setup();
 const full=t.renderRooms();
 assert(full.includes('Mapa de habitaciones'));
 assert(full.includes('id="filter-room-status"'));
 assert(full.includes('id="filter-room-type"'));
 assert(full.includes('Todos los estados'));
 assert(full.includes('Todos los tipos'));
 assert(full.includes('class="room-grid"'));
 assert(full.includes('data-action="select-room"'));
 t.setUI({...t.getUI(),roomFilter:'ocupada'});
 const filtered=t.renderRooms();
 assert(filtered.includes('class="metrics rooms-overview"'));
 assert(filtered.includes('id="filter-room-status"'));
 assert(filtered.includes('Ocupadas'));
 assert(filtered.includes('class="room-grid"'));
});
test('Un cuarto ocupado puede tener también una reserva futura, sin cambiar el mapa',()=>{
 const db=setup();
 db.reservations.push({id:'future-for-occupied',roomId:'room-01',status:'confirmada',
   arrival:dateOffset(2),departure:dateOffset(3)});
 const counts=t.roomOverviewCounts();
 assert.equal(counts.occupied,2);
 assert.equal(counts.reserved,3);
 assert.equal(db.rooms.find(r=>r.id==='room-01').status,'ocupada');
});
test('Las cuatro tarjetas son botones y cada una apunta al filtro correcto',()=>{
 setup();
 const html=t.renderRoomsOverview();
 for(const [filter,label] of [['ocupada','Ocupadas'],['disponible','Limpias'],['por-cobrar','X/C'],['reservadas','Reservadas']]){
   const pos=html.indexOf('data-action="filter-room-summary" data-id="'+filter+'"');
   assert(pos>0,'Falta botón para '+label);
   assert(html.slice(pos,pos+250).includes('aria-pressed="false"'),'Debe indicar el estado sin seleccionar');
 }
 assert.equal((html.match(/data-action="filter-room-summary"/g)||[]).length,4);
});
test('El selector de estado también permite Reservadas y conserva el selector de tipos',()=>{
 setup();
 const html=t.renderRooms();
 const status=html.slice(html.indexOf('id="filter-room-status"'),html.indexOf('id="filter-room-type"'));
 assert(status.includes('Reservadas'));
 assert(html.includes('Todos los estados'));
 assert(html.includes('Todos los tipos'));
});
test('Al pulsar cada tarjeta cambia el mapa de habitaciones y queda marcada visualmente',()=>{
 setup();
 assert.equal(typeof listeners.click,'function','Debe existir un manejador de clic');
 let scrolls=0;
 items['room-map']={scrollIntoView(){scrolls++;}};
 const press=filter=>{
   listeners.click({target:{closest(selector){
     return selector==='[data-action]'?{dataset:{action:'filter-room-summary',id:filter}}:null;
   }}});
 };
 for(const [filter,expected] of [
   ['ocupada',2],['disponible',t.roomOverviewCounts().clean],
   ['por-cobrar',1],['reservadas',2]
 ]){
   press(filter);
   assert.equal(t.getUI().roomFilter,filter);
   const view=t.renderRooms();
   const count=(view.match(/class="room-tile /g)||[]).length;
   assert.equal(count,expected,'Número de habitaciones incorrecto al seleccionar '+filter);
   assert(view.includes('data-action="filter-room-summary" data-id="'+filter+'" aria-pressed="true"'));
 }
 assert.equal(scrolls,4);
 press('reservadas'); // La segunda pulsación desactiva el filtro.
 assert.equal(t.getUI().roomFilter,'todos');
 assert(t.renderRooms().includes('Todos los estados'));
});
test('Reservadas muestra los cuartos asignados a reservas futuras, no crea otro estado físico',()=>{
 const db=setup();
 t.setUI({...t.getUI(),roomFilter:'reservadas'});
 let html=t.renderRooms();
 assert(html.includes('data-id="room-04"'));
 assert(html.includes('data-id="room-07"'));
 assert(!html.includes('data-id="room-08"'));
 assert(!html.includes('data-id="room-05"'));
 assert.equal(db.rooms.find(r=>r.id==='room-04').status,'disponible');
 db.reservations.push({id:'booking-future-occupied',roomId:'room-01',status:'confirmada',
   arrival:dateOffset(2),departure:dateOffset(3)});
 html=t.renderRooms();
 assert.equal((html.match(/class="room-tile /g)||[]).length,3);
});
test('El filtro de tipo se respeta al pulsar una tarjeta y el mapa sigue permitiendo abrir cuartos',()=>{
 setup();
 t.setUI({...t.getUI(),roomTypeFilter:'flex_aire',roomFilter:'ocupada'});
 const html=t.renderRooms();
 assert(html.includes('class="metrics rooms-overview"'));
 assert(html.includes('Todos los tipos'));
 assert.equal((html.match(/class="room-tile /g)||[]).length,2); // Las habitaciones 01 y 02 son flex_aire.
});
if(failed)process.exitCode=1;
console.log('Solo escenarios ficticios. No se modifica Supabase ni se registran datos reales.');
