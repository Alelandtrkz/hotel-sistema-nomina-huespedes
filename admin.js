/* Hotel Unicornio v0.28 · Panel administrativo; datos privados bajo RLS.
   No almacena sueldos, documentos laborales o costos en el estado compartido de recepción.
   Los cálculos son gerenciales: NO reemplazan contabilidad ni roles legales. */
(function(){
"use strict";
const ADMIN_VIEWS=new Set(["gerencia","estadisticas","finanzas","colaboradores","nomina","auditoria"]);
const TABLES={employees:"hotel_employees",expenses:"hotel_admin_expenses",
 costs:"hotel_admin_product_costs",payroll:"hotel_admin_payroll",audit:"hotel_admin_audit"};
const CATEGORIES={compras:"Compras",servicios:"Servicios básicos",mantenimiento:"Mantenimiento",
 limpieza:"Limpieza",marketing:"Marketing",alquiler:"Alquiler",otros:"Otros"};
const ESC_CHARS={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>ESC_CHARS[ch]);
const usd=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n)||0);
const cents=n=>Math.round(Number(n||0)*100)/100;
const sum=(items,amount)=>cents(items.reduce((x,item)=>x+Number(amount(item)||0),0));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const state={loaded:false,loading:false,error:"",employees:[],expenses:[],costs:[],payroll:[],audit:[],
 month:today().slice(0,7),editEmployeeId:null,busy:false};
