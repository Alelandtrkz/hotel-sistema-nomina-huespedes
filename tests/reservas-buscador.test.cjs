'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail),'No se encontró el cierre del módulo');
const source=original.trimEnd().slice(0,-tail.length)+
 '\nwindow.__reservationTest={defaults,renderReservations,renderReservationGuestDialog,renderReservationGuestResults,reservationGuestMatches,openReservationGuestSearch,closeReservationGuestSearch,selectReservationGuest,setDB:v=>{db=v;},setUI:v=>{ui=v;},getUI:()=>ui,getDB:()=>db};\n})();';
const elements={
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},
 year:{textContent:''},'current-date':{textContent:''},
 sidebar:{classList:{remove(){}}}
};
const listeners={};
const doc={
 getElementById(id){return elements[id]||null;},
 querySelectorAll(){return []},querySelector(){return null;},
 addEventListener(name,callback){listeners[name]=callback;},
 createElement(){return {textContent:'',className:'',remove(){}};},
 activeElement:null
};
const win={scrollTo(){},confirm(){return true}};
const sandbox={document:doc,window:win,localStorage:{getItem(){return null},setItem(){}},
 Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,Map,Set,setTimeout(){},
 FormData:class {},URL,Blob,console};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:5000});
const t=win.__reservationTest;let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.stack||e);}}
const synthetic=[
 {id:'g-1',firstName:'José',secondName:'Manuel',lastName:'Pérez',secondLastName:'Lozano',document:'1203093214',phone:'0991234567'},
 {id:'g-2',firstName:'María',lastName:'Torres',document:'1804075834',phone:'0987654321'},
 {id:'g-3',firstName:'Ana <img src=x>',lastName:'García',document:'1500326457',phone:'0998765432'}
];
function setup(){
 const db=t.defaults();db.guests=synthetic.map(x=>({...x}));
 t.setDB(db);
 t.setUI({...t.getUI(),view:'reservas',reservationDraft:{name:'',phone:'',document:'',arrival:'2026-11-20',departure:'2026-11-23',type:'triple',breakfast:'sin',advance:'12'},
  reservationGuestSearchOpen:false,reservationGuestSearchQuery:''});
 return db;
}
test('Crear reserva incluye botón Buscar y no abre ventana por defecto',()=>{
 setup();const html=t.renderReservations();
 assert(html.includes('data-action="open-reservation-guest-search"'));
 assert(html.includes('name="document"'));assert(!html.includes('id="reservation-guest-dialog"'));
});
test('Búsqueda por cédula, nombre sin tildes y teléfono',()=>{
 setup();
 assert.equal(t.reservationGuestMatches('120309')[0].id,'g-1');
 assert.equal(t.reservationGuestMatches('jose manuel')[0].id,'g-1');
 assert.equal(t.reservationGuestMatches('torres')[0].id,'g-2');
 assert.equal(t.reservationGuestMatches('098765')[0].id,'g-2');
 assert.equal(t.reservationGuestMatches('x').length,0);
});
test('La apertura del modal conserva borrador y precarga el documento escrito',()=>{
 setup();t.setUI({...t.getUI(),reservationDraft:{...t.getUI().reservationDraft,document:'120309'}});
 t.openReservationGuestSearch();
 const html=t.renderReservationGuestDialog();
 assert(html.includes('role="dialog"'));assert(html.includes('aria-modal="true"'));
 assert(html.includes('value="120309"'));assert(html.includes('José'));
 assert.equal(t.getUI().reservationDraft.type,'triple');
});
test('Seleccionar huésped completa nombre, teléfono y documento sin cambiar noches ni anticipo',()=>{
 const db=setup();t.openReservationGuestSearch();t.selectReservationGuest('g-1');
 const draft=t.getUI().reservationDraft;
 assert.equal(draft.name,'José Manuel Pérez Lozano');
 assert.equal(draft.document,'1203093214');assert.equal(draft.phone,'0991234567');
 assert.equal(draft.arrival,'2026-11-20');assert.equal(draft.departure,'2026-11-23');
 assert.equal(draft.type,'triple');assert.equal(draft.advance,'12');
 assert.equal(t.getUI().reservationGuestSearchOpen,false);
 assert.equal(db.guests.length,3);assert.equal(db.reservations.length,0);
});
test('Al cerrar no se pierden datos de la reserva ni se crean fichas nuevas',()=>{
 const db=setup();t.openReservationGuestSearch();t.closeReservationGuestSearch();
 assert.equal(t.getUI().reservationDraft.type,'triple');
 assert.equal(t.getUI().reservationGuestSearchOpen,false);
 assert.equal(db.guests.length,3);
});
test('Los nombres se muestran escapados y no permiten inyectar HTML',()=>{
 setup();const html=t.renderReservationGuestResults('ana');
 assert(html.includes('&lt;img'));assert(!html.includes('<img'));
});
test('Escape cierra el modal sin alterar la reserva',()=>{
 setup();t.openReservationGuestSearch();
 let prevented=false;
 listeners.keydown({key:'Escape',preventDefault(){prevented=true},target:{id:'reservation-guest-search-input'}});
 assert(prevented);assert.equal(t.getUI().reservationGuestSearchOpen,false);
 assert.equal(t.getUI().reservationDraft.advance,'12');
});
test('El resultado puede seleccionarse mediante la acción delegada',()=>{
 setup();t.openReservationGuestSearch();
 const target={dataset:{action:'select-reservation-guest',id:'g-2'},classList:{contains(){return false}},
  closest(sel){return sel==='[data-action]'?this:null}};
 listeners.click({target});
 assert.equal(t.getUI().reservationDraft.name,'María Torres');
});

