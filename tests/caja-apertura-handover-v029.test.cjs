'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const app=read('app.js'),cloud=read('cloud.js'),cash=read('cash.js'),sql=read('supabase/migrations/20261109_cash_shift_open_handover_v029.sql'),
  sync=read('supabase/migrations/20261109_cash_session_version_sync_v029.sql'),
  shiftSql=read('supabase/migrations/20261109_cash_shifts_0800_2000_v030.sql'),css=read('styles.css');
new Function(app);new Function(cloud);new Function(cash);
let failed=0;
function test(name,fn){
 try{fn();console.log('PASS',name)}catch(error){failed++;console.error('FAIL',name,error.stack||error);}
}
const nodes={};
const root={listeners:{},addEventListener(name,fn){this.listeners[name]=fn}};
nodes['app-view']=root;
const store={opened:0,closed:0,payload:null};
const sessions=[{
 id:'s1',cashbox:'recepcion',shift_date:'2026-11-09',shift:'noche',status:'abierta',
 opened_at:'2026-11-10T01:00:00.000Z',opening_operator:'Recepcionista',
 opening_float:25,expected_from_previous:null,opening_variance:0
}];
const api={
 async list(){return sessions.map(s=>({...s}))},
 async open(f){store.opened++;store.payload=f;return {...sessions[0]}},
 async close(f){store.closed++;store.payload=f;return {...sessions[0],status:'cerrada'}}
};
const w={hotelCloud:{ready:true,cashApi:api},confirm(){return true},alert(){},scrollTo(){}};
class FakeFormData{constructor(form){this.fields=form.data||{}}entries(){return Object.entries(this.fields)}}
const fakeDocument={getElementById:id=>nodes[id]||null,createElement(){return {click(){},remove(){}}},body:{append(){}}};
const sandbox={window:w,document:fakeDocument,FormData:FakeFormData,Intl,Date,Array,Map,Set,Math,Number,JSON,Object,String,Promise,Blob,URL,console,setTimeout(){}};
vm.createContext(sandbox);vm.runInContext(cash,sandbox,{timeout:3500});
const mod=w.hotelCash;
const session={...sessions[0]};
const changes=[
 {source:'stay',id:'pay1',label:'Hab. 27',owner:{cashChange:20,changeStatus:'dado',changeDeliveredAt:'2026-11-10T06:30:00Z'}},
 {source:'stay',id:'pay2',label:'Hab. 28',owner:{cashChange:3,changeStatus:'pendiente'}}
];
const db={
 reservations:[{advance:20,advanceMethod:'efectivo',createdAt:'2026-11-10T01:00:00Z'},
    {advance:20,advanceMethod:'efectivo',createdAt:'2026-11-11T01:00:00Z'}],
 stays:[{roomId:'r27',payments:[
   {amount:20,method:'efectivo',cashTendered:40,createdAt:'2026-11-10T06:20:00Z'},
   {amount:10,method:'transferencia',createdAt:'2026-11-10T06:35:00Z'},
   {amount:55,method:'efectivo',createdAt:'2026-11-10T13:00:00Z'}
 ]}],
 extras:[{stayId:'',method:'efectivo',price:5,quantity:1,productName:'Agua',category:'bebidas',createdAt:'2026-11-10T09:00:00Z'}],
 cashMovements:[{amount:2,createdAt:'2026-11-10T11:00:00Z'}],
 closures:[{date:'2026-11-01',shift:'dia',operator:'A',expected:42,variance:0}]
};
const begin=app.indexOf('  function cashSessionTotals(session){'),end=app.indexOf('  function cashSessionAllowed(){',begin);
if(begin<0||end<=begin)throw Error('No se encontró cálculo de sesión');
const mk=new Function('db','roomOf','paidDirect','asMoney','changeMovements',
  app.slice(begin,end)+'\nreturn cashSessionTotals;');
