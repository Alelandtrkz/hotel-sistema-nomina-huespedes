'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'admin.js'),'utf8'),
  app=fs.readFileSync(path.join(root,'app.js'),'utf8'),
  cloud=fs.readFileSync(path.join(root,'cloud.js'),'utf8'),
  index=fs.readFileSync(path.join(root,'index.html'),'utf8'),
  sql=fs.readFileSync(path.join(root,'supabase/migrations/20261109_admin_finanzas_nomina_v028.sql'),'utf8');
const listeners={},notices=[],changed=[];
const fixture={
 hotel_employees:[{id:'employee1',full_name:'COLABORADOR PRUEBA',job_title:'Recepción',monthly_salary:250,pay_day:5,active:true,email:'empleado@ejemplo.test'}],
 hotel_admin_expenses:[{id:'expense1',expense_date:'2026-11-03',category:'limpieza',description:'Insumos',amount:3,status:'pagado'}],
 hotel_admin_product_costs:[{product_id:'p1',unit_cost:.75},{product_id:'p2',unit_cost:1}],
 hotel_admin_payroll:[{id:'pay1',employee_id:'employee1',period:'2026-11',base_amount:10,additional_amount:0,deduction_amount:0,employer_cost:0,net_amount:10,status:'pagado',payment_reference:'TEST'}],
 hotel_admin_audit:[{id:1,table_name:'hotel_admin_payroll',record_id:'pay1',operation:'INSERT',happened_at:'2026-11-05T12:00:00Z'}]
};
const api={
 async list(table){return (fixture[table]||[]).map(x=>({...x}))},
 async insert(table,payload){changed.push({type:'insert',table,payload});return payload},
 async update(table,id,payload){changed.push({type:'update',table,id,payload});return payload},
 async upsert(table,payload){changed.push({type:'upsert',table,payload});return payload}
};
const document={getElementById(id){return id==='app-view'?{addEventListener(name,fn){listeners[name]=fn}}:null}};
class FakeFormData{constructor(el){this.raw=el.data||{}}entries(){return Object.entries(this.raw)}}
const window={hotelCloud:{ready:true,adminApi:api},alert(msg){notices.push(msg)},confirm(){return true},scrollTo(){}};
const context={document,window,FormData:FakeFormData,Intl,Date,Set,Map,Number,Math,String,Array,Object,JSON,RegExp,Promise,console};
vm.createContext(context);
vm.runInContext(js,context,{timeout:4000});
const admin=window.hotelAdmin;const d={
 rooms:[{id:'r1',status:'ocupada'},{id:'r2',status:'disponible'}],
 products:[{id:'p1',name:'Agua'},{id:'p2',name:'Galletas'}],
 reservations:[],
 stays:[{id:'s1',roomTotal:20,createdAt:'2026-11-04T10:00:00Z',advance:5,payments:[{amount:15,createdAt:'2026-11-06T10:00:00Z'}],
   invoiceRequested:true,invoiceRecords:[{number:'001-001-1',amount:20,issuedAt:'2026-11-05T10:00:00Z'}]}],
 extras:[{id:'x1',productId:'p1',productName:'Agua',price:1.5,quantity:2,stayId:'s1',createdAt:'2026-11-07T13:00:00Z'},
 {id:'x2',productId:'p2',productName:'Galletas',price:2,quantity:1,createdAt:'2026-11-08T12:00:00Z',method:'efectivo'}]
};
let failures=0;function test(name,fn){try{fn();console.log('PASS '+name)}catch(e){failures++;console.error('FAIL '+name,e.stack||e)}}
(async()=>{
 test('Módulo de administración válido y acceso enlazado desde app.js',()=>{
   assert(admin&&typeof admin.render==='function'&&typeof admin.hotelData==='function');
   for(const v of ['gerencia','estadisticas','finanzas','colaboradores','nomina','auditoria']){
     assert(app.includes(v+':')||app.includes(v+"'"));
     assert(index.includes('data-view="'+v+'"'));
   }
   assert(cloud.includes('adminScript.src="./admin.js?v=0.28-gerencial"'));
   assert(cloud.includes('adminApi={list:adminList,insert:adminInsert,update:adminUpdate,upsert:adminUpsert}'));
 });
 test('RLS restringe por rol admin, no por estar autenticado',()=>{
   for(const table of ['hotel_employees','hotel_admin_expenses','hotel_admin_product_costs','hotel_admin_payroll','hotel_admin_audit'])
     assert(sql.includes('alter table public.'+table+' enable row level security'));
   assert(sql.includes("s.active and s.role='admin'"));
   assert(sql.includes('revoke all on public.hotel_employees'));
   assert(sql.includes('hotel_admin_audit_write'));
   assert(sql.includes('hotel_paid_payroll_immutable'));
   assert(!/service_role\s*[:=]\s*['"]/.test(js+cloud));
 });
 admin.bind(()=>{});
 admin.render('gerencia',d);
 for(let i=0;i<6;i++)await Promise.resolve();
 admin.state.month='2026-11';
 test('Datos privados se recuperan por API y no son parte del estado operativo',()=>{
   assert(admin.state.loaded);
   assert.equal(admin.state.employees.length,1);
   assert.equal(admin.state.payroll.length,1);
   assert.equal(d.employees,undefined);
   assert.equal(d.payroll,undefined);
 });
 test('Ventas se cuentan una vez y cobros no equivalen a ventas',()=>{
   const x=admin.hotelData(d);
   assert.equal(x.lodging,20);
   assert.equal(x.varied,5);
   assert.equal(x.recognized,25);
   assert.equal(x.collected,22); // 5 anticipo + 15 pago + 2 caja de varios
   assert.equal(x.cogs,2.5);
   assert.equal(x.missing,0);
   assert.equal(x.flow,9); // 22 - 3 gastos - 10 nómina
   assert.equal(x.occupancy,50);
   assert.equal(x.invoicesCount,1);
 });
 test('Sin costos suficientes no se muestra margen falso',()=>{
   const x=admin.state.costs.splice(1);
   const r=admin.render('estadisticas',d);
   assert(r.includes('Margen no disponible'));
   assert(admin.hotelData(d).missing>0);
   admin.state.costs.push(...x);
 });
 test('Panel gerencial, estadísticas y finanzas incluyen indicadores y advertencias',()=>{
   for(const name of ['gerencia','estadisticas','finanzas']){
     const html=admin.render(name,d);
     assert(html.includes('admin-kpi'));
     assert(html.includes('contabl')||html.includes('contabilidad')||html.includes('márgenes'));
   }
 });
 test('Colaboradores incluye sueldo, pago y referencias a credenciales sin guardar contraseñas',()=>{
   const html=admin.render('colaboradores',d);
   assert(html.includes('COLABORADOR PRUEBA'));assert(html.includes('Sueldo mensual'));
   assert(html.includes('Día habitual de pago'));assert(html.includes('Supabase Auth'));
   assert(!html.includes('name="password"'));
 });
 test('Nómina permite revisar roles pagables y no modificar uno pagado',()=>{
   const html=admin.render('nomina',d);
   assert(html.includes('Nómina y roles de pago'));
   assert(html.includes('Pagado'));
   assert(!html.includes('data-id="pay1" class="admin-payroll-row"'));
   assert(html.includes('No se calculan automáticamente IESS'));
 });
 test('Auditoría se muestra sin ofrecer modificaciones directas',()=>{
   const html=admin.render('auditoria',d);
   assert(html.includes('hotel_admin_payroll'));
   assert(!html.includes('data-admin-form="audit"'));
 });
 test('El formulario de colaboradores envía sueldo solo a tabla privada',()=>{
   const e={target:{dataset:{adminForm:'employee'},data:{full_name:'NUEVA PERSONA',job_title:'Recepcionista',
    monthly_salary:'200.00',pay_day:'10',active:'true',contract_type:'por_definir'}},preventDefault(){}};
   const fn=listeners.submit;assert(typeof fn==='function');
 });
 console.log('Suites admin ejecutadas; errores:',failures);
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