test('Crear reserva aparece cerrado por defecto y la nómina queda fuera de la sección plegable',()=>{
 setup();const html=t.renderReservations();
 const details=html.indexOf('<details class="reservation-create-details"');
 const summary=html.indexOf('<summary class="reservation-create-summary">');
 const form=html.indexOf('id="reservation-form"');
 const close=html.indexOf('</details>',form);
 const roster=html.indexOf('<h2>Nómina de reservas</h2>');
 assert(details>=0&&summary>details&&form>summary&&close>form&&roster>close);
 assert(!html.slice(details,summary).includes(' open'));
 assert(html.includes('Mostrar formulario'));assert(html.includes('Ocultar formulario'));
 assert(html.includes('id="reservation-search-button"'));
 assert(html.includes('Condiciones de reserva'));
});
test('El estado abierto se conserva tras re-render y al buscar un huésped',()=>{
 setup();listeners.toggle({target:{id:'reservation-create-details',open:true}});
 assert.equal(t.getUI().reservationCreateOpen,true);
 let html=t.renderReservations();
 assert.match(html,/<details class="reservation-create-details" id="reservation-create-details" open>/);
 t.openReservationGuestSearch();t.selectReservationGuest('g-1');
 assert.equal(t.getUI().reservationCreateOpen,true);
 assert.equal(t.getUI().reservationDraft.name,'José Manuel Pérez Lozano');
 html=t.renderReservations();
 assert(html.includes('id="reservation-create-details" open'));
});
test('Plegar no modifica los datos de la reserva y permite reabrir',()=>{
 const db=setup();
 listeners.toggle({target:{id:'reservation-create-details',open:true}});
 t.setUI({...t.getUI(),reservationDraft:{...t.getUI().reservationDraft,name:'Titular de prueba',advance:'17'}});
 listeners.toggle({target:{id:'reservation-create-details',open:false}});
 assert.equal(t.getUI().reservationCreateOpen,false);
 assert.equal(t.getUI().reservationDraft.name,'Titular de prueba');
 assert.equal(t.getUI().reservationDraft.advance,'17');
 assert.equal(db.reservations.length,0);
 listeners.toggle({target:{id:'reservation-create-details',open:true}});
 assert(t.renderReservations().includes('value="Titular de prueba"'));
});

if(failures)process.exitCode=1;
