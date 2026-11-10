/* Hotel Unicornio v0.29: caja por sesión (08:00–23:00 / 23:00–08:00).
   Fondo de cambio = efectivo físico que se SUMA al cierre; NO es una venta. */
(function(){
"use strict";
const state={sessions:[],loaded:false,loading:false,error:"",modal:"",selectedId:null,busy:false};
let redraw=()=>{},getHelpers=()=>null,bound=false,viewData=null;
const money=v=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(v)||0);
const round=v=>Math.round(Number(v||0)*100)/100;
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function timeLabel(instant){
  return new Intl.DateTimeFormat("es-EC",{timeZone:"America/Guayaquil",dateStyle:"medium",timeStyle:"short"}).format(new Date(instant));
}
function currentShiftInfo(instant=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(instant);
  const get=k=>parts.find(p=>p.type===k)?.value||"00";
  const minute=Number(get("hour"))*60+Number(get("minute"));
  const shift=minute>=480&&minute<1380?"dia":"noche";
  const date=new Date(Date.UTC(Number(get("year")),Number(get("month"))-1,Number(get("day"))-(minute<480?1:0)));
  return {shift,date:date.toISOString().slice(0,10),label:shift==="dia"?"Día · 08:00 a 23:00":"Noche · 23:00 a 08:00"};
}
const active=()=>state.sessions.find(s=>s.status==="abierta")||null;
const priorClosed=()=>state.sessions.find(s=>s.status==="cerrada")||null;
const viewSession=()=>active()||state.sessions.find(s=>s.id===state.selectedId)||state.sessions[0]||null;
function canOperate(){
  const a=active(),current=currentShiftInfo();
  return !!(state.loaded&&!state.loading&&!state.busy&&a&&a.shift===current.shift&&a.shift_date===current.date);
}
function summary(session,db,H){
 const raw=H.sessionTotals(session);
 const base=round(session.opening_float);
 const expected=round(base+raw.cash-raw.changeGiven-raw.otherOut);
 return {...raw,base,expected};
}
function csvExport(db,H){
 const session=viewSession();if(!session){window.alert("No existe ninguna sesión para exportar.");return;}
 const x=session.status==="abierta"?summary(session,db,H):{
   cash:Number(session.cash_in),transfer:Number(session.transfer_in),
   changeGiven:Number(session.change_given),otherOut:Number(session.other_out),
   base:Number(session.opening_float),expected:Number(session.expected_cash)
 };
 const rows=[
  ["Hotel Unicornio · Control de caja","Sesión",session.id],
  ["Fecha de turno",session.shift_date,"Turno",session.shift],
  ["Apertura",session.opened_at,"Encargado",session.opening_operator],
  ["Concepto","Valor USD"],
  ["Fondo inicial de cambio (se suma al cierre)",x.base],
  ["Efectivo recibido en ventas/cobros",x.cash],
  ["Transferencias (no efectivo)",x.transfer],
  ["Vueltos entregados",-x.changeGiven],
  ["Retiros y gastos de caja",-x.otherOut],
  ["Efectivo esperado al cierre",x.expected],
  ["Efectivo contado",session.counted_cash??""],
  ["Diferencia",session.variance??""],
  ["Fondo conservado para siguiente turno",session.next_float??""],
  ["Efectivo retirado/entregado a administración",session.withdrawn??""],
  ["Estado",session.status],
  ["Observaciones de apertura",session.opening_note||""],
  ["Observaciones de cierre",session.close_note||""]
 ];
 const safe=v=>{
   let value=String(v??"");
   if(/^\s*[=+@-]/.test(value)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(value))value="'"+value;
   return '"'+value.replaceAll('"','""')+'"';
 };
 const csv="\ufeff"+rows.map(r=>r.map(safe).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download="hotel-unicornio-caja-"+session.shift_date+"-"+session.shift+".csv";
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function stat(label,value,desc){
 return '<div class="cash-session-metric"><span>'+escape(label)+'</span><strong>'+money(value)+'</strong>'+
 (desc?'<small>'+escape(desc)+'</small>':"")+'</div>';
}
function modalOpen(){
 const prev=priorClosed(),due=prev?Number(prev.next_float):null;
 const warning=due!==null?'<p class="cash-small-notice">El turno anterior dejó '+money(due)+' como fondo para cambio. Cuente físicamente ese efectivo; si hay diferencia, anote el motivo.</p>':
 '<p class="cash-small-notice">Es la primera apertura del nuevo control. Cuente el efectivo disponible para entregar vueltos.</p>';
 return '<div class="cash-modal-overlay" data-cash-action="cancel-overlay"><section class="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-open-heading">'+
 '<div class="cash-modal-head"><div><small>CONTROL DE CAJA</small><h2 id="cash-open-heading">Abrir caja</h2></div><button type="button" class="cash-icon-close" data-cash-action="cancel" aria-label="Cerrar ventana">×</button></div>'+
 '<form id="cash-session-open-form" class="cash-modal-body">'+
 '<div class="cash-shift-label"><strong>'+escape(currentShiftInfo().label)+'</strong><span>Turno automático según horario de El Coca</span></div>'+
 (due===null?'': '<div class="cash-summary-line"><span>Fondo entregado por turno anterior</span><strong>'+money(due)+'</strong></div>')+
 '<label>Encargado que recibe la caja *<input name="operator" minlength="2" maxlength="120" required placeholder="Nombre del recepcionista"></label>'+
 '<label>Fondo de cambio contado (USD) *<input name="counted" type="number" min="0" max="1000000" step="0.01" required placeholder="'+(due!==null?escape(due.toFixed(2)):"Ej. 25.00")+'"></label>'+
 warning+'<label>Observaciones sobre la entrega <textarea name="note" maxlength="500" rows="2" placeholder="Diferencias o novedades, si existen"></textarea></label>'+
 '<div class="cash-small-notice"><strong>El fondo inicial no es una venta:</strong> se sumará al efectivo recibido y se restarán vueltos y retiros cuando cierre.</div>'+
 '<button type="submit" class="btn btn-primary">Confirmar apertura</button></form></section></div>';
}
function modalClose(session,H,db){
 const x=summary(session,db,H);
 return '<div class="cash-modal-overlay" data-cash-action="cancel-overlay"><section class="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-close-heading">'+
 '<div class="cash-modal-head"><div><small>ARQUEO DE TURNO</small><h2 id="cash-close-heading">Cerrar y entregar caja</h2></div>'+
 '<button class="cash-icon-close" type="button" data-cash-action="cancel" aria-label="Cerrar ventana">×</button></div>'+
 '<form id="cash-session-close-form" class="cash-modal-body">'+
 '<div class="cash-summary-line"><span>Fondo inicial para vueltos (+)</span><strong>'+money(x.base)+'</strong></div>'+
 '<div class="cash-summary-line"><span>Entradas en efectivo (+)</span><strong>'+money(x.cash)+'</strong></div>'+
 '<div class="cash-summary-line"><span>Vueltos entregados (−)</span><strong>'+money(x.changeGiven)+'</strong></div>'+
 '<div class="cash-summary-line"><span>Gastos y retiros (−)</span><strong>'+money(x.otherOut)+'</strong></div>'+
 '<div class="cash-summary-line cash-summary-total"><span>Efectivo esperado</span><strong>'+money(x.expected)+'</strong></div>'+
 '<div class="cash-small-notice">Las transferencias ('+money(x.transfer)+') no se incluyen en el dinero físico de caja.</div>'+
 '<label>Encargado del cierre *<input name="operator" minlength="2" maxlength="120" required placeholder="Nombre de quien entrega la caja"></label>'+
 '<label>Efectivo contado al cierre (USD) *<input name="counted" type="number" min="0" max="1000000" step="0.01" required placeholder="Contar todo el efectivo, incluido el fondo"></label>'+
 '<label>Fondo que se deja al siguiente turno (USD) *<input name="next_float" type="number" min="0" max="1000000" step="0.01" required placeholder="Ej. 25.00"></label>'+
 '<div class="cash-summary-line"><span>Diferencia de arqueo</span><strong id="cash-close-difference">—</strong></div>'+
 '<div class="cash-summary-line"><span>Dinero retirado para entregar a administración</span><strong id="cash-close-withdrawn">—</strong></div>'+
 '<label>Observaciones <textarea name="note" maxlength="500" rows="2" placeholder="Obligatorio si hay diferencia de arqueo"></textarea></label>'+
 '<div class="cash-small-notice">Después del cierre no se podrá modificar este arqueo. El nuevo recepcionista confirmará el fondo recibido al abrir la próxima caja.</div>'+
 '<button type="submit" class="btn btn-primary">Confirmar cierre definitivo</button></form></section></div>';
}
function render(db,H){
 viewData={db,H};
 const heading=H.head("Recepción / control financiero","Apertura y cierre de caja","Apertura, arqueo, cierre y traspaso del fondo para dar vueltos.",
 '<button class="btn btn-secondary" type="button" data-cash-action="export">Exportar reporte CSV</button>');
 if(!state.loaded){
   if(!state.loading&&!state.error)Promise.resolve().then(load);
   return heading+'<section class="panel cash-session-loading"><div class="panel-body">'+
     (state.error?'<p>Error al cargar caja: '+escape(state.error)+'</p><button type="button" class="btn btn-secondary" data-cash-action="refresh">Reintentar</button>':
      'Consultando el estado de caja en Supabase...')+'</div></section>';
 }
 const a=active(),selected=viewSession(),shift=currentShiftInfo();
 const ended=a&&(a.shift!==shift.shift||a.shift_date!==shift.date);
 const previous=priorClosed(),x=selected?(selected.status==="abierta"?summary(selected,db,H):{
   base:Number(selected.opening_float),cash:Number(selected.cash_in),
   transfer:Number(selected.transfer_in),changeGiven:Number(selected.change_given),
   otherOut:Number(selected.other_out),expected:Number(selected.expected_cash),
   groups:[],items:[],changePendingTotal:0
 }):null;
 const currentStatus=a?(ended?"Turno pendiente de cierre":"Caja abierta"):"Caja cerrada";
 let page=heading+'<div class="cash-session-toolbar"><span class="cash-status '+(a?"open":"closed")+'">'+escape(currentStatus)+'</span>'+
 '<span>'+escape(shift.label)+' · '+escape(shift.date)+'</span>'+
 '<button class="btn btn-secondary btn-sm" type="button" data-cash-action="refresh">Actualizar</button>'+
 (a?'<button class="btn btn-primary" type="button" data-cash-action="close">Cerrar caja</button>':
 '<button class="btn btn-primary" type="button" data-cash-action="open">Abrir caja</button>')+'</div>';
 if(ended)page+='<div class="cash-session-alert">El horario de este turno terminó. Cierre la caja abierta para poder iniciar la siguiente; no registre nuevos cobros en el turno anterior.</div>';
 if(!a)page+='<div class="cash-session-alert">La caja está cerrada. Antes de cobrar, la recepción debe abrir la sesión actual y contar el fondo para dar vueltos.</div>';
 if(selected&&x){
   page+='<section class="panel cash-session-details"><div class="panel-head"><div><h2>Arqueo · '+escape(selected.shift==="dia"?"Día":"Noche")+' · '+escape(selected.shift_date)+'</h2>'+
   '<p>Abierta: '+escape(timeLabel(selected.opened_at))+' · '+escape(selected.opening_operator)+
   (selected.closed_at?' · Cerrada: '+escape(timeLabel(selected.closed_at)):' · En curso')+'</p></div></div>'+
   '<div class="cash-session-grid">'+stat("Fondo inicial para vueltos",x.base,"Se incluye en el cierre")+
   stat("Efectivo recibido",x.cash,"Cobros y ventas")+
   stat("Transferencias",x.transfer,"Fuera de efectivo físico")+
   stat("Salidas en efectivo",round(x.changeGiven+x.otherOut),"Vueltos y retiros")+'</div>'+
   '<div class="cash-session-balance"><span>EFECTIVO ESPERADO (fondo + cobros − salidas)</span><strong>'+money(x.expected)+'</strong></div>'+
   '<div class="cash-session-grid cash-session-grid-bottom">'+
   stat("Vueltos entregados",x.changeGiven,"Efectivo devuelto al huésped")+
   stat("Otros gastos y retiros",x.otherOut,"Salidas efectivas")+
   (selected.status==="cerrada"?stat("Fondo para siguiente turno",selected.next_float,"Sueltos reservados"):stat("Saldo por entregar",x.expected,"Sujeto a arqueo"))+
   (selected.status==="cerrada"?stat("Retirado a administración",selected.withdrawn,"Contado menos fondo reservado"):stat("Arqueo",0,"Pendiente de cierre"))+'</div>';
   if(selected.status==="cerrada")page+='<div class="cash-session-closed-info"><strong>Resultado del cierre:</strong> contado '+money(selected.counted_cash)+', diferencia '+money(selected.variance)+'. '+
   (selected.close_note?'Observaciones: '+escape(selected.close_note):'Sin observaciones.')+'</div>';
   if(selected.status==="abierta"){
     const pending=H.changeMovements().filter(v=>H.changePending(v.owner)>0);
     page+='<div class="cash-session-inner"><h3>Últimos movimientos de la sesión</h3>'+
       (x.items.length?x.items.slice().reverse().slice(0,12).map(item=>'<div class="movement-row"><div><strong>'+escape(item.concept)+
        '</strong><div class="mini-caption">'+escape(item.group)+' · '+escape(item.method)+'</div></div><strong>'+money(item.amount)+'</strong></div>').join(""):
        '<p class="mini-caption">Sin cobros desde la apertura.</p>')+'</div>'+
       '<div class="cash-session-inner"><h3>Vueltos pendientes de entregar</h3><p class="mini-caption">La obligación pendiente no forma parte de la ganancia del hotel.</p>'+
       (pending.length?pending.map(v=>'<div class="account-line"><div><strong>'+escape(v.label)+'</strong><small>Vuelto pendiente: '+money(H.changePending(v.owner))+'</small></div>'+
         H.btn("Vuelto entregado","settle-change","btn-secondary btn-sm",'data-source="'+escape(v.source)+'" data-id="'+escape(v.id)+'"')+'</div>').join(""):
       '<p class="mini-caption">No hay vueltos pendientes.</p>')+'</div>'+
       '<div class="cash-session-inner"><h3>Registrar retiro o gasto de caja</h3>'+
       '<form id="cash-out-form"><div class="form-grid">'+
       H.select("Tipo","kind",[["gasto","Gasto"],["retiro","Retiro de efectivo"]],"gasto")+
       H.field("Monto (USD)","amount","",{required:true,type:"number",min:.01,step:".01"})+
       H.field("Motivo","note","",{required:true,placeholder:"Detalle del movimiento"})+
       H.field("Encargado","operator","",{required:true,placeholder:"Trabajador"})+
       '</div><button class="btn btn-secondary section-gap" type="submit">Registrar salida de efectivo</button></form></div>';
   }
   page+='</section>';
 }else{
   page+='<section class="panel"><div class="panel-body"><p>No hay sesiones de caja nuevas registradas. '+
     'Presione <strong>Abrir caja</strong> para contar y registrar el fondo inicial.</p></div></section>';
 }
 page+='<section class="panel section-gap"><div class="panel-head"><div><h2>Historial de aperturas y cierres</h2>'+
  '<p>Sesiones registradas en Supabase (solo lectura).</p></div></div><div class="panel-body">'+
  (state.sessions.length?state.sessions.slice(0,30).map(s=>'<div class="movement-row"><div><strong>'+escape(s.shift_date)+' · '+escape(s.shift==="dia"?"Día":"Noche")+
   ' · '+escape(s.status)+"</strong><div class=\"mini-caption\">"+escape(s.opening_operator)+
   ' · fondo '+money(s.opening_float)+(s.status==="cerrada"?' · entregado al próximo turno '+money(s.next_float):"")+
   '</div></div><button type="button" class="btn btn-secondary btn-sm" data-cash-action="select" data-id="'+escape(s.id)+'">Ver</button></div>').join(""):
   '<p class="mini-caption">No hay sesiones todavía.</p>')+'</div></section>';
 if(db.closures?.length)page+='<section class="panel section-gap"><div class="panel-head"><div><h2>Cierres anteriores al nuevo control</h2>'+
   '<p>Histórico conservado sin modificación; no se puede volver a abrir ni editar.</p></div></div><div class="panel-body">'+
   db.closures.slice().reverse().slice(0,15).map(c=>'<div class="movement-row"><div><strong>'+escape(c.date)+' · '+escape(c.shift)+
   '</strong><div class="mini-caption">'+escape(c.operator)+' · esperado '+money(c.expected)+'</div></div><strong>'+money(c.variance)+'</strong></div>').join("")+
   '</div></section>';
 if(state.modal==="open"&&!a)page+=modalOpen();
 if(state.modal==="close"&&a)page+=modalClose(a,H,db);
 return page;
}
async function load(){
 if(state.loading)return;
 state.loading=true;
 try{
   const api=window.hotelCloud?.cashApi;
   if(!api)throw new Error("Control de caja no disponible. Inicie una sesión administrativa.");
   state.sessions=await api.list();state.loaded=true;state.error="";
 }catch(e){state.loaded=false;state.error=e.message||"No fue posible consultar Supabase";}
 finally{state.loading=false;redraw();}
}
function refresh(){state.loaded=false;state.modal="";return load();}
async function transact(action){
 if(state.busy)return;
 state.busy=true;
 try{await action();state.modal="";await load();}
 catch(e){window.alert("No se completó la operación de caja: "+(e.message||String(e)));}
 finally{state.busy=false;}
}
async function submit(event){
 if(!["cash-session-open-form","cash-session-close-form"].includes(event.target?.id))return;
 event.preventDefault();
 const f=Object.fromEntries(new FormData(event.target).entries());
 const strict=value=>{
   const raw=String(value??"").trim();
   if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error("Ingrese importes válidos, con máximo dos decimales.");
   const n=Number(raw);if(!Number.isFinite(n)||n>1000000)throw new Error("Importe fuera de rango.");
   return round(n);
 };
 const H=viewData?.H,db=viewData?.db;
 await transact(async()=>{
   if(event.target.id==="cash-session-open-form"){
     const counted=strict(f.counted);
     await window.hotelCloud.cashApi.open({operator:String(f.operator||"").trim(),counted,note:String(f.note||"").trim()});
   }else{
     const a=active();if(!a||!H||!db)throw new Error("La caja ya no está abierta.");
     const counted=strict(f.counted),nextFloat=strict(f.next_float);
     const x=summary(a,db,H);
     if(nextFloat>counted)throw new Error("El fondo que queda al siguiente turno no puede superar el dinero contado.");
     if(counted!==x.expected&&String(f.note||"").trim().length<5)
       throw new Error("Hay diferencia entre efectivo contado y esperado. Describa la novedad.");
     if(!window.confirm("¿Cerrar definitivamente la caja?\n\nFondo inicial: "+money(x.base)+
       "\nEfectivo esperado: "+money(x.expected)+"\nEfectivo contado: "+money(counted)+
       "\nDiferencia: "+money(round(counted-x.expected))+
       "\nFondo para siguiente turno: "+money(nextFloat)+
       "\nRetiro a administración: "+money(round(counted-nextFloat))+
       "\n\nUna vez confirmado, el cierre no podrá editarse."))return;
     await window.hotelCloud.cashApi.close({
       id:a.id,operator:String(f.operator||"").trim(),counted,nextFloat,
       cashIn:x.cash,transferIn:x.transfer,changeGiven:x.changeGiven,otherOut:x.otherOut,
       note:String(f.note||"").trim()
     });
   }
 });
}
function click(event){
 const el=event.target.closest("[data-cash-action]");if(!el)return;
 const action=el.dataset.cashAction;
 if(action==="cancel-overlay"&&event.target!==el)return;
 if(action==="open"){if(active())return;state.modal="open";redraw();return;}
 if(action==="close"){if(!active())return;state.modal="close";redraw();return;}
 if(action==="cancel"||action==="cancel-overlay"){state.modal="";redraw();return;}
 if(action==="refresh"){refresh();return;}
 if(action==="select"){state.selectedId=el.dataset.id;redraw();return;}
 if(action==="export"&&viewData)csvExport(viewData.db,viewData.H);
}
function input(event){
 if(!event.target.closest("#cash-session-close-form")||!viewData)return;
 const form=event.target.form;if(!form)return;
 const a=active();if(!a)return;
 const x=summary(a,viewData.db,viewData.H);
 const counted=String(form.querySelector('[name="counted"]')?.value||"");
 const carry=String(form.querySelector('[name="next_float"]')?.value||"");
 const n=Number(counted),c=Number(carry);
 const diff=document.getElementById("cash-close-difference"),withdrawn=document.getElementById("cash-close-withdrawn");
 if(diff)diff.textContent=counted!==""&&Number.isFinite(n)?money(round(n-x.expected)):"—";
 if(withdrawn)withdrawn.textContent=counted!==""&&carry!==""&&Number.isFinite(n)&&Number.isFinite(c)?money(round(n-c)):"—";
}
function bind(onRedraw){
 redraw=onRedraw||(()=>{});
 if(bound)return;
 const root=document.getElementById("app-view");if(!root)return;
 bound=true;root.addEventListener("click",click);root.addEventListener("submit",submit);root.addEventListener("input",input);
 if(!state.loaded&&!state.loading)Promise.resolve().then(load);
}
window.hotelCash={render,bind,refresh,canOperate,active,summary,state,currentShiftInfo,csvExport};
})();