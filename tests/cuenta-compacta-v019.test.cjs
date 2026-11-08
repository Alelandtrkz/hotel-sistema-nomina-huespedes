'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail),'Cierre de app.js no coincide');
const source=original.trimEnd().slice(0,-tail.length)+
 '\nwindow.__roomV19={defaults,receptionShiftAt,receptionShift,compactQuantityStepper,renderBreakfastSection,renderAdditionalPersonSection,renderExtendStaySection,'+
 'extensionQuote,processBreakfast,processAdditionalPerson,processExtendStay,totalOf,dueOf,setDB:x=>{db=x;},getDB:()=>db};\n})();';
const RealDate=Date;
class FixedDate extends RealDate{
 constructor(...args){super(...(args.length?args:['2026-11-08T12:30:00.000Z']))}
 static now(){return RealDate.parse('2026-11-08T12:30:00.000Z')}
}
const records=[],elements={
 toasts:{append(node){records.push(node.textContent)}},
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},year:{textContent:''},
 'current-date':{textContent:''},sidebar:{classList:{remove(){}}}
},listeners={};
const document={
 getElementById(id){return elements[id]||null},
 querySelectorAll(){return []},querySelector(){return null},
 addEventListener(name,fn){listeners[name]=fn},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}},
 activeElement:null
};
class FakeFormData{constructor(el){this.values=el.data||{}}entries(){return Object.entries(this.values)}}
const window={confirm(){return true},scrollTo(){}};
const sandbox={document,window,Date:FixedDate,Intl,Number,Math,Array,String,Object,JSON,RegExp,
 localStorage:{getItem(){return null},setItem(){}},FormData:FakeFormData,setTimeout(){},
 URL,Blob,console};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:6000});
