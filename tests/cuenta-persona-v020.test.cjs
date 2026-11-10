'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail),'No coincide el cierre del módulo');
const exposed=original.trimEnd().slice(0,-tail.length)+
 '\nwindow.__v20={defaults,receptionShiftAt,automaticShiftHint,renderAdditionalPersonSection,processAdditionalPerson,renderRoomAccount,stayHistoryEvents,totalOf,dueOf,setDB:x=>{db=x;}};\n})();';
const clock={value:'2026-11-08T12:30:00.000Z'};
const RealDate=Date;
class FakeDate extends RealDate{
 constructor(...args){super(...(args.length?args:[clock.value]));}
 static now(){return RealDate.parse(clock.value)}
}
const messages=[],nodes={
 toasts:{append(n){messages.push(n.textContent)}},'app-view':{innerHTML:''},breadcrumb:{textContent:''},
 year:{textContent:''},'current-date':{textContent:''},sidebar:{classList:{remove(){}}}
};
const document={
 getElementById:id=>nodes[id]||null,querySelectorAll(){return []},querySelector(){return null},
 addEventListener(){},createElement(){return {textContent:'',className:'',remove(){},append(){}}}
};
const window={confirm(){return true},scrollTo(){}};
class FormDataFake{constructor(el){this.data=el.data||{}}entries(){return Object.entries(this.data)}}
const context={window,document,Date:FakeDate,Intl,Number,Math,String,Array,Object,JSON,RegExp,
 localStorage:{getItem(){return null},setItem(){}},FormData:FormDataFake,setTimeout(){},URL,Blob,console};
vm.createContext(context);vm.runInContext(exposed,context,{timeout:5000});
const api=window.__v20;let fails=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(err){fails++;console.error('FAIL',name,err.stack||err)}}
function base(){
 const db=api.defaults(),room=db.rooms.find(r=>r.id==='room-01');
 room.status='ocupada';
 db.guests=[{id:'persona-ficticia',firstName:'PRUEBA',lastName:'HOSPEDAJE',phone:'0900000000',document:'0000000000'}];
 db.stays=[{id:'estadía-ficticia',guestId:'persona-ficticia',roomId:room.id,
 arrival:'2026-11-08',departure:'2026-11-10',roomRate:20,roomTotal:40,
 status:'activa',breakfast:'sin',advance:0,payments:[],createdAt:'2026-11-08T12:00:00.000Z'}];
 api.setDB(db);return {db,room,stay:db.stays[0]};
}
test('Persona adicional no solicita nombre ni apellido',()=>{
 const {stay}=base(),html=api.renderAdditionalPersonSection(stay);
 assert(!html.includes('id="room-person-name"'));
 assert(!html.includes('name="name"'));
 assert(!html.includes('Nombre y apellido'));
 assert(html.includes('class="compact-person-fields"'));
 assert(html.includes('name="operator"'));
 assert(html.includes('name="category"'));
});
test('Registra adulto sin nombre y conserva el cálculo y el saldo',()=>{
 const {stay}=base();
 nodes['room-person-form']={data:{stayId:stay.id,category:'adulto',nights:'2',operator:'Recepción'}};
 api.processAdditionalPerson();
 assert.equal(stay.additionalPeople.length,1);
 assert.equal(stay.additionalPeople[0].name,'');
 assert.equal(stay.additionalPeople[0].amount,20);
 assert.equal(api.dueOf(stay),60);
 assert(api.renderRoomAccount(api.defaults().rooms.find(r=>r.id===stay.roomId)||{number:'01',type:'individual',status:'ocupada'},stay).includes('Acompañante'));
 delete nodes['room-person-form'];
});
test('Registra niño sin nombre y conserva su tarifa $5 por noche',()=>{
 const {stay}=base();
 nodes['room-person-form']={data:{stayId:stay.id,category:'nino',nights:'2',operator:'Recepción'}};
 api.processAdditionalPerson();
 assert.equal(stay.additionalPeople[0].amount,10);
 assert.equal(api.totalOf(stay),50);
 delete nodes['room-person-form'];
});
test('Los movimientos anteriores con nombre permanecen visibles',()=>{
 const {room,stay}=base();
 stay.additionalPeople=[{id:'previo',name:'HUESPED HISTÓRICO',category:'adulto',nights:1,
 amount:10,unitPrice:10,createdAt:'2026-11-08T12:30:00.000Z'}];
 assert(api.renderRoomAccount(room,stay).includes('HUESPED HISTÓRICO'));
 assert(api.stayHistoryEvents(stay).some(e=>e.description.includes('HUESPED HISTÓRICO')));
});
test('Fecha y turno se muestran con la fecha de El Coca, no la fecha UTC',()=>{
 base();clock.value='2026-11-09T02:30:00.000Z';
 const html=api.automaticShiftHint();
 assert(html.includes('datetime="2026-11-08"'));
 assert(html.includes('Noche'));
 assert(html.includes('20:00–08:00'));
 assert(!html.includes('datetime="2026-11-09"'));
});
test('El indicador actualiza la fecha cuando cambia el día en Ecuador',()=>{
 clock.value='2026-11-09T05:30:00.000Z';
 const html=api.automaticShiftHint();
 assert(html.includes('datetime="2026-11-09"'));
 assert(html.includes('Noche'));
});
test('El turno de día a las 08:00 coincide con la fecha del indicador',()=>{
 clock.value='2026-11-09T13:00:00.000Z';
 const html=api.automaticShiftHint();
 assert(html.includes('datetime="2026-11-09"'));
 assert(html.includes('Día'));
 assert(html.includes('08:00–20:00'));
});
if(fails)process.exitCode=1;
