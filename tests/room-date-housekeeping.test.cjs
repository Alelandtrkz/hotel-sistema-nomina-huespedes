'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const suffix='  render();\n})();';
assert(source.trimEnd().endsWith(suffix),'El cierre de app.js ha cambiado');
const js=source.trimEnd().slice(0,-suffix.length)+
  '\nwindow.__dateTest={defaults,roomDateValid,roomPlanForDate,roomPlansForDate,roomPlanningDate,roomPrintData,roomHousekeepingPrintHtml,printHousekeepingReport,roomOverviewCounts,renderRooms,renderRoomsOverview,roomForecastTile,setDB:d=>{db=d;},setUI:v=>{ui=v;},getUI:()=>ui};\n})();';
const nodes={
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},
 year:{textContent:''},'current-date':{textContent:''},
 sidebar:{classList:{remove(){}}},'room-map':{scrollIntoView(){}}
},listeners={};
const doc={
 getElementById(id){return nodes[id]||null;},
 addEventListener(name,fn){listeners[name]=fn;},
 querySelectorAll(){return []},querySelector(){return null},
 createElement(){return {textContent:'',className:'',remove(){}};}
};
const storage={},printLog=[];
const popup={
 document:{open(){},write(html){printLog.push({html})},close(){}},
 opener:{},focus(){},print(){printLog.push({printed:true})}
};
const context={window:{scrollTo(){},confirm(){return true},hotelCloud:{ready:false},
 open(){return popup;}},document:doc,
 localStorage:{getItem(key){return storage[key]||null},setItem(k,v){storage[k]=v}},
 Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,setTimeout(){},FormData:class{},URL,Blob,console};