const api=window.__roomV19;
let fails=0;
function check(title,callback){
 try{callback();console.log('PASS',title)}
 catch(error){fails++;console.error('FAIL',title,error.stack||error)}
}
function feed(id,data){elements[id]={data}}
function makeStay(){
 const db=api.defaults(),room=db.rooms.find(r=>r.id==='room-01');room.status='ocupada';
 db.guests=[{id:'fake-guest-v19',firstName:'PRUEBA',lastName:'OPERACIONES',phone:'0990000000',document:'0102030400'}];
 db.stays=[{id:'fake-stay-v19',guestId:'fake-guest-v19',roomId:room.id,roomRate:20,roomTotal:40,
 arrival:'2026-11-08',departure:'2026-11-10',breakfast:'sin',status:'activa',advance:0,payments:[],
 createdAt:'2026-11-08T12:30:00.000Z'}];
 api.setDB(db);
 return {db,room,stay:db.stays[0]};
}
check('Turno Día inicia exactamente a 07:30 hora de El Coca',()=>{
 assert.equal(api.receptionShiftAt(new RealDate('2026-11-08T12:29:00Z')),'noche');
 assert.equal(api.receptionShiftAt(new RealDate('2026-11-08T12:30:00Z')),'dia');
});
check('Turno Día termina a las 19:30; fuera del rango es Noche',()=>{
 assert.equal(api.receptionShiftAt(new RealDate('2026-11-09T00:29:00Z')),'dia');
 assert.equal(api.receptionShiftAt(new RealDate('2026-11-09T00:30:00Z')),'noche');
 assert.equal(api.receptionShiftAt(new RealDate('2026-11-09T12:29:00Z')),'noche');
 assert.equal(api.receptionShift(),'dia');
});
check('Desayuno compacto incluye botones Lucide y ya no selector manual del turno',()=>{
 const {stay}=makeStay(),html=api.renderBreakfastSection(stay);
 assert(html.includes('class="lucide lucide-minus"'));
 assert(html.includes('class="lucide lucide-plus"'));
 assert(html.includes('data-target="room-breakfast-quantity"'));
 assert(html.includes('aria-label="Restar uno de Desayunos"'));
 assert(html.includes('Turno automático'));
 assert(!html.includes('id="room-breakfast-shift"'));
 assert(!html.includes('Cantidad de desayunos *'));
});
check('Persona adicional sin campo de nombre y con responsable y turno fechados',()=>{
 const {stay}=makeStay(),html=api.renderAdditionalPersonSection(stay);
 assert(!html.includes('name="name"'));
 assert(!html.includes('room-person-name'));
 assert(!html.includes('Nombre y apellido de la persona adicional'));
 assert(html.includes('class="compact-person-fields"'));
 assert(html.includes('id="room-person-operator"'));
 assert(html.includes('data-target="room-person-nights"'));
 assert(html.includes('Turno automático'));
 assert(html.includes('datetime="2026-11-08"'));
 assert(html.includes('07:30–19:30'));
 assert(!html.includes('id="room-person-shift"'));
});
check('Extensión recupera la tarjeta de fechas sobre el control de noches',()=>{
 const {stay}=makeStay(),html=api.renderExtendStaySection(stay);
 for(const label of ['Salida actual:','Nueva salida:','Importe:','Noches a extender'])assert(html.includes(label),label);
 assert(html.indexOf('id="room-extension-preview"')<html.indexOf('id="room-extension-nights"'));
 assert(html.includes('id="room-extension-new-date"'));
 assert(html.includes('id="room-extension-amount"'));
 assert(!html.includes('id="room-extension-shift"'));
 assert(html.includes('Turno automático'));
});
check('Clic en + y − modifica cantidad dentro de 1 a 100 sin registrar cargo',()=>{
 const {db}=makeStay();const input={value:'1',min:'1',max:'100'};
 elements['room-breakfast-quantity']=input;
 const trigger=delta=>{
   const target={dataset:{action:'step-room-quantity',target:'room-breakfast-quantity',step:String(delta)},
     closest(s){return s==='[data-action]'?this:null}};
   listeners.click({target});
 };
 trigger(1);assert.equal(input.value,'2');
 trigger(-1);assert.equal(input.value,'1');
 trigger(-1);assert.equal(input.value,'1');
 input.value='100';trigger(1);assert.equal(input.value,'100');
 assert.equal(db.extras.length,0);
 delete elements['room-breakfast-quantity'];
});
check('Turno se calcula en el momento de registrar desayuno, no acepta turno alterado del formulario',()=>{
 const {db,stay}=makeStay();
 feed('room-breakfast-form',{stayId:stay.id,quantity:'3',shift:'noche',operator:'RECEPCIÓN PRUEBA'});
 api.processBreakfast();
 assert.equal(db.extras.length,1);
 assert.equal(db.extras[0].quantity,3);assert.equal(db.extras[0].price,5);
 assert.equal(db.extras[0].shift,'dia');
 assert.equal(api.dueOf(stay),55);
 delete elements['room-breakfast-form'];
});
check('Persona adicional usa turno automático y cantidad de noches',()=>{
 const {stay}=makeStay();
 feed('room-person-form',{stayId:stay.id,name:'Acompañante ficticio',category:'adulto',nights:'2',shift:'noche'});
 api.processAdditionalPerson();
 assert.equal(stay.additionalPeople.length,1);
 assert.equal(stay.additionalPeople[0].amount,20);
 assert.equal(stay.additionalPeople[0].shift,'dia');
 delete elements['room-person-form'];
});
check('Extensión mantiene tarifa y valida tres noches; turno se calcula automáticamente',()=>{
 const {stay}=makeStay();
 assert.equal(api.extensionQuote(stay,3).newDeparture,'2026-11-13');
 feed('room-extension-form',{stayId:stay.id,nights:'3',shift:'noche'});
 api.processExtendStay();
 assert.equal(stay.departure,'2026-11-13');
 assert.equal(stay.extensions.length,1);
 assert.equal(stay.extensions[0].amount,60);
 assert.equal(stay.extensions[0].shift,'dia');
 assert.equal(api.totalOf(stay),100);
 delete elements['room-extension-form'];
});
if(fails)process.exitCode=1;