const sum=mk(db,()=>({number:'27'}),e=>!e.stayId,(x)=>Math.round(Number(x||0)*100)/100,()=>changes);
const helper={
 sessionTotals:sum,head:(crumb,title,desc,button)=>'<header><h1>'+title+'</h1>'+button+'</header>',
 btn:(label,action,cls,opts='')=>'<button data-action="'+action+'" '+opts+'>'+label+'</button>',
 field:()=>'',select:()=>'',changeMovements:()=>changes,changePending:p=>p.changeStatus==='pendiente'?p.cashChange:0
};
test('Sólo una caja abierta por recepción, asignada al turno canónico',()=>{
 assert(sql.includes('hotel_one_open_cashbox'));
 assert(sql.includes('unique(cashbox,shift_date,shift)'));
 assert(sql.includes("status='abierta'"));
 assert(shiftSql.includes("time '08:00'"));
 assert(shiftSql.includes("time '20:00'"));
});
test('El horario de noche sigue en la misma jornada después de medianoche',()=>{
 const shift=mod.currentShiftInfo(new Date('2026-11-10T06:00:00Z'));
 assert.equal(shift.shift,'noche');assert.equal(shift.date,'2026-11-09');
 assert.equal(mod.currentShiftInfo(new Date('2026-11-10T12:59:00Z')).shift,'noche');
 assert.equal(mod.currentShiftInfo(new Date('2026-11-10T13:00:00Z')).shift,'dia');
 assert.equal(mod.currentShiftInfo(new Date('2026-11-11T00:59:00Z')).shift,'dia');
 assert.equal(mod.currentShiftInfo(new Date('2026-11-11T01:00:00Z')).shift,'noche');
 assert.equal(mod.currentShiftInfo(new Date('2026-11-11T01:00:00Z')).date,'2026-11-10');
});
test('Se suman cobros nocturnos dentro del rango real incluso pasada medianoche',()=>{
 const period={...session,closed_at:'2026-11-10T12:20:00Z'};
 const x=sum(period);
 assert.equal(x.cash,65);
 assert.equal(x.transfer,10);
 assert.equal(x.changeGiven,20);
 assert.equal(x.otherOut,2);
 assert.equal(x.out,22);
});
test('Fondo inicial de vuelto se suma al efectivo esperado, sin ser venta',()=>{
 const x=mod.summary({...session,closed_at:'2026-11-10T12:20:00Z'},db,helper);
 assert.equal(x.base,25);
 assert.equal(x.expected,68); // 25 fondo + 65 efectivo - 20 de vueltos - 2 de retiros
 assert.equal(x.transfer,10);
});
test('RPC de cierre verifica revisión y fondo reservado para siguiente turno',()=>{
 assert(sql.includes('p_next_float>p_counted'));
 assert(sql.includes('v_expected:=v_session.opening_float+p_cash_in-v_out'));
 assert(sql.includes('withdrawn=p_counted-p_next_float'));
 assert(sql.includes('v_revision is distinct from p_expected_revision'));
 assert(sync.includes('revision=revision+1'));
 assert(cloud.includes('revision=Number(r.data.state_revision)'));
});
test('Solo administrador autorizado puede iniciar o finalizar una sesión',()=>{
 assert(sql.includes("s.active=true and s.role='admin'"));
 assert(sql.includes('enable row level security'));
 assert(sql.includes('revoke all on public.hotel_cash_sessions from anon,authenticated'));
 assert(sql.includes('grant select on public.hotel_cash_sessions to authenticated'));
 assert(sql.includes('revoke all on function public.hotel_cash_open'));
});
test('La nueva interfaz tiene apertura, cierre, historia y monto a traspasar',()=>{
 mod.state.sessions=[session];mod.state.loaded=true;
 const html=mod.render(db,helper);
 assert(html.includes('Apertura y cierre de caja'));
 assert(html.includes('Cerrar caja'));
 assert(html.includes('Fondo inicial para vueltos'));
 assert(html.includes('$25,00'));
 assert(html.includes('EFECTIVO ESPERADO'));
 assert(html.includes('Cierres anteriores al nuevo control'));
 assert(html.includes('Vueltos pendientes'));
});
test('Formulario de cierre pide arqueo y fondo siguiente, no permite editar después',()=>{
 mod.state.modal='close';
 const html=mod.render(db,helper);
 assert(html.includes('cash-session-close-form'));
 assert(html.includes('name="counted"'));
 assert(html.includes('name="next_float"'));
 assert(html.includes('Confirmar cierre definitivo'));
});
test('La apertura en caja cerrada requiere conteo físico de sueltos',()=>{
 mod.state.sessions=[];mod.state.modal='open';
 const html=mod.render(db,helper);
 assert(html.includes('cash-session-open-form'));
 assert(html.includes('Fondo de cambio contado'));
 assert(html.includes('El fondo inicial no es una venta'));
 assert(html.includes('name="operator"'));
});
test('Las operaciones con dinero quedan bloqueadas hasta abrir caja y fuera del turno',()=>{
 mod.state.sessions=[];
 assert.equal(mod.canOperate(),false);
 mod.state.sessions=[session];
 // La jornada de la prueba es de otro día, así que tampoco se permite operar.
 assert.equal(mod.canOperate(),false);
 assert(app.includes('if(!cashSessionAllowed())return;'));
 assert(app.includes("if(!stayId&&!cashSessionAllowed())return false;"));
 assert(app.includes("if(advance>0&&!cashSessionAllowed())return;"));
});
test('Se mantiene el cierre histórico sin reescribirlo',()=>{
 assert(app.includes('if(window.hotelCash)return window.hotelCash.render'));
 assert(cash.includes('Cierres anteriores al nuevo control'));
 assert(!cash.includes('db.closures.push'));
});
test('El navegador actualiza cash.js antes del app.js y evita claves privadas',()=>{
 assert(cloud.indexOf('cashScript.onload=function()')<cloud.indexOf('script.src="./app.js?v=0.29-apertura"'));
 assert(!/service_role\s*[:=]\s*['"]/.test(cloud));
 assert(css.includes('.cash-modal-overlay'));
});
if(failed)process.exitCode=1;