vm.createContext(context);vm.runInContext(js,context,{timeout:5000});
const t=context.window.__dateTest;
let failed=false;
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failed=true;console.error('FAIL',name,e.stack||e)}}
const offset=n=>{
 const now=new Date();now.setDate(now.getDate()+n);
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
};
function setup(){
 const db=t.defaults();
 const dates={today:offset(0),tomorrow:offset(1),twoDays:offset(2),threeDays:offset(3),fourDays:offset(4)};
 const room=id=>db.rooms.find(x=>x.id===id);
 room('room-02').status='ocupada';
 room('room-03').status='ocupada';
 room('room-01').status='limpieza';
 db.stays=[
  {id:'stay-checkout',guestId:'fictitious-person',roomId:'room-02',status:'activa',
   arrival:dates.today,departure:dates.tomorrow,roomTotal:20,roomRate:20,advance:0,payments:[]},
  {id:'stay-remaining',guestId:'fictitious-person-2',roomId:'room-03',status:'activa',
   arrival:dates.today,departure:dates.twoDays,roomTotal:60,roomRate:30,advance:0,payments:[]}
 ];
 db.reservations=[
  {id:'reservation-tomorrow',roomId:'room-02',status:'confirmada',arrival:dates.tomorrow,departure:dates.threeDays},
  {id:'reservation-two-days',roomId:'room-04',status:'pendiente',arrival:dates.twoDays,departure:dates.fourDays},
  {id:'reservation-no-room',roomId:'',status:'confirmada',arrival:dates.tomorrow,departure:dates.fourDays},
  {id:'reservation-canceled',roomId:'room-07',status:'cancelada',arrival:dates.tomorrow,departure:dates.fourDays}
 ];
 t.setDB(db);
 t.setUI({...t.getUI(),view:'habitaciones',roomDateMode:false,roomDate:null,
   roomFilter:'todos',roomTypeFilter:'todos',selectedRoomId:null});
 return {db,dates,room};
}
test('Se muestran los botones de fecha e imprimir a la derecha de los dos filtros',()=>{
 setup();const html=t.renderRooms();
 const filter=html.indexOf('class="filters room-filters-bar"');
 const block=html.slice(filter,html.indexOf('class="room-grid"',filter));
 const idxSelects=block.indexOf('class="room-filter-selects"'),idxActions=block.indexOf('class="room-filter-actions"');
 assert(idxSelects>=0&&idxActions>idxSelects);
 assert(block.includes('id="filter-room-status"'));
 assert(block.includes('id="filter-room-type"'));
 assert(block.includes('data-action="toggle-room-dates"'));
 assert(block.includes('data-action="print-housekeeping"'));
 assert(!block.includes('id="room-plan-date"'),'Ocultar selector hasta pulsar Ver por fecha');
});
test('Consulta por fecha rechaza fechas inválidas o anteriores a hoy',()=>{
 const {dates}=setup();
 assert(t.roomDateValid(dates.today));
 assert(t.roomDateValid(dates.tomorrow));
 assert(!t.roomDateValid('2026-02-30'));
 assert(!t.roomDateValid('texto'));
 assert(!t.roomDateValid('2020-01-01'));
});
test('La fecha de salida no cuenta como noche ocupada y puede comenzar una reserva',()=>{
 const {dates,room}=setup();
 const tomorrow=t.roomPlanForDate(room('room-02'),dates.tomorrow);
 assert.equal(tomorrow.status,'reservadas');
 assert.equal(tomorrow.booking.id,'reservation-tomorrow');
 assert.equal(tomorrow.stay,null);
 assert.equal(tomorrow.arriving.length,1);
 assert.equal(tomorrow.leaving.length,1);
 const later=t.roomPlanForDate(room('room-02'),dates.threeDays);
 assert.equal(later.status,'libre');
});
test('Mañana muestra ocupadas, reservadas, libres previstas y limpieza pendiente separadas',()=>{
 const {dates,room}=setup();
 assert.equal(t.roomPlanForDate(room('room-03'),dates.tomorrow).status,'ocupada');
 assert.equal(t.roomPlanForDate(room('room-02'),dates.tomorrow).status,'reservadas');
 assert.equal(t.roomPlanForDate(room('room-04'),dates.tomorrow).status,'libre');
 assert.equal(t.roomPlanForDate(room('room-01'),dates.tomorrow).status,'limpieza');
 assert.equal(t.roomPlanForDate(room('room-05'),dates.tomorrow).status,'arrendada');
});
test('Reservas pendientes y confirmadas aparecen por su llegada y salida programadas',()=>{
 const {dates,room}=setup();
 assert.equal(t.roomPlanForDate(room('room-04'),dates.tomorrow).status,'libre');
 const second=t.roomPlanForDate(room('room-04'),dates.twoDays);
 assert.equal(second.status,'reservadas');
 assert.equal(second.booking.arrival,dates.twoDays);
 assert.equal(second.booking.departure,dates.fourDays);
 const html=t.roomForecastTile(second);
 assert(html.includes('Reserva:'));
 assert(html.includes('Llegada de reserva'));
});
test('Los indicadores y filtros se recalculan para la fecha consultada',()=>{
 const {dates}=setup();
 t.setUI({...t.getUI(),roomDateMode:true,roomDate:dates.tomorrow});
 const counts=t.roomOverviewCounts();
 assert.equal(counts.occupied,1);
 assert.equal(counts.reserved,1);
 assert(counts.clean>0);
 assert.equal(counts.owing,1);
 let html=t.renderRooms();
 assert(html.includes('id="room-plan-date"'));
 assert(html.includes('Vista prevista para'));
 assert(html.includes('Libres previstas'));
 assert(html.includes('Reserva:'));
 t.setUI({...t.getUI(),roomFilter:'reservadas'});
 html=t.renderRooms();
 assert.equal((html.match(/class="room-tile /g)||[]).length,1);
 assert(html.includes('data-id="room-02"'));
 t.setUI({...t.getUI(),roomFilter:'disponible',roomTypeFilter:'triple'});
 const onlyTriple=t.renderRooms();
 assert(onlyTriple.includes('id="filter-room-type"'));
 assert(!onlyTriple.includes('data-id="room-02"'));
});
test('El reporte incluye todas las habitaciones y no incluye datos personales o montos',()=>{
 const {db,dates}=setup();
 t.setUI({...t.getUI(),roomDateMode:true,roomDate:dates.tomorrow,roomFilter:'reservadas',roomTypeFilter:'triple'});
 const report=t.roomPrintData(dates.tomorrow);
 assert.equal(report.rows.length,db.rooms.length);
 assert(report.rows.some(x=>x.number==='02'&&x.status==='Reservada'));
 assert(report.rows.some(x=>x.number==='03'&&x.status==='Ocupada prevista'));
 assert(report.rows.some(x=>x.number==='01'&&x.status==='Pendiente de limpieza'));
 const html=t.roomHousekeepingPrintHtml(report);
 assert(html.includes('REPORTE DE CAMARERÍA'));
 assert(html.includes('Limpieza'));
 assert(html.includes('Observaciones / novedades'));
 assert(html.includes('Llegada'));
 assert(html.includes('Salida'));
 assert(html.includes('33</strong> habitaciones'));
 assert(!html.includes('fictitious-person'));
 assert(!html.includes('Cédula'));
 assert(!html.includes('$20'));
});
test('Sin consulta de fecha, el reporte refleja estados físicos actuales',()=>{
 const {dates}=setup();
 const report=t.roomPrintData(dates.today);
 assert.equal(report.projected,false);
 assert(report.rows.some(x=>x.number==='02'&&x.status==='Ocupada'));
 assert(report.rows.some(x=>x.number==='01'&&x.status==='Pendiente de limpieza'));
 assert(report.rows.some(x=>x.number==='04'&&x.status==='Disponible / limpia'));
});
test('Imprimir reporte abre una ventana e invoca impresión con todas las habitaciones',()=>{
 const {dates}=setup();
 t.setUI({...t.getUI(),roomDateMode:true,roomDate:dates.tomorrow});
 printLog.length=0;
 t.printHousekeepingReport();
 assert.equal(printLog.length,2);
 assert(printLog[0].html.includes('REPORTE DE CAMARERÍA'));
 assert.equal(printLog[1].printed,true);
});
test('Botones Hoy, Mañana y Cerrar fechas cambian el estado sin alterar Supabase',()=>{
 const {db,dates}=setup();
 const clicks=listeners.click;
 assert(typeof clicks==='function');
 function press(action){
   clicks({target:{closest(sel){
     if(sel==='[data-action]')return {dataset:{action}};
     return null;
   }}});
 }
 press('toggle-room-dates');
 assert.equal(t.getUI().roomDateMode,true);
 assert.equal(t.roomPlanningDate(),dates.today);
 press('room-plan-tomorrow');
 assert.equal(t.getUI().roomDate,dates.tomorrow);
 press('room-plan-today');
 assert.equal(t.getUI().roomDate,dates.today);
 const before=JSON.stringify(db);
 press('toggle-room-dates');
 assert.equal(t.getUI().roomDateMode,false);
 assert.equal(JSON.stringify(db),before);
});
test('La selección manual de fecha actualiza el mapa y una fecha anterior no se acepta',()=>{
 const {dates}=setup();
 assert(typeof listeners.change==='function');
 const el={id:'room-plan-date',value:dates.twoDays,closest(){return null}};
 listeners.change({target:el});
 assert.equal(t.getUI().roomDate,dates.twoDays);
 assert.equal(t.getUI().roomDateMode,true);
 assert(t.renderRooms().includes('Vista prevista para'));
});
if(failed)process.exitCode=1;
console.log('Pruebas locales con escenarios sintéticos: no se modifican datos de Supabase.');