let redraw=()=>{},attached=false;
function api(){if(!window.hotelCloud?.ready||!window.hotelCloud.adminApi)throw Error("Debe iniciar una sesión de administrador.");return window.hotelCloud.adminApi;}
function textDate(t){return /^\d{4}-\d{2}-\d{2}/.test(t||"")?t.slice(0,10):""}
function inMonth(t,m=state.month){return textDate(t).slice(0,7)===m}
function monthLabel(m){const [y,mo]=m.split("-").map(Number);return new Intl.DateTimeFormat("es-EC",{month:"long",year:"numeric"}).format(new Date(y,mo-1,2))}
function formData(el){return Object.fromEntries(new FormData(el).entries())}
function safeMoney(value,label,allowZero=true){
 const raw=String(value??"").trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Error("Revise "+label+": utilice hasta dos decimales.");
 const amount=Number(raw);
 if(!Number.isFinite(amount)||amount<0||(!allowZero&&amount===0)||amount>10000000)throw Error("Importe fuera de rango: "+label);
 return cents(amount);
}
function box(title,contents,subtitle=""){return '<section class="panel admin-block"><div class="panel-head"><div><h2>'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':"")+'</div></div><div class="panel-body">'+contents+'</div></section>'}
const empty=txt=>'<p class="admin-empty">'+esc(txt)+'</p>';
const metric=(label,value,detail)=>'<div class="admin-kpi"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail||"")+'</span></div>';
const banner=(txt)=>'<div class="admin-help">'+txt+'</div>';
const title=(eyebrow,name,subtitle)=>'<div class="page-heading"><div><div class="eyebrow">'+esc(eyebrow)+'</div><h1>'+esc(name)+'</h1><p>'+esc(subtitle)+'</p></div></div>';
const period=()=>'<div class="admin-period"><label for="admin-period">Periodo de análisis</label><input id="admin-period" type="month" min="2020-01" max="2099-12" value="'+esc(state.month)+'"><small>Filtrado por fecha de registro · zona horaria Ecuador</small></div>';
const toRows=(data,mapper)=>data.length?'<div class="table-wrap"><table class="table admin-table">'+mapper+'</table></div>':empty("Todavía no hay registros.");
function hotelData(db){
 const stays=Array.isArray(db?.stays)?db.stays:[];
 const reservations=Array.isArray(db?.reservations)?db.reservations:[];
 const extras=Array.isArray(db?.extras)?db.extras:[];
 const products=Array.isArray(db?.products)?db.products:[];
 const rooms=Array.isArray(db?.rooms)?db.rooms:[];
 const byDate=xs=>xs.filter(x=>inMonth(x.createdAt||x.created_at||""));
 const salesExtras=byDate(extras);
 const stayStarts=byDate(stays);
 const lodging=sum(stayStarts,s=>s.roomTotal);
 const additional=sum(stayStarts,s=>(s.additionalPeople||[]).reduce((a,p)=>a+Number(p.amount||0),0));
 const varied=sum(salesExtras,e=>Number(e.price||0)*Number(e.quantity||0));
 const soldProducts=salesExtras.filter(e=>e.productId||e.productName);
 const costMap=new Map(state.costs.map(c=>[String(c.product_id),Number(c.unit_cost)]));
 const productMap=new Map(products.map(p=>[String(p.id),p]));
 let missing=0,cogs=0,withCost=0;
 for(const sale of soldProducts){
   const product=sale.productId&&productMap.get(String(sale.productId));
   const price=costMap.get(String(sale.productId||""));
   // Solo calcula margen si se conoce tanto el producto como su costo unitario.
   if(!product||price===undefined){missing++;continue}
   cogs+=price*Number(sale.quantity||0);withCost++;
 }
 cogs=cents(cogs);
 const receipts=[];
 for(const s of stays){
   // Evita contar como ingreso dos veces el efectivo entregado antes de devolver vuelto.
   for(const p of s.payments||[])if(inMonth(p.createdAt||p.created_at))receipts.push({category:"Hospedaje / cobro",amount:Number(p.amount||0)});
   if(inMonth(s.createdAt)&&Number(s.advance||0)>0)receipts.push({category:"Hospedaje / anticipo",amount:Number(s.advance)});
 }
 for(const r of reservations)if(r.status!=="ingresada"&&inMonth(r.createdAt)&&Number(r.advance||0)>0)
   receipts.push({category:"Reserva / anticipo",amount:Number(r.advance)});
 for(const e of salesExtras)if(!e.stayId&&["efectivo","transferencia"].includes(e.method))
   receipts.push({category:"Varios / venta directa",amount:Number(e.price||0)*Number(e.quantity||0)});
 const collected=sum(receipts,r=>r.amount);
 const expenses=state.expenses.filter(e=>inMonth(e.expense_date));
 const spent=sum(expenses.filter(e=>e.status==="pagado"),e=>e.amount);
 const dueExpenses=sum(expenses.filter(e=>e.status!=="pagado"),e=>e.amount);
 const payroll=state.payroll.filter(p=>p.period===state.month);
 const payrollPaid=sum(payroll.filter(p=>p.status==="pagado"),p=>p.net_amount);
 const payrollPending=sum(payroll.filter(p=>p.status!=="pagado"),p=>p.net_amount);
 const payrollEmployer=sum(payroll,p=>p.employer_cost);
 const invoices=stays.flatMap(stay=>(stay.invoiceRecords||[]).map(r=>({record:r,stay})));
 const emitted=invoices.filter(p=>inMonth(p.record.issuedAt));
 const invoicesValue=sum(emitted,p=>p.record.amount);
 const billedStays=stays.filter(s=>s.invoiceRequested);
 const invoicedButDue=billedStays.filter(stay=>{
   const issued=(stay.invoiceRecords||[]).reduce((a,r)=>a+Number(r.amount||0),0);
   const extra=extras.filter(e=>e.stayId===stay.id).reduce((a,e)=>a+Number(e.price||0)*Number(e.quantity||0),0);
   const more=(stay.additionalPeople||[]).reduce((a,p)=>a+Number(p.amount||0),0);
   return Number(stay.roomTotal||0)+extra+more-issued>0.005;
 }).length;
 const invoicedSettled=billedStays.filter(stay=>{
   if(!(stay.invoiceRecords||[]).length)return false;
   const total=Number(stay.roomTotal||0)+extras.filter(e=>e.stayId===stay.id).reduce((a,e)=>a+Number(e.price||0)*Number(e.quantity||0),0)+
   (stay.additionalPeople||[]).reduce((a,p)=>a+Number(p.amount||0),0);
   const paid=Number(stay.advance||0)+(stay.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0);
   return paid+0.005>=total;
 }).length;
 const occupancy=rooms.length?rooms.filter(r=>r.status==="ocupada").length/rooms.length*100:0;
 return {rooms,stays,salesExtras,products,stayStarts,lodging,additional,varied,missing,cogs,withCost,
  recognized:cents(lodging+additional+varied),collected,expenses,spent,dueExpenses,payroll,payrollPaid,payrollPending,payrollEmployer,
  invoicesValue,invoicesCount:emitted.length,invoicedButDue,invoicedSettled,occupancy,
  flow:cents(collected-spent-payrollPaid),receipts,billedStays};
}
function summaryPanel(db){
 const d=hotelData(db);
 return title("Administración / dirección","Resumen gerencial","Ventas, cobros, gastos y personal del Hotel Unicornio.")+
 period()+banner("<strong>Nota contable:</strong> Las ventas se agrupan según la fecha de registro de la estadía o del consumo, no según devengo fiscal. Los cobros no equivalen a ventas. El resultado de flujo es parcial y no representa utilidad neta.")+
 '<div class="admin-kpis">'+metric("Hospedaje registrado",usd(d.lodging),"Importes de estadías del periodo")+
 metric("Varios vendidos",usd(d.varied),"Cargos a habitación y ventas directas")+
 metric("Cobros registrados",usd(d.collected),"Pagos y anticipos netos aplicados")+
 metric("Gastos pagados",usd(d.spent),"Egresos del módulo administrativo")+
 metric("Nómina pagada",usd(d.payrollPaid),"Roles marcados como pagados")+
 metric("Flujo operativo parcial",usd(d.flow),"Cobros menos gastos y nómina registrados")+'</div>'+
 '<div class="admin-duo">'+box("Facturación y ocupación",
 '<div class="admin-stat-pairs"><span>Facturas emitidas en el periodo</span><strong>'+d.invoicesCount+'</strong>'+
 '<span>Importe facturado externamente</span><strong>'+usd(d.invoicesValue)+'</strong>'+
 '<span>Habitaciones con factura pendiente</span><strong>'+d.invoicedButDue+'</strong>'+
 '<span>Cuentas saldadas con factura registrada</span><strong>'+d.invoicedSettled+'</strong>'+
 '<span>Habitaciones ocupadas actualmente</span><strong>'+d.rooms.filter(r=>r.status==="ocupada").length+' / '+d.rooms.length+'</strong>'+
 '<span>Ocupación actual</span><strong>'+d.occupancy.toFixed(1)+' %</strong></div>'+
 '<p class="mini-caption">La factura emitida no demuestra por sí sola el pago al SRI ni la conciliación bancaria.</p>')+
 box("Por atender",'<div class="admin-stat-pairs">'+
 '<span>Gastos pendientes</span><strong>'+usd(d.dueExpenses)+'</strong>'+
 '<span>Roles de nómina pendientes</span><strong>'+usd(d.payrollPending)+'</strong>'+
 '<span>Costos faltantes en ventas de varios</span><strong>'+d.missing+'</strong>'+
 '<span>Trabajadores activos</span><strong>'+state.employees.filter(e=>e.active).length+'</strong></div>'+
 '<p class="mini-caption">Consulte Finanzas para registrar gastos y costos, y Nómina para aprobar pagos.</p>')+'</div>';
}
function statisticsPanel(db){
 const d=hotelData(db);
 const series=[["Hospedaje",d.lodging],["Varios",d.varied],["Adicionales de personas",d.additional]];
 const max=Math.max(1,...series.map(x=>x[1]));
 const costKnown=d.missing===0&&d.withCost>0;
 return title("Administración / análisis","Estadísticas","Análisis por período de ventas, cobros y ocupación.")+period()+
 banner("Las ventas de hospedaje se atribuyen al mes de registro del ingreso; una estancia puede abarcar varios meses. Para un estado financiero definitivo es necesaria conciliación contable.")+
 '<div class="admin-kpis">'+metric("Ventas operativas",usd(d.recognized),"Valor registrado, no dinero recibido")+
 metric("Cobros aplicados",usd(d.collected),"Anticipos y pagos recibidos")+
 metric("Ocupación actual",d.occupancy.toFixed(1)+" %","Habitaciones ocupadas / total")+
 metric("Facturas emitidas",String(d.invoicesCount),"Referencias externas registradas")+'</div>'+
 box("Composición de ventas",series.map(([name,total])=>'<div class="admin-chart-row"><div><strong>'+esc(name)+'</strong><span>'+usd(total)+'</span></div><div class="admin-chart-track"><div style="width:'+Math.max(0,total/max*100).toFixed(1)+'%"></div></div></div>').join(""),
 "Comparación de importes registrados en el período seleccionado")+
 '<div class="admin-duo">'+box("Margen de varios",
  costKnown?'<div class="admin-kpi admin-kpi-single"><small>Margen bruto estimado</small><strong>'+usd(cents(d.varied-d.cogs))+'</strong><span>Ingresos de varios menos costo de adquisición documentado</span></div>'+
  '<div class="admin-stat-pairs"><span>Costo registrado de mercadería</span><strong>'+usd(d.cogs)+'</strong>'+
  '<span>Margen bruto sobre venta</span><strong>'+(d.varied?((d.varied-d.cogs)/d.varied*100).toFixed(1):"0.0")+' %</strong></div>':
  empty("Margen no disponible: registre costos de adquisición de todas las ventas de productos antes de calcularlo.")+
  '<p class="mini-caption">Ventas sin costo verificable: '+d.missing+'. No incluye gastos generales, comisiones ni ajustes fiscales.</p>')+
 box("Facturas y nómina",'<div class="admin-stat-pairs"><span>Valor facturado externamente</span><strong>'+usd(d.invoicesValue)+'</strong>'+
 '<span>Gastos pendientes</span><strong>'+usd(d.dueExpenses)+'</strong>'+
 '<span>Nómina pagada</span><strong>'+usd(d.payrollPaid)+'</strong>'+
 '<span>Nómina pendiente</span><strong>'+usd(d.payrollPending)+'</strong></div>')+'</div>';
}
function financesPanel(db){
 const d=hotelData(db);
 const expenseRows=d.expenses.slice().sort((a,b)=>b.expense_date.localeCompare(a.expense_date));
 const costsById=new Map(state.costs.map(c=>[c.product_id,c]));
 const expenseForm='<form class="admin-form" data-admin-form="expense">'+
 '<div class="admin-fields"><label>Fecha<input name="expense_date" type="date" value="'+today()+'" required></label>'+
 '<label>Tipo<select name="category">'+Object.entries(CATEGORIES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join("")+'</select></label>'+
 '<label>Importe (USD)<input type="number" name="amount" min="0.01" step="0.01" required></label>'+
 '<label>Estado<select name="status"><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option></select></label>'+
 '<label>Forma de pago<select name="payment_method"><option value="sin_definir">Sin definir</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></label>'+
 '<label>Referencia<input name="reference" maxlength="120" placeholder="Opcional"></label>'+
 '<label class="admin-field-wide">Descripción<input name="description" maxlength="250" required placeholder="Ej. compra de productos de limpieza"></label></div>'+
 '<button type="submit" class="btn btn-primary">Registrar gasto</button></form>';
 const costForm='<form class="admin-form admin-cost-form" data-admin-form="cost"><div class="admin-fields">'+
 '<label>Producto<select name="product_id" required><option value="">Seleccione un producto</option>'+
 d.products.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")+'</select></label>'+
 '<label>Costo unitario de compra (USD)<input name="unit_cost" type="number" min="0" step="0.0001" placeholder="0.0000" required></label></div>'+
 '<button type="submit" class="btn btn-secondary">Guardar costo unitario</button></form>';
 const expenseTable=expenseRows.length?
 '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+
 expenseRows.map(e=>'<tr><td>'+esc(e.expense_date)+'</td><td><strong>'+esc(e.description)+'</strong><small>'+esc(CATEGORIES[e.category]||e.category)+'</small></td>'+
 '<td>'+usd(e.amount)+'</td><td>'+esc(e.status)+'</td><td>'+(e.status==="pendiente"?
 '<button type="button" class="btn btn-secondary btn-sm" data-admin-action="expense-paid" data-id="'+esc(e.id)+'">Marcar pagado</button>':"Registrado")+'</td></tr>').join("")+'</tbody></table></div>':empty("Sin gastos registrados este mes.");
 const priceProducts=d.products.filter(p=>costsById.has(p.id));
 const known=d.products.length?priceProducts.length/d.products.length*100:0;
 return title("Administración / finanzas","Finanzas y costos","Egresos, compras, costos de mercadería y rentabilidad.")+period()+
 banner("<strong>Separación de registros:</strong> los gastos nuevos se guardan en Finanzas. Los egresos registrados previamente en Cierre de caja no se duplican aquí; es necesario conciliarlos para obtener un resultado financiero completo.")+
 '<div class="admin-kpis">'+metric("Gastos pagados",usd(d.spent),"Egresos administrativos del período")+
 metric("Gastos pendientes",usd(d.dueExpenses),"Por pagar")+
 metric("Cobros registrados",usd(d.collected),"Ingresos operativos aplicados")+
 metric("Flujo registrado",usd(d.flow),"Parcial; no equivale a utilidad")+'</div>'+
 box("Registrar gasto",expenseForm,"Registre pagos o compromisos sin duplicar movimientos de caja.")+
 box("Historial de gastos",expenseTable,"Solo registros del período seleccionado")+
 '<div class="admin-duo">'+box("Costo de adquisición por producto",costForm+
 '<div class="admin-stat-pairs admin-cost-progress"><span>Productos con costo registrado</span><strong>'+priceProducts.length+" de "+d.products.length+'</strong>'+
 '<span>Cobertura del catálogo</span><strong>'+known.toFixed(1)+' %</strong></div>'+
 '<p class="mini-caption">El costo se almacena por separado y no modifica tarifas ni existencias. Sirve para una estimación de margen histórico: no es un control de lotes ni un promedio ponderado.</p>')+
 box("Costos registrados",state.costs.length?'<div class="admin-cost-list">'+state.costs.slice().sort((a,b)=>a.product_id.localeCompare(b.product_id)).map(c=>{
 const product=d.products.find(p=>p.id===c.product_id);
 return '<div><span>'+esc(product?.name||c.product_id)+'</span><strong>'+usd(c.unit_cost)+'</strong></div>';
 }).join("")+'</div>':empty("Registre el primer costo de compra para empezar a calcular márgenes."))+'</div>';
}
function employeePanel(){
 const edit=state.employees.find(e=>e.id===state.editEmployeeId);
 const employeeForm='<form class="admin-form" data-admin-form="employee">'+
 (edit?'<div class="admin-help">Editando '+esc(edit.full_name)+'. <button type="button" data-admin-action="employee-cancel" class="admin-link">Cancelar edición</button></div>':"")+
 '<div class="admin-fields"><label>Nombre completo<input name="full_name" required maxlength="150" value="'+esc(edit?.full_name||"")+'"></label>'+
 '<label>Cargo<input name="job_title" required maxlength="100" value="'+esc(edit?.job_title||"")+'"></label>'+
 '<label>Correo de acceso (referencia)<input name="email" type="email" maxlength="200" value="'+esc(edit?.email||"")+'"></label>'+
 '<label>Teléfono<input name="phone" maxlength="40" value="'+esc(edit?.phone||"")+'"></label>'+
 '<label>Cédula / documento<input name="document" maxlength="30" value="'+esc(edit?.document||"")+'"></label>'+
 '<label>Fecha de ingreso<input name="hire_date" type="date" value="'+esc(edit?.hire_date||"")+'"></label>'+
 '<label>Sueldo mensual (USD)<input name="monthly_salary" type="number" min="0" step="0.01" required value="'+esc(edit?.monthly_salary??"0")+'"></label>'+
 '<label>Día habitual de pago<input name="pay_day" type="number" min="1" max="28" required value="'+esc(edit?.pay_day??5)+'"></label>'+
 '<label>Tipo de contratación<select name="contract_type">'+[
 ['por_definir','Por definir'],['indefinido','Indefinido'],['plazo_fijo','Plazo fijo'],['servicios','Servicios profesionales'],['otro','Otro']
 ].map(([k,v])=>'<option value="'+k+'" '+(edit?.contract_type===k?'selected':'')+'>'+v+'</option>').join("")+'</select></label>'+
 '<label>Estado<select name="active"><option value="true" '+(!edit||edit.active?'selected':'')+'>Activo</option><option value="false" '+(edit&&!edit.active?'selected':'')+'>Inactivo</option></select></label></div>'+
 '<button type="submit" class="btn btn-primary">'+(edit?'Guardar cambios':'Registrar colaborador')+'</button></form>';
 const employees=state.employees.slice().sort((a,b)=>a.full_name.localeCompare(b.full_name));
 const totalSalary=sum(employees.filter(e=>e.active),e=>e.monthly_salary);
 return title("Administración / talento humano","Colaboradores","Expedientes, sueldos y referencia de credenciales individuales.")+
 banner("<strong>Seguridad:</strong> el correo no crea por sí solo una cuenta de acceso. Las credenciales se activan únicamente desde Supabase Auth tras vincular y autorizar cada usuario. Nunca guarde contraseñas aquí.")+
 '<div class="admin-kpis">'+metric("Colaboradores activos",String(employees.filter(e=>e.active).length),"Personas activas")+
 metric("Sueldo base mensual previsto",usd(totalSalary),"No incluye aportes ni beneficios")+
 metric("Cuentas vinculadas",String(employees.filter(e=>e.auth_user_id).length),"Vinculadas a Supabase Auth")+'</div>'+
 box(edit?"Editar ficha":"Nuevo colaborador",employeeForm)+
 box("Nómina de colaboradores",employees.length?'<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Colaborador</th><th>Sueldo</th><th>Pago</th><th>Acceso</th><th>Acciones</th></tr></thead><tbody>'+
 employees.map(e=>'<tr><td><strong>'+esc(e.full_name)+'</strong><small>'+esc(e.job_title)+' · '+(e.active?'Activo':'Inactivo')+'</small></td>'+
 '<td>'+usd(e.monthly_salary)+'</td><td>Día '+esc(e.pay_day)+'</td><td>'+(e.auth_user_id?'Vinculado':'Sin vincular')+'</td>'+
 '<td><button class="btn btn-secondary btn-sm" data-admin-action="employee-edit" data-id="'+esc(e.id)+'">Editar</button></td></tr>').join("")+'</tbody></table></div>':
 empty("Todavía no hay colaboradores registrados."))+
 box("Credenciales y permisos",'<p>La autorización operativa actual permanece limitada al administrador. Cada cuenta nueva debe crearse en <strong>Supabase Auth</strong>, vincularse a su expediente y recibir un rol en <strong>hotel_staff</strong> con permisos RLS verificados.</p>'+
 '<p class="mini-caption">No se envían contraseñas por correo desde este panel, ni se permite a empleados leer salarios de terceros. Las invitaciones y el acceso de recepción quedan pendientes de una fase de habilitación segura.</p>');
}
function payrollPanel(){
 const active=state.employees.filter(e=>e.active);
 const rows=state.payroll.filter(p=>p.period===state.month);
 const due=sum(rows.filter(r=>r.status!=="pagado"),r=>r.net_amount);
 const paid=sum(rows.filter(r=>r.status==="pagado"),r=>r.net_amount);
 const payrollItem=p=>{
   const e=state.employees.find(s=>s.id===p.employee_id);
   if(p.status==="pagado")return '<tr><td><strong>'+esc(e?.full_name||"Sin colaborador")+'</strong><small>'+esc(e?.job_title||"")+'</small></td>'+
 '<td>'+usd(p.net_amount)+'</td><td>Pagado</td><td><small>'+esc(p.payment_reference||"")+'</small></td></tr>';
   return '<tr><td><strong>'+esc(e?.full_name||"Sin colaborador")+'</strong><small>'+esc(e?.job_title||"")+'</small></td>'+
 '<td colspan="3"><form data-admin-form="payroll" data-id="'+esc(p.id)+'" class="admin-payroll-row">'+
 '<label>Base<input name="base_amount" type="number" min="0" step="0.01" value="'+esc(p.base_amount)+'" required></label>'+
 '<label>Adicionales<input name="additional_amount" type="number" min="0" step="0.01" value="'+esc(p.additional_amount)+'" required></label>'+
 '<label>Descuentos<input name="deduction_amount" type="number" min="0" step="0.01" value="'+esc(p.deduction_amount)+'" required></label>'+
 '<label>Costo patronal<input name="employer_cost" type="number" min="0" step="0.01" value="'+esc(p.employer_cost)+'" required></label>'+
 '<label>Referencia de pago<input name="payment_reference" maxlength="120" placeholder="Obligatoria para marcar pagado"></label>'+
 '<div class="admin-payroll-actions"><strong>Neto actual: '+usd(p.net_amount)+'</strong>'+
 '<button type="submit" name="intent" value="review" class="btn btn-secondary btn-sm">Guardar revisión</button>'+
 '<button type="submit" name="intent" value="paid" class="btn btn-primary btn-sm">Marcar pagado</button></div></form></td></tr>';
 };
 return title("Administración / nómina","Nómina y roles de pago","Registro y conciliación de sueldos, adicionales y descuentos.")+period()+
 banner("<strong>Roles administrativos:</strong> los importes parten del sueldo mensual registrado y requieren revisión antes del pago. No se calculan automáticamente IESS, décimos, vacaciones, fondos de reserva, horas extras ni impuestos. Configure esos valores con su contador antes de aprobar.")+
 '<div class="admin-kpis">'+metric("Colaboradores activos",String(active.length),"Según expediente")+
 metric("Nómina pendiente",usd(due),"Roles no pagados del periodo")+
 metric("Nómina pagada",usd(paid),"Roles marcados como pagados")+
 metric("Costos patronales anotados",usd(sum(rows,r=>r.employer_cost)),"Solo valores ingresados")+'</div>'+
 box("Generar roles mensuales",'<div class="admin-toolbar"><p>Generar borradores del mes para los trabajadores activos que aún no tengan rol.</p>'+
 '<button type="button" class="btn btn-primary" data-admin-action="payroll-generate">Generar roles de '+esc(monthLabel(state.month))+'</button></div>')+
 box("Roles de "+monthLabel(state.month),
 rows.length?'<div class="table-wrap"><table class="table admin-table admin-payroll-table"><thead><tr><th>Colaborador</th><th>Detalle del rol</th><th>Estado</th><th>Referencia</th></tr></thead><tbody>'+rows.map(payrollItem).join("")+'</tbody></table></div>':
 empty("No existen roles de pago para este periodo."))+
 box("Control de pagos",'<p>Un rol pagado conserva la fecha y referencia y queda bloqueado contra modificaciones. Si requiere ajustes posteriores debe documentarlos mediante un registro independiente.</p>'+
 '<p class="mini-caption">El sistema no genera todavía el rol de pago legal en PDF ni transmite información al IESS o al SRI.</p>');
}
function auditPanel(){
 const rows=state.audit.slice().sort((a,b)=>String(b.happened_at).localeCompare(String(a.happened_at))).slice(0,100);
 return title("Administración / seguridad","Accesos y auditoría","Historial automático de cambios administrativos guardados en Supabase.")+
 banner("El registro de auditoría lo escribe la base de datos mediante triggers. Las cuentas de recepción no tienen permiso de lectura de sueldos, costos o expedientes de colaboradores.")+
 box("Movimientos recientes",rows.length?'<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Fecha y hora</th><th>Recurso</th><th>Acción</th><th>Usuario de acceso</th></tr></thead><tbody>'+
 rows.map(a=>'<tr><td>'+esc(new Date(a.happened_at).toLocaleString("es-EC",{timeZone:"America/Guayaquil"}))+'</td><td>'+esc(a.table_name)+'</td><td>'+esc(a.operation)+'</td><td><small>'+esc(a.actor_id||"Sistema")+'</small></td></tr>').join("")+'</tbody></table></div>':
 empty("No hay movimientos administrativos auditados."),"Se muestran hasta 100 operaciones recientes")+
 box("Estado de credenciales",'<p>El inicio de sesión se valida con <strong>Supabase Auth</strong> y con el estado de <strong>hotel_staff</strong>. La configuración vigente mantiene un único administrador autorizado.</p>'+
 '<p class="mini-caption">Para incorporar recepcionistas hace falta habilitar un flujo de invitación y comprobar reglas de acceso para cada módulo antes de activar sus usuarios.</p>');
}
function render(view,db){
 if(!ADMIN_VIEWS.has(view))return "";
 if(!state.loaded){
   if(!state.loading)Promise.resolve().then(load);
   return title("Administración","Cargando datos protegidos","Consultando el panel privado en Supabase.")+
     (state.error?banner('<strong>Error:</strong> '+esc(state.error)+' <button data-admin-action="retry" class="admin-link">Reintentar</button>'):
     '<div class="panel"><div class="panel-body">Validando permisos y cargando colaboradores, gastos y nómina...</div></div>');
 }
 switch(view){
 case "gerencia":return summaryPanel(db);
 case "estadisticas":return statisticsPanel(db);
 case "finanzas":return financesPanel(db);
 case "colaboradores":return employeePanel();
 case "nomina":return payrollPanel();
 case "auditoria":return auditPanel();
 default:return "";
 }
}
async function load(){
 if(state.loading)return;
 state.loading=true;state.error="";
 try{
   const [employees,expenses,costs,payroll,audit]=await Promise.all([
     api().list(TABLES.employees),api().list(TABLES.expenses),api().list(TABLES.costs),
     api().list(TABLES.payroll),api().list(TABLES.audit)]);
   Object.assign(state,{employees,expenses,costs,payroll,audit,loaded:true,error:""});
 }catch(error){state.loaded=false;state.error=error.message||"Fallo de conexión"; }
 finally{state.loading=false;redraw();}
}
function refresh(){state.loaded=false;load()}
async function mutate(fn,success){
 if(state.busy)return;
 state.busy=true;
 try{await fn();await load();window.alert(success);}
 catch(error){window.alert("No se guardó el cambio: "+(error.message||String(error)));}
 finally{state.busy=false;}
}
async function submit(event){
 const form=event.target.closest("form[data-admin-form]");
 if(!form)return;
 event.preventDefault();
 const type=form.dataset.adminForm,fields=formData(form);
 if(type==="employee"){
   await mutate(async()=>{
     const payload={full_name:String(fields.full_name||"").trim(),job_title:String(fields.job_title||"").trim(),
       email:fields.email||null,phone:fields.phone||null,document:fields.document||null,hire_date:fields.hire_date||null,
       contract_type:fields.contract_type,pay_day:Number(fields.pay_day),
       monthly_salary:safeMoney(fields.monthly_salary,"sueldo"),active:fields.active==="true"};
     if(!payload.full_name||!payload.job_title)throw Error("Ingrese nombre y cargo.");
     if(state.editEmployeeId)await api().update(TABLES.employees,state.editEmployeeId,payload);
     else await api().insert(TABLES.employees,payload);
     state.editEmployeeId=null;
   },"Ficha del colaborador guardada.");
 }
 if(type==="expense"){
   await mutate(async()=>{
     const payload={expense_date:fields.expense_date,category:fields.category,description:String(fields.description||"").trim(),
       amount:safeMoney(fields.amount,"gasto",false),status:fields.status,
       payment_method:fields.payment_method,reference:fields.reference||null};
     if(payload.description.length<3)throw Error("Describa el concepto del gasto.");
     await api().insert(TABLES.expenses,payload);
   },"Gasto registrado.");
 }
 if(type==="cost"){
   await mutate(async()=>{
     const cost=String(fields.unit_cost||"").trim(),raw=Number(cost);
     if(!/^\d+(?:\.\d{1,4})?$/.test(cost)||!Number.isFinite(raw)||raw<0||raw>1000000)throw Error("Costo unitario inválido.");
     if(!fields.product_id)throw Error("Seleccione un producto.");
     await api().upsert(TABLES.costs,{product_id:fields.product_id,unit_cost:raw,updated_at:new Date().toISOString()},"product_id");
   },"Costo unitario guardado.");
 }
 if(type==="payroll"){
   const btn=event.submitter;
   const intent=btn?.value||"review";
   await mutate(async()=>{
     const row=state.payroll.find(r=>r.id===form.dataset.id);
     if(!row||row.status==="pagado")throw Error("No se puede editar un rol pagado.");
     const base=safeMoney(fields.base_amount,"sueldo"),extra=safeMoney(fields.additional_amount,"adicionales"),
       deduct=safeMoney(fields.deduction_amount,"descuentos"),employer=safeMoney(fields.employer_cost,"costo patronal");
     if(deduct>base+extra)throw Error("Descuentos superiores al total de ingresos.");
     const payload={base_amount:base,additional_amount:extra,deduction_amount:deduct,employer_cost:employer,
       status:intent==="paid"?"pagado":"revisado"};
     if(intent==="paid"){
       if(String(fields.payment_reference||"").trim().length<3)throw Error("Ingrese la referencia del pago efectuado.");
       if(!window.confirm("¿Confirma que ya pagó "+usd(cents(base+extra-deduct))+" a este colaborador? Esta operación quedará bloqueada."))return;
       payload.payment_reference=String(fields.payment_reference).trim();
       payload.paid_at=new Date().toISOString();
     }
     await api().update(TABLES.payroll,row.id,payload);
   },intent==="paid"?"Pago de nómina registrado.":"Revisión de rol guardada.");
 }
}
async function click(event){
 const el=event.target.closest("[data-admin-action]");if(!el)return;
 const action=el.dataset.adminAction,id=el.dataset.id;
 if(action==="retry"){await refresh();return;}
 if(action==="employee-edit"){state.editEmployeeId=id;redraw();window.scrollTo({top:0,behavior:"smooth"});return;}
 if(action==="employee-cancel"){state.editEmployeeId=null;redraw();return;}
 if(action==="expense-paid"){
   if(!window.confirm("¿Confirma que este gasto ya fue pagado?"))return;
   await mutate(()=>api().update(TABLES.expenses,id,{status:"pagado"}),"Gasto marcado como pagado.");
 }
 if(action==="payroll-generate"){
   const existing=new Set(state.payroll.filter(p=>p.period===state.month).map(p=>p.employee_id));
   const todo=state.employees.filter(e=>e.active&&!existing.has(e.id));
   if(!todo.length){window.alert("No hay roles pendientes de generar en este periodo.");return;}
   if(!window.confirm("¿Generar "+todo.length+" roles para "+monthLabel(state.month)+"? Revise los importes antes de marcar pagos."))return;
   await mutate(async()=>{
     for(const e of todo)await api().insert(TABLES.payroll,{employee_id:e.id,period:state.month,
       base_amount:Number(e.monthly_salary||0),additional_amount:0,deduction_amount:0,employer_cost:0,status:"pendiente"});
   },"Borradores generados. Revise aportes y beneficios antes de pagar.");
 }
}
function bind(onRedraw){
 redraw=onRedraw||(()=>{});
 if(attached)return;
 const root=document.getElementById("app-view");if(!root)return;
 attached=true;root.addEventListener("submit",submit);
 root.addEventListener("click",click);
 root.addEventListener("change",event=>{
   if(event.target.id==="admin-period"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)){
     state.month=event.target.value;redraw();
   }
 });
}
window.hotelAdmin={render,bind,refresh,state,hotelData,checkout:()=>ADMIN_VIEWS};
})();