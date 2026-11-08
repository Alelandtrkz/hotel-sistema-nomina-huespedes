'use strict';
/* Hotel Unicornio: prototipo de interfaz sin servidor ni integración gubernamental.
   No ingresar información personal real. La persistencia es local al navegador. */
(() => {
  const STORAGE_KEY = 'unicornio-recepcion-demo-v2';
  // Las habitaciones 01, 02, etc. pueden venderse como individual o matrimonial.
  // Inventario fotográfico proporcionado por recepción el 07/11/2026.
  const TYPES = ['individual','matrimonial','individual_ventilador','matrimonial_ventilador','doble','triple'];
  const ROOM_TYPES = ['flex_aire','flex_ventilador','doble','triple','arrendada'];
  const LABELS = {
    individual:'Individual A/C',matrimonial:'Matrimonial A/C',
    individual_ventilador:'Individual ventilador',matrimonial_ventilador:'Matrimonial ventilador',
    flex_aire:'Individual / matrimonial A/C',flex_ventilador:'Individual / matrimonial ventilador',
    doble:'Doble A/C',triple:'Triple A/C',arrendada:'Arrendada'
  };
  const BREAKFAST_EXTRA_PRICE=5;
  const CATEGORIES = {bebidas:'Bebidas',confiteria:'Confitería',aseo:'Aseo personal',helados:'Helados',otros:'Otros / servicios'};
  const VIEWS = {inicio:'Panel general',habitaciones:'Habitaciones',ingreso:'Registro / ingreso',reservas:'Reservas',salidas:'Salidas y cobros',varios:'Varios / consumos',inventario:'Inventario de varios',caja:'Cierre de caja',huespedes:'Huéspedes',configuracion:'Tarifas y ajustes'};
  const DEFAULT_RATES = {
    individual:{sin:20,con:25},matrimonial:{sin:29,con:39},
    individual_ventilador:{sin:17,con:null},matrimonial_ventilador:{sin:23,con:null},
    doble:{sin:30,con:45},triple:{sin:40,con:55}
  };
  // Tarifa mínima autorizada por recepción para hospedaje sin desayuno y sin factura solicitada.
  // No aplica a personas adicionales, varios, lavandería ni desayunos.
  const DISCOUNT_ROOM_RATES=Object.freeze({
    individual_ventilador:15,matrimonial_ventilador:20,
    individual:17,matrimonial:27,doble:27,triple:37
  });
  const CHECKIN_PAYMENT_OPTIONS=[
    ['efectivo','Efectivo (tarifa normal)'],
    ['transferencia','Transferencia (tarifa normal)'],
    ['transferencia_descuento','Transferencia · precio con descuento'],
    ['por_cobrar','Por cobrar · requiere doble confirmación']
  ];
  const ROOM_LISTS = {
    flex_aire:['01','02','10','11','14','15','16','17','18','19','20','21','22','24','25','26','27','28','29'],
    flex_ventilador:['07','08'], doble:['03','12'],triple:['04','38'],
    // El documento repite "101"; se incorpora una sola vez.
    arrendada:['05','06','09','13','23','30','101','102']
  };
  const PRODUCT_CATALOG = [
    ['bebidas','Fuezte (nombre por confirmar)',0.60],['bebidas','Agua ½ litro',0.50],['bebidas','Agua 1 litro',1.00],
    ['bebidas','Chupetes',0.25],['bebidas','Cola pequeña',0.50],['bebidas','Cola ½ litro',0.80],
    ['bebidas','Cola 1 litro',1.75],['bebidas','Cola 3 litros',3.00],['bebidas','Güitig pequeña',0.50],
    ['bebidas','Güitig ½ litro',0.75],['bebidas','Güitig 1 litro',1.50],['bebidas','Güitig 3 litros',3.00],
    ['bebidas','Imperial',1.00],['bebidas','Monster',3.00],['bebidas','Sunny',0.60],
    ['bebidas','Pony Malta pequeña',0.60],['bebidas','Pony Malta en lata',1.00],
    ['bebidas','Sporade ½ litro',1.00],['bebidas','Sporade 1 litro',1.50],
    ['bebidas','Power ½ litro',1.00],['bebidas','Power 1 litro',1.50],
    ['bebidas','Mini Power',0.50],['bebidas','Saviloé',1.00],['bebidas','Vive 100',1.25],
    ['bebidas','220V pequeño',0.75],['bebidas','220V',1.25],['bebidas','Gatorade',1.25],['bebidas','Horchata',0.60],
    ['confiteria','Galleta Oreo grande',1.00],['confiteria','Jumbo maní mini',0.50],['confiteria','Galleta Marilín',1.00],
    ['confiteria','Galleta Oreo pequeña',0.50],['confiteria','Galleta Ritz / Ricas',0.50],
    ['confiteria','Chicles Agogo',0.25],['confiteria','Chicles Tumix',0.50],
    ['confiteria','Chicles Kataboom',0.10],['confiteria','Galleta Festival',0.25],
    ['confiteria','Chocolate Jet',0.75],['confiteria','Ducales',0.50],['confiteria','Grant Nuts',0.50],
    ['confiteria','Tumix',0.50],['confiteria','Agogo',0.25],['confiteria','Katabook',0.10],
    ['confiteria','Tosti Queso',0.30],['confiteria','Jumbo Mega',1.00],
    ['confiteria','Chicles Next',0.30],['confiteria','Moto Moto',0.50],['confiteria','Tik Tak',1.00],
    ['aseo','Pasta grande',1.50],['aseo','Pasta pequeña',1.25],['aseo','Cepillos',1.50],
    ['aseo','Toallas íntimas',1.50],['aseo','Fosforera',0.50],['aseo','Shampú',0.50],
    ['aseo','Prestobarba',0.50],['aseo','Gel',1.00],['aseo','Jabón',1.25],
    // El cuaderno de caja menciona sabores, pero no publica precios.
    ...['Coco','Mora','Taxo','Come bebé','Chocolate','Frutas','Chocobanana','Naranjilla','Piña','Guayul (revisar nombre)','Arazá','Mandarina','Fresa'].map(name=>['helados','Helado de '+name,null]),
    ['otros','Lavandería',null]
  ];
  const roomCompatible=(r,type)=>r.type===type || (r.type==='flex_aire'&&['individual','matrimonial'].includes(type)) || (r.type==='flex_ventilador'&&['individual_ventilador','matrimonial_ventilador'].includes(type));
  const roomTemplate = Object.entries(ROOM_LISTS).flatMap(([type,numbers])=>numbers.map(number=>({id:'room-'+number,number,type,status:type==='arrendada'?'arrendada':'disponible'})));
  roomTemplate.sort((a,b)=>Number(a.number)-Number(b.number));
  const defaults = () => ({
    rooms:roomTemplate.map(x=>({...x})),
    guests:[],reservations:[],stays:[],extras:[],stockMoves:[],cashMovements:[],closures:[],
    products:PRODUCT_CATALOG.map(([category,name,price],i)=>({id:'producto-'+String(i+1).padStart(3,'0'),category,name,price,stock:null})),
    config:{rates:JSON.parse(JSON.stringify(DEFAULT_RATES)),childRate:5,extraPersonRate:10,earlyFee:10}
  });
  function load(){
    if(window.hotelCloud?.ready && window.hotelCloud.data){
      return JSON.parse(JSON.stringify(window.hotelCloud.data));
    }
    try{
      const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaults();
      const data=JSON.parse(raw);const base=defaults();
      if(!data||!Array.isArray(data.rooms)||!Array.isArray(data.guests))return base;
      return {...base,...data,stockMoves:data.stockMoves||[],cashMovements:data.cashMovements||[],closures:data.closures||[],products:Array.isArray(data.products)?data.products:base.products,config:{...base.config,...data.config,rates:{...base.config.rates,...data.config?.rates}}};
    }catch(e){return defaults();}
  }
  let db=load();
  // This build loads the central Supabase snapshot after verified administrator login.
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const tomorrow=()=>{const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const datePretty=s=>{if(!s)return '—';const [y,m,d]=String(s).split('-').map(Number);if(!y||!m||!d)return String(s);return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d));};
  const timePretty=s=>new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s));
  const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(Number(n)||0);
  const asMoney=n=>Number.isFinite(Number(n))?Math.round(Number(n)*100)/100:0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const getNightCount=(from,to)=>{if(!from||!to)return 0;const a=Date.parse(from+'T12:00:00Z'),b=Date.parse(to+'T12:00:00Z');return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):0;};
  const overlap=(a,b,c,d)=>Boolean(a&&b&&c&&d&&a<d&&c<b);
  const rate=(type,breakfast)=>{const v=db.config.rates[type]?.[breakfast==='con'?'con':'sin'];return v===null||v===undefined||v===''?null:Number(v);};
  const rateLabel=(type,breakfast)=>rate(type,breakfast)===null?'Por definir':money(rate(type,breakfast));
  function checkinPaymentChoice(value){
    const v=String(value||'efectivo');
    if(!CHECKIN_PAYMENT_OPTIONS.some(option=>option[0]===v))return null;
    const discounted=v.endsWith('_descuento');
    const method=discounted?v.slice(0,-10):v;
    return {method,discounted};
  }
  function checkinNightRate(type,breakfast,paymentMethod){
    const normal=rate(type,breakfast);
    const choice=checkinPaymentChoice(paymentMethod);
    if(!choice)return null;
    if(!choice.discounted)return normal;
    if(choice.method!=='transferencia')return null;
    if(breakfast!=='sin'||normal===null)return null;
    const floor=DISCOUNT_ROOM_RATES[type];
    return Number.isFinite(floor)&&normal>=floor?floor:null;
  }
  function checkinRateLabel(type,breakfast,paymentMethod){
    const value=checkinNightRate(type,breakfast,paymentMethod);
    return value===null?'No aplica / revisar':money(value);
  }
  function checkinPaymentAmount(d,total,advance=0){
    const choice=checkinPaymentChoice(d.paymentMethod);
    if(!choice||total===null)return 0;
    return choice.method==='por_cobrar'?0:asMoney(Math.max(0,total-Number(advance||0)));
  }
  const localDateOf=iso=>{if(!iso)return '';const d=new Date(iso);return Number.isNaN(d.valueOf())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const sortProduct=(a,b)=>String(a.category).localeCompare(String(b.category))||a.name.localeCompare(b.name,'es');
  const guestName=g=>[g?.firstName,g?.secondName,g?.lastName,g?.secondLastName].filter(Boolean).join(' ').trim();
  function checkEcuadorDocument(value){
  const input=String(value??'').trim();
  if(!/^\d{10}(?:001)?$/.test(input))return {valid:false,error:'Ingrese 10 dígitos de cédula o 13 dígitos de RUC de persona natural terminado en 001.'};
  const cedula=input.slice(0,10),province=Number(cedula.slice(0,2)),third=Number(cedula[2]);
  if(!((province>=1&&province<=24&&third<=5)||(province===30&&(third===4||third===5))))
    return {valid:false,error:'La provincia o el tercer dígito no corresponde a una cédula ecuatoriana válida.'};
  const weights=[2,1,2,1,2,1,2,1,2];
  const sum=weights.reduce((n,w,i)=>{const product=Number(cedula[i])*w;return n+(product>9?product-9:product);},0);
  const verifier=(10-(sum%10))%10;
  if(verifier!==Number(cedula[9]))return {valid:false,error:'El dígito verificador de la cédula no es válido. Compruebe el número ingresado.'};
  return {valid:true,canonical:cedula,kind:input.length===13?'ruc_persona_natural':'cedula',document:input};
}
  const getGuestByDocument=doc=>{
    const searched=checkEcuadorDocument(doc);
    if(!searched.valid)return db.guests.find(x=>String(x.document||'').trim()===String(doc||'').trim());
    return db.guests.find(x=>{
      const existing=checkEcuadorDocument(x.document);
      return existing.valid&&existing.canonical===searched.canonical;
    });
  };
  const roomOf=id=>db.rooms.find(x=>x.id===id);
  const stayOf=id=>db.stays.find(x=>x.id===id);
  const reservationOf=id=>db.reservations.find(x=>x.id===id);
  const guestOf=id=>db.guests.find(x=>x.id===id);
  const activeStays=()=>db.stays.filter(x=>x.status==='activa');
  const occupied=roomId=>activeStays().some(x=>x.roomId===roomId);
  const extrasOf=stayId=>db.extras.filter(x=>x.stayId===stayId).reduce((s,e)=>s+e.price*e.quantity,0);
  const paidOf=stay=>asMoney((stay.advance||0)+(stay.payments||[]).reduce((s,p)=>s+p.amount,0));
  function additionalPeopleOf(stay){
  return asMoney((stay?.additionalPeople||[]).reduce((sum,p)=>sum+Number(p.amount||0),0));
}
  function extensionTotalOf(stay){
  return asMoney((stay?.extensions||[]).reduce((sum,e)=>sum+Number(e.amount||0),0));
}
  function initialLodgingOf(stay){
  return asMoney(Number(stay?.roomTotal||0)-extensionTotalOf(stay));
}
  function addIsoDays(date,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!Number.isInteger(days))return null;
  const ms=Date.parse(date+'T12:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)return null;
  const d=new Date(ms);d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
  function extensionBlocker(stay,until){
  const r=roomOf(stay?.roomId);
  if(!stay||stay.status!=='activa'||!r||r.status!=='ocupada')return 'La habitación no tiene una estadía activa.';
  if(!until||until<=stay.departure)return 'La nueva fecha no es válida.';
  const booked=db.reservations.some(b=>b.roomId===stay.roomId&&['pendiente','confirmada'].includes(b.status)&&overlap(stay.departure,until,b.arrival,b.departure));
  if(booked)return 'No se puede ampliar: existe otra reserva asignada a esta habitación.';
  const other=db.stays.some(s=>s.id!==stay.id&&s.status==='activa'&&s.roomId===stay.roomId&&overlap(stay.departure,until,s.arrival,s.departure));
  return other?'No se puede ampliar: existe otra estadía activa en ese período.':'';
}
  function stayHistoryEvents(stay){
  if(!stay)return [];
  const events=[],extensions=stay.extensions||[];
  const add=(date,title,description,amount,kind='info')=>events.push({
    id:String(events.length),date:String(date||''),title:String(title||''),
    description:String(description||''),amount:amount===null?null:asMoney(amount),kind
  });
  const initialNights=Math.max(1,getNightCount(stay.arrival,stay.departure)-extensions.reduce((n,e)=>n+Number(e.addedNights||1),0));
  add(stay.createdAt||stay.arrival,'Ingreso y hospedaje',initialNights+' noche(s) · '+money(stay.roomRate)+' por noche',initialLodgingOf(stay),'cargo');
  if(stay.creditApproval?.confirmed)add(stay.creditApproval.confirmedAt||stay.createdAt,
    'Ingreso por cobrar autorizado',
    'Doble confirmación en recepción · saldo pendiente al ingreso '+money(stay.creditApproval.amount),null,'info');
  const booking=stay.reservationId?reservationOf(stay.reservationId):null;
  if(Number(stay.advance)>0)add(booking?.createdAt||stay.createdAt,'Anticipo de reserva','Abono acreditado en esta estadía',stay.advance,'abono');
  extensions.forEach(e=>add(e.createdAt,Number(e.addedNights||1)===1?'Noche adicional':'Noches adicionales',Number(e.addedNights||1)+' noche(s) · '+datePretty(e.oldDeparture)+' → '+datePretty(e.newDeparture)+' · tarifa '+money(e.rate),e.amount,'cargo'));
  (stay.additionalPeople||[]).forEach(p=>add(p.createdAt,'Persona adicional · '+(p.category==='adulto'?'Adulto':'Niño de 6 a 12 años'),(p.name||'Acompañante')+' · '+Number(p.nights||1)+' noche(s) × '+money(p.unitPrice),p.amount,'cargo'));
  db.extras.filter(e=>e.stayId===stay.id).forEach(e=>add(e.createdAt,'Varios · '+e.productName,Number(e.quantity||1)+' × '+money(e.price),Number(e.price)*Number(e.quantity),'cargo'));
  (stay.payments||[]).forEach(p=>{
    add(p.createdAt,'Pago '+(p.method==='transferencia'?'por transferencia':'en efectivo'),
      (p.reference?'Referencia: '+p.reference:'')+(Number(p.cashChange)>0?' · efectivo recibido '+money(p.cashTendered)+'; vuelto '+money(p.cashChange):''),p.amount,'abono');
    if(Number(p.cashChange)>0){
      if(p.changeStatus==='pendiente')add(p.createdAt,'Vuelto pendiente','Dinero a favor del huésped; no reduce el saldo',p.cashChange,'vuelto');
      if(p.changeStatus==='dado')add(p.changeDeliveredAt||p.createdAt,'Vuelto entregado','Salida de efectivo de caja; no modifica el hospedaje',p.cashChange,'vuelto');
    }
  });
  if(booking&&Number(booking.cashChange)>0){
    if(booking.changeStatus==='pendiente')add(booking.createdAt,'Vuelto de anticipo pendiente','Obligación de devolución al huésped',booking.cashChange,'vuelto');
    if(booking.changeStatus==='dado')add(booking.changeDeliveredAt||booking.createdAt,'Vuelto de anticipo entregado','Salida de caja',booking.cashChange,'vuelto');
  }
  if(Number(stay.discountTotal)>0)add(stay.createdAt,'Tarifa de alojamiento con descuento','Ahorro de '+money(stay.discountTotal)+' sobre la tarifa normal · no se aplica a consumos ni acompañantes',null,'info');
  if(stay.status==='finalizada')add(stay.actualCheckout||stay.departure,'Cuenta cerrada y salida','Saldo del hospedaje: '+money(dueOf(stay))+' · habitación enviada a limpieza',null,'info');
  return events.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
}
  const totalOf=stay=>asMoney(Number(stay.roomTotal||0)+extrasOf(stay.id)+additionalPeopleOf(stay));
  const dueOf=stay=>asMoney(Math.max(0,totalOf(stay)-paidOf(stay)));
  // The money credited to a room is independent from cash physically received.
  // Change due back to the customer is a liability, not another lodging payment.
  const moneyCents=value=>Math.round(Number(value)*100);
  function resolveTendered(value,method,netAmount,changeStatus){
    const net=Number(netAmount),cents=moneyCents(net);
    if(!Number.isFinite(net)||net<0||!Number.isSafeInteger(cents)||cents<0)return {error:'Ingrese un importe válido.'};
    if(method!=='efectivo')return {received:asMoney(net),change:0,status:'no_aplica'};
    const raw=String(value??'').trim(),received=raw===''?net:Number(raw),receivedCents=moneyCents(received);
    if(cents===0&&receivedCents>0)return {error:'No registre efectivo recibido cuando el importe aplicado es cero.'};
    if(!Number.isFinite(received)||!Number.isSafeInteger(receivedCents)||receivedCents<cents)
      return {error:'El efectivo recibido debe ser igual o mayor al importe aplicado a la cuenta.'};
    const change=asMoney((receivedCents-cents)/100);
    if(change>0&&!['dado','pendiente'].includes(changeStatus))
      return {error:'Indique si entregó el vuelto o si quedó pendiente.'};
    return {received:asMoney(receivedCents/100),change,status:change>0?changeStatus:'no_aplica'};
  }
  const changePending=item=>item?.changeStatus==='pendiente'?asMoney(item.cashChange||0):0;
  function changeMovements(){
    const all=[];
    for(const b of db.reservations)if(Number(b.cashChange)>0)all.push({source:'reserva',id:b.id,owner:b,stayId:'',roomId:b.roomId||'',label:'Anticipo reserva · '+b.name});
    for(const s of db.stays)for(const pay of s.payments||[])if(Number(pay.cashChange)>0)all.push({source:'pago',id:pay.id,owner:pay,stayId:s.id,roomId:s.roomId,label:'Hab. '+(roomOf(s.roomId)?.number||'—')+' · cobro de hospedaje'});
    for(const e of db.extras)if(paidDirect(e)&&Number(e.cashChange)>0)all.push({source:'venta',id:e.id,owner:e,stayId:'',roomId:'',label:'Varios · '+e.productName});
    return all;
  }
  function pendingChangeOf(stay){
    return asMoney(changeMovements().filter(x=>(x.stayId===stay.id)||(stay.reservationId&&x.source==='reserva'&&x.id===stay.reservationId))
      .reduce((sum,x)=>sum+changePending(x.owner),0));
  }
  function paidCashRecord(base,details,stamp,shift){
    return {...base,cashTendered:details.received,cashChange:details.change,changeStatus:details.status,
      changeDeliveredAt:details.status==='dado'?stamp:null,
      changeDeliveredShift:details.status==='dado'?shift:null};
  }
  function cashChangeFields(prefix,data={}){
    return `<div class="cash-tender-zone section-gap" id="${prefix}-cash-zone">
      <div class="form-grid cols-2">
        ${field('Efectivo entregado por el huésped (USD)','cashTendered',data.cashTendered??'',{id:prefix+'-cashTendered',type:'number',min:0,step:'0.01',placeholder:'Ej. 40.00'})}
        <div class="field"><label>Vuelto calculado</label><div class="cash-change-preview" id="${prefix}-change-preview">${money(0)}</div></div>
      </div>
      <div class="cash-choice-wrap hidden" id="${prefix}-change-choice"><div class="mini-caption">¿Qué sucedió con el vuelto?</div>
        <div class="cash-choice-items"><label><input type="radio" name="changeStatus" value="dado" ${data.changeStatus==='dado'?'checked':''}><span>Vuelto dado</span></label><label><input type="radio" name="changeStatus" value="pendiente" ${data.changeStatus==='pendiente'?'checked':''}><span>Vuelto no dado · pendiente</span></label></div>
        <p class="mini-caption">Si queda pendiente, se registra como dinero que el hotel debe entregar al cliente.</p>
      </div>
    </div>`;
  }
  function updateCashPreview(formId,prefix,amount,method,active=true){
    const form=document.getElementById(formId),zone=document.getElementById(prefix+'-cash-zone');if(!form||!zone)return;
    const show=active&&method==='efectivo';zone.classList.toggle('hidden',!show);
    const raw=form.querySelector('[name=cashTendered]')?.value||'',tendered=raw===''?Number(amount):Number(raw);
    const change=Number.isFinite(tendered)?asMoney(tendered-Number(amount)):0;
    const preview=document.getElementById(prefix+'-change-preview');
    if(preview){preview.textContent=!Number.isFinite(tendered)?'Revise el importe':change<0?'Efectivo insuficiente':money(change);preview.classList.toggle('text-red',change<0);}
    document.getElementById(prefix+'-change-choice')?.classList.toggle('hidden',!show||change<=0);
  }
  const readForm=id=>{const e=document.getElementById(id);return e?Object.fromEntries(new FormData(e).entries()):{};};
  const validDoc=s=>checkEcuadorDocument(s).valid; // Validación estructural y de dígito verificador, no prueba identidad real.
  function persist(){
    if(window.hotelCloud?.ready){
      window.hotelCloud.save(db).catch(()=>toast('No se pudo iniciar la sincronización.','error'));
      return true;
    }
    // Offline fallback is for an isolated developer preview only.
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));return true;}
    catch(e){toast('No fue posible guardar los datos en este navegador.','error');return false;}
  }
  function toast(message,kind='ok'){
    const c=document.getElementById('toasts');const node=document.createElement('div');node.className='toast'+(kind==='error'?' error':'');node.textContent=message;c.append(node);setTimeout(()=>node.remove(),4600);
  }
  function head(kicker,title,subtitle,actions=''){
    return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:''}</div>`;
  }
  const btn=(text,action,cls='btn-primary',extra='')=>`<button class="btn ${cls}" data-action="${esc(action)}" ${extra}>${text}</button>`;
  const tag=(text,kind='')=>`<span class="small-tag ${kind}">${esc(text)}</span>`;
  const selectOptions=(values,selected)=>values.map(([v,l])=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(l)}</option>`).join('');
  const typeOptions=v=>selectOptions(TYPES.map(x=>[x,LABELS[x]]),v);
  const breakfastOptions=v=>selectOptions([['sin','Sin desayuno'],['con','Con desayuno']],v||'sin');
  const roomStateLabel=s=>({disponible:'Disponible',ocupada:'Ocupada',limpieza:'Pend. limpieza',arrendada:'Arrendada / fuera de operación'})[s]||'Desconocido';
  const statusTag=s=>tag(roomStateLabel(s),s==='disponible'?'success':s==='ocupada'?'danger':s==='arrendada'?'':'warning');
  const roomTile=r=>{
    const stay=activeStays().find(s=>s.roomId===r.id),due=stay?dueOf(stay):0,owed=stay?pendingChangeOf(stay):0;
    const hasDue=r.status==='ocupada'&&due>0;
    return `<button class="room-tile ${esc(r.status)} ${hasDue?'occupied-due':''}" data-action="select-room" data-id="${esc(r.id)}" title="Ver cuenta de habitación ${esc(r.number)}">
      <div class="room-topline"><span class="room-no">${esc(r.number)}</span>${stay?`<span class="room-due-amount ${hasDue?'unpaid':''}">${hasDue?`Por cobrar<br><strong>${money(due)}</strong>`:`Saldo ${money(0)}`}</span>`:''}</div>
      <div class="room-type">${esc(LABELS[r.type])}</div>
      ${stay?`<div class="room-tariff">Tarifa ${money(stay.roomRate)} / noche</div>`:''}
      <div class="room-badges">${hasDue?'<span class="room-badge occupied">Ocupada</span><span class="room-badge owing">Por cobrar</span>':`<span class="room-badge ${esc(r.status)}">${roomStateLabel(r.status)}</span>`}
      ${owed>0?`<span class="room-badge change-pending">Vuelto ${money(owed)}</span>`:''}</div>
    </button>`;
  };
  const roomsLegend=()=>`<div class="room-summary"><span><i class="legend-dot green"></i>Disponible</span><span><i class="legend-dot red"></i>Ocupada pagada</span><span><i class="legend-dot blue"></i>Ocupada por cobrar</span><span><i class="legend-dot yellow"></i>Pendiente de limpieza</span><span><i class="legend-dot gray"></i>Arrendada</span></div>`;
  const noRows=(message='Todavía no hay registros.')=>`<div class="empty"><div class="empty-icon">▧</div>${esc(message)}</div>`;
  const field=(title,name,value='',opts={})=>`<div class="field ${opts.full?'full':''}"><label for="${esc(opts.id||name)}">${esc(title)}${opts.required?' *':''}</label>${opts.textarea?`<textarea id="${esc(opts.id||name)}" name="${esc(name)}" placeholder="${esc(opts.placeholder||'')}" ${opts.required?'required':''}>${esc(value)}</textarea>`:`<input id="${esc(opts.id||name)}" name="${esc(name)}" type="${esc(opts.type||'text')}" value="${esc(value)}" placeholder="${esc(opts.placeholder||'')}" ${opts.required?'required':''} ${opts.min!==undefined?`min="${opts.min}"`:''} ${opts.max!==undefined?`max="${opts.max}"`:''} ${opts.step!==undefined?`step="${opts.step}"`:''} ${opts.maxlength?`maxlength="${opts.maxlength}"`:''} ${opts.readonly?'readonly':''} autocomplete="off">`}${opts.hint?`<div class="field-hint">${esc(opts.hint)}</div>`:''}</div>`;
  const select=(title,name,opts,value,extra='',domId=name)=>`<div class="field"><label for="${esc(domId)}">${esc(title)}</label><select id="${esc(domId)}" name="${esc(name)}" ${extra}>${selectOptions(opts,value)}</select></div>`;
  const guestFields=(g={})=>`<div class="form-grid cols-4">${field('Primer nombre','firstName',g.firstName,{required:true,placeholder:'Primer nombre'})}${field('Segundo nombre','secondName',g.secondName,{placeholder:'Segundo nombre'})}${field('Primer apellido','lastName',g.lastName,{required:true,placeholder:'Primer apellido'})}${field('Segundo apellido','secondLastName',g.secondLastName,{placeholder:'Segundo apellido'})}</div><div class="form-grid cols-3 section-gap">${field('Cédula o RUC personal','document',g.document,{required:true,placeholder:'10 dígitos o 13 terminados en 001',maxlength:13})}${field('Teléfono / WhatsApp','phone',g.phone,{required:true,placeholder:'09XXXXXXXX'})}${field('Correo electrónico','email',g.email,{type:'email',placeholder:'correo@ejemplo.com'})}</div>`;
  const lookupBlock=(scope,query,message,isFound)=>`<div class="lookup-box"><div class="lookup-line"><div class="field"><label for="lookup-${scope}">Buscar huésped por cédula o RUC de persona natural</label><input id="lookup-${scope}" inputmode="numeric" maxlength="13" placeholder="10 dígitos o 13 terminados en 001" value="${esc(query||'')}"></div>${btn('Buscar huésped','lookup-guest','btn-secondary',`data-scope="${scope}"`)}</div>${message?`<div class="lookup-result ${isFound?'':'notfound'}">${esc(message)}</div>`:''}</div>`;
  let ui={view:'inicio',selectedRoomId:null,selectedHistoryStayId:null,closedHistoryPage:0,checkinExtraRooms:[],checkinRowSeq:0,checkinVarios:[],checkinVariosSeq:0,checkinProductSearch:'',checkinVariosOpen:false,extraTarget:'caja',roomFilter:'todos',roomTypeFilter:'todos',roomDateMode:false,roomDate:null,lookup:{ingreso:'',huespedes:''},lookupMessage:{},lookupResult:{},checkinDraft:null,reservationDraft:null,reservationCreateOpen:false,reservationGuestSearchOpen:false,reservationGuestSearchQuery:'',selectedStayId:null,prefillBookingId:null,productCategory:'todas',stockCategory:'todas',cashDate:null,cashShift:'dia'};
  function initialCheckinDraft(){return {firstName:'',secondName:'',lastName:'',secondLastName:'',document:'',phone:'',email:'',arrival:today(),departure:tomorrow(),type:'individual',roomId:'',breakfast:'sin',paymentMethod:'efectivo',shift:'dia',transferCode:'',invoice:'no',invoiceName:'',invoiceId:'',invoiceAddress:'',invoiceEmail:'',notes:''};}
  function initialReservationDraft(){return {name:'',phone:'',document:'',arrival:today(),departure:tomorrow(),type:'individual',breakfast:'sin',roomId:'',advance:'0',advanceMethod:'efectivo',advanceRef:'',shift:'dia',notes:''};}
  function render(){
    if(!db.rooms.every(r=>['disponible','ocupada','limpieza','arrendada'].includes(r.status)))db.rooms.forEach(r=>{if(!['disponible','ocupada','limpieza','arrendada'].includes(r.status))r.status=r.type==='arrendada'?'arrendada':'disponible';});
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===ui.view));
    document.getElementById('breadcrumb').textContent=VIEWS[ui.view];
    const views={inicio:renderDashboard,habitaciones:renderRooms,ingreso:renderCheckin,reservas:renderReservations,salidas:renderCheckout,varios:renderExtras,inventario:renderStock,caja:renderCash,huespedes:renderGuests,configuracion:renderSettings};
    document.getElementById('app-view').innerHTML=(views[ui.view]||renderDashboard)()+`<div class="footer-note">Hotel Unicornio · Puerto Francisco de Orellana · ${window.hotelCloud?.ready?'Versión beta sincronizada con Supabase':'Prototipo local'}</div>`;
    updatePricing();
  }
  function navigate(view){if(view!=='reservas')ui.reservationGuestSearchOpen=false;if(view!=='varios')ui.extraTarget='caja';ui.view=view;document.getElementById('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});render();}
  function renderDashboard(){
    const available=db.rooms.filter(x=>x.status==='disponible').length,occ=db.rooms.filter(x=>x.status==='ocupada').length,dirty=db.rooms.filter(x=>x.status==='limpieza').length;
    const arrivals=db.reservations.filter(x=>x.arrival===today()&&['pendiente','confirmada'].includes(x.status));
    const arrivingSoon=db.reservations.filter(x=>x.arrival>=today()&&['pendiente','confirmada'].includes(x.status)).sort((a,b)=>a.arrival.localeCompare(b.arrival)).slice(0,5);
    const stays=activeStays().slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4);
    return head('Vista de operación','Buenos días, recepción','Resumen de habitaciones, huéspedes y movimientos del hotel.',btn('Nuevo ingreso','go-ingreso')+btn('Nueva reserva','go-reservas','btn-secondary'))+
    `<div class="metrics">
      <div class="metric"><div class="metric-top"><span class="metric-title">Habitaciones disponibles</span><span class="metric-icon">▦</span></div><div class="metric-value">${available}</div><div class="metric-sub"><strong>Listas</strong> para recibir huéspedes</div></div>
      <div class="metric"><div class="metric-top"><span class="metric-title">Habitaciones ocupadas</span><span class="metric-icon">⌂</span></div><div class="metric-value">${occ}</div><div class="metric-sub">${(db.rooms.length-db.rooms.filter(x=>x.status==='arrendada').length)?Math.round(100*occ/(db.rooms.length-db.rooms.filter(x=>x.status==='arrendada').length)):0}% de ocupación actual</div></div>
      <div class="metric"><div class="metric-top"><span class="metric-title">Pendientes de limpieza</span><span class="metric-icon">◉</span></div><div class="metric-value">${dirty}</div><div class="metric-sub">Requieren preparación</div></div>
      <div class="metric"><div class="metric-top"><span class="metric-title">Llegadas previstas hoy</span><span class="metric-icon">⇥</span></div><div class="metric-value">${arrivals.length}</div><div class="metric-sub">Reservas pendientes de ingreso</div></div>
    </div>
    <div class="split">
      <section class="panel"><div class="panel-head"><div><h2>Estado de habitaciones</h2><p>Distribución general · inventario según fotografía de recepción</p></div>${btn('Ver todas','go-habitaciones','btn-link')}</div><div class="panel-body">${roomsLegend()}</div><div class="room-grid">${db.rooms.slice(0,12).map(roomTile).join('')}</div></section>
      <div class="panel-stack"><section class="panel"><div class="panel-head"><div><h2>Próximas llegadas</h2><p>Reservas previstas desde hoy</p></div>${btn('Ver reservas','go-reservas','btn-link')}</div><div class="panel-body">${arrivingSoon.length?arrivingSoon.map(b=>`<div class="arrival-row"><div class="arrival-avatar">${esc(b.name.slice(0,1).toUpperCase())}</div><div class="flex-grow"><strong>${esc(b.name)}</strong><div class="meta">${datePretty(b.arrival)} · ${esc(LABELS[b.type])}</div></div>${tag(b.status==='confirmada'?'Confirmada':'Pendiente',b.status==='confirmada'?'success':'warning')}</div>`).join(''):noRows('No hay llegadas previstas.')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Huéspedes alojados</h2><p>Estadías en curso</p></div>${btn('Ver salidas','go-salidas','btn-link')}</div><div class="panel-body">${stays.length?stays.map(s=>`<div class="arrival-row"><div class="arrival-avatar">${esc(roomOf(s.roomId)?.number||'—')}</div><div class="flex-grow"><strong>${esc(guestName(guestOf(s.guestId)))}</strong><div class="meta">Salida: ${datePretty(s.departure)}</div></div>${tag(dueOf(s)>0?'Saldo '+money(dueOf(s)):'Pagado',dueOf(s)>0?'warning':'success')}</div>`).join(''):noRows('Todavía no hay huéspedes alojados.')}</div></section></div>
    </div><div class="dashboard-notice"><strong>Estado inicial:</strong> se muestran las habitaciones identificadas en el listado entregado, incluidas las arrendadas. Verifique los datos transcritos y sus estados reales en <button class="btn btn-link" data-action="go-configuracion">Tarifas y ajustes</button>.</div>`;
  }
  function renderPaymentForm(stay){
    const due=dueOf(stay);
    return `<form id="payment-form" class="section-gap">
      <input type="hidden" name="stayId" value="${esc(stay.id)}">
      <div class="form-grid cols-2">
        ${select('Método de pago','method',[['efectivo','Efectivo'],['transferencia','Transferencia']],'efectivo')}
        ${select('Turno','shift',[['dia','Día'],['noche','Noche']],'dia')}
        ${field('Importe a aplicar a la cuenta (USD)','amount',due>0?due:'',{type:'number',min:0.01,step:'0.01',required:true})}
      </div>
      ${cashChangeFields('payment')}
      <div class="field hidden section-gap" id="payment-reference"><label for="reference">Código de transferencia *</label><input id="reference" name="reference" placeholder="Referencia bancaria"></div>
      <button class="btn btn-primary section-gap" type="submit" ${due<=0?'disabled':''}>Registrar pago</button>
    </form>`;
  }
  function renderRoomExtraSection(stay){
  const available=db.products.filter(p=>p.price!==null&&Number(p.price)>0).slice().sort(sortProduct);
  return `<details class="phase2-operation" id="phase2-extras"><summary><span>Agregar varios a la habitación</span><small>Se cargarán a la cuenta, sin recibir dinero todavía</small></summary>
    <div class="phase2-operation-body"><form id="room-extra-form">
      <input type="hidden" name="stayId" value="${esc(stay.id)}">
      <div class="form-grid cols-2">
        ${select('Producto','productId',[['','Seleccione un producto'],...available.map(p=>[p.id,`${p.name} · ${money(p.price)}${p.stock!==null?' · stock '+p.stock:''}`])],'','required','room-extra-product')}
        ${field('Cantidad','quantity','1',{id:'room-extra-quantity',type:'number',min:1,max:1000,step:1,required:true})}
        ${select('Turno','shift',shiftOptions,'dia','','room-extra-shift')}
        ${field('Encargado','operator','',{id:'room-extra-operator',placeholder:'Recepción'})}
      </div>
      <div id="room-extra-preview" class="phase2-preview">Seleccione un producto.</div>
      <button class="btn btn-primary section-gap" type="submit" ${available.length?'':'disabled'}>Agregar consumo a la cuenta</button>
      <div class="mini-caption">Los productos sin precio definido se registran desde el catálogo completo de Varios.</div>
    </form></div></details>`;
}

  function renderBreakfastSection(stay){
    return `<details class="phase2-operation" id="phase2-breakfast"><summary><span>Agregar desayunos</span><small>${money(BREAKFAST_EXTRA_PRICE)} por unidad · cantidad a elección</small></summary>
      <div class="phase2-operation-body"><form id="room-breakfast-form">
        <input type="hidden" name="stayId" value="${esc(stay.id)}">
        <div class="form-grid cols-2">
          ${field('Cantidad de desayunos','quantity','1',{id:'room-breakfast-quantity',type:'number',min:1,max:100,step:1,required:true})}
          ${select('Turno','shift',shiftOptions,'dia','','room-breakfast-shift')}
          ${field('Encargado','operator','',{id:'room-breakfast-operator',placeholder:'Recepción'})}
        </div>
        <div class="phase2-preview" id="room-breakfast-preview">1 desayuno × ${money(BREAKFAST_EXTRA_PRICE)} = ${money(BREAKFAST_EXTRA_PRICE)}</div>
        ${stay.breakfast==='con'?'<p class="mini-caption">La tarifa de esta estadía ya incluye desayuno. Añada solo desayunos adicionales solicitados.</p>':''}
        <button type="submit" class="btn btn-primary section-gap">Agregar desayunos a la cuenta</button>
        <p class="mini-caption">Se registra un cargo pendiente; no ingresa dinero en caja hasta cobrarlo.</p>
      </form></div></details>`;
  }

  function renderAdditionalPersonSection(stay){
  const adult=Number(db.config.extraPersonRate??10),child=Number(db.config.childRate??5),maxNights=Math.max(1,getNightCount(stay.arrival,stay.departure));
  return `<details class="phase2-operation" id="phase2-people"><summary><span>Agregar persona adicional</span><small>Adultos ${money(adult)} · niños ${money(child)} por persona y noche aplicada</small></summary>
    <div class="phase2-operation-body"><form id="room-person-form">
      <input type="hidden" name="stayId" value="${esc(stay.id)}">
      <div class="form-grid cols-2">
        ${field('Nombre de la persona adicional','name','',{id:'room-person-name',required:true,placeholder:'Nombre y apellido',maxlength:100})}
        ${select('Categoría','category',[['adulto','Adulto mayor de 12 años'],['nino','Niño de 6 a 12 años']],'adulto','','room-person-category')}
        ${field('Noches a cobrar','nights','1',{id:'room-person-nights',type:'number',min:1,max:maxNights,step:1,required:true,hint:'Debe indicar expresamente por cuántas noches se cobra.'})}
        ${select('Turno','shift',shiftOptions,'dia','','room-person-shift')}
        ${field('Encargado','operator','',{id:'room-person-operator',placeholder:'Recepción'})}
      </div>
      <div id="room-person-preview" class="phase2-preview">Cargo estimado: ${money(adult)} por 1 noche.</div>
      <button type="submit" class="btn btn-primary section-gap">Agregar persona y registrar cargo</button>
      <p class="mini-caption section-gap">Se registra una persona por operación. Este cargo no constituye un registro oficial de identidad; confirme la tarifa antes de guardar.</p>
    </form></div></details>`;
}

  function extensionQuote(stay,nights){
    const n=Number(nights),max=365-getNightCount(stay.arrival,stay.departure);
    if(!Number.isSafeInteger(n)||n<1||n>90||n>max)return {error:'Seleccione entre 1 y 90 noches, sin superar 365 noches totales.'};
    const newDeparture=addIsoDays(stay.departure,n);
    if(!newDeparture)return {error:'No fue posible calcular la fecha de salida.'};
    const blocker=extensionBlocker(stay,newDeparture);
    if(blocker)return {error:blocker,newDeparture};
    const cents=moneyCents(stay.roomRate);
    if(!Number.isSafeInteger(cents)||cents<=0||cents>1000000)return {error:'La tarifa histórica de la habitación no es válida.'};
    return {nights:n,newDeparture,total:asMoney(n*cents/100)};
  }
  function renderExtendStaySection(stay){
    const quote=extensionQuote(stay,1);
    return `<details class="phase2-operation" id="phase2-extension"><summary><span>Extender estadía</span><small>1 o varias noches · ${money(stay.roomRate)} por noche</small></summary>
      <div class="phase2-operation-body"><form id="room-extension-form">
        <input type="hidden" name="stayId" value="${esc(stay.id)}">
        <div class="form-grid cols-2">
          ${field('Noches adicionales','nights','1',{id:'room-extension-nights',type:'number',min:1,max:90,step:1,required:true})}
          ${select('Turno','shift',shiftOptions,'dia','','room-extension-shift')}
          ${field('Encargado','operator','',{id:'room-extension-operator',placeholder:'Recepción'})}
        </div>
        <div class="phase2-preview" id="room-extension-preview">Salida actual: ${datePretty(stay.departure)} · Nueva salida: ${quote.newDeparture?datePretty(quote.newDeparture):'Revisar'} · Cargo: ${money(quote.total||0)}</div>
        <div id="room-extension-error" class="phase2-warning ${quote.error?'':'hidden'}">${esc(quote.error||'')}</div>
        <button id="room-extension-submit" class="btn btn-primary section-gap" type="submit" ${quote.error?'disabled':''}>Confirmar extensión</button>
        <p class="mini-caption">Se comprueban todas las noches nuevas frente a reservas y estadías; las reservas previas no se modifican.</p>
      </form></div></details>`;
  }
  function renderFinalAccountSection(stay){
  const due=dueOf(stay),pending=pendingChangeOf(stay);
  return `<details class="phase2-operation phase2-final" id="phase2-final"><summary><span>Cierre de cuenta final y salida</span><small>${due>0?'Saldo por cobrar '+money(due):'Sin saldo de hospedaje'} · pasar habitación a limpieza</small></summary>
    <div class="phase2-operation-body">
      <div class="phase2-total-grid">
        <div><span>Total hospedaje</span><strong>${money(stay.roomTotal)}</strong></div>
        <div><span>Varios</span><strong>${money(extrasOf(stay.id))}</strong></div>
        <div><span>Personas adicionales</span><strong>${money(additionalPeopleOf(stay))}</strong></div>
        <div><span>Abonado</span><strong>${money(paidOf(stay))}</strong></div>
        <div class="emphasis"><span>Pago final pendiente</span><strong>${money(due)}</strong></div>
        <div><span>Vuelto anterior pendiente</span><strong>${money(pending)}</strong></div>
      </div>
      <form id="finalize-form">
        <input type="hidden" name="stayId" value="${esc(stay.id)}">
        ${due>0?`<div class="form-grid cols-2 section-gap">
          ${select('Cobrar saldo mediante','method',[['efectivo','Efectivo'],['transferencia','Transferencia']],'efectivo','','final-method')}
          ${select('Turno','shift',shiftOptions,'dia','','final-shift')}
        </div>
        ${cashChangeFields('final')}
        <div class="field hidden section-gap" id="final-reference-field"><label for="final-reference">Referencia bancaria *</label><input id="final-reference" name="reference" placeholder="Número de transferencia"></div>`:
        '<p class="mini-caption section-gap">La cuenta está pagada. No se registrará ningún cobro adicional.</p><input type="hidden" name="shift" value="dia">'}
        ${field('Encargado del cierre','operator','',{id:'final-operator',placeholder:'Recepción',required:true})}
        <button class="btn btn-primary section-gap" type="submit">${due>0?'Cobrar '+money(due)+' y cerrar cuenta':'Cerrar cuenta y registrar salida'}</button>
        <p class="mini-caption section-gap">El cierre debe quedar pagado. Si hay vuelto no entregado, se solicitará una confirmación y seguirá registrado como deuda del hotel.</p>
      </form>
    </div></details>`;
}
  function renderStayTimeline(stay){
  const events=stayHistoryEvents(stay);
  return `<div class="phase2-timeline"><div class="phase2-timeline-title"><h3>Historial de movimientos</h3>
    ${btn('Exportar CSV','export-stay-history','btn-secondary btn-sm',`data-id="${esc(stay.id)}"`)}</div>
    <p class="mini-caption">${events.length} registros · cargos, abonos, consumos, noches y salida</p>
    ${events.length?`<div class="phase2-timeline-list">${events.map(e=>`<div class="phase2-event ${esc(e.kind)}">
      <span class="phase2-event-dot"></span>
      <div class="phase2-event-body"><strong>${esc(e.title)}</strong>
        <small>${esc(e.description)}</small>
        <time>${esc(e.date&&Number.isFinite(new Date(e.date).valueOf())?new Date(e.date).toLocaleString('es-EC'):e.date||'—')}</time>
      </div>
      <span class="phase2-event-money">${e.amount===null?'—':`${e.kind==='abono'?'−':e.kind==='cargo'?'+':''}${money(e.amount)}`}</span>
    </div>`).join('')}</div>`:noRows('No hay movimientos todavía.')}
  </div>`;
}
  function renderClosedHistoryDialog(stay){
  const room=roomOf(stay.roomId),guest=guestOf(stay.guestId);
  return `<div class="account-overlay" data-action="close-history-dialog" role="presentation">
    <div class="account-dialog" role="dialog" aria-modal="true" aria-label="Historial de habitación ${esc(room?.number||'—')}" data-account-dialog>
      <div class="account-dialog-header"><div><span class="eyebrow">HISTORIAL DE ESTADÍA</span><h2>Habitación ${esc(room?.number||'—')}</h2><p>${esc(guestName(guest))} · ${datePretty(stay.arrival)} a ${datePretty(stay.departure)}</p></div>
        <div class="account-heading-total"><span>Saldo al cerrar</span><strong>${money(dueOf(stay))}</strong></div>
        <button class="account-close" data-action="close-history-dialog" type="button" aria-label="Cerrar historial">×</button></div>
      <div class="account-dialog-body">
        <div class="phase2-total-grid"><div><span>Hospedaje</span><strong>${money(stay.roomTotal)}</strong></div><div><span>Adicionales</span><strong>${money(additionalPeopleOf(stay))}</strong></div><div><span>Varios</span><strong>${money(extrasOf(stay.id))}</strong></div><div><span>Total pagado</span><strong>${money(paidOf(stay))}</strong></div></div>
        ${renderStayTimeline(stay)}
        <p class="mini-caption section-gap">Este historial incluye los movimientos registrados en la aplicación. No equivale a una factura electrónica.</p>
      </div></div></div>`;
}
  function renderClientRooms(stay){
  if(!stay)return '';
  const all=activeStays().filter(item=>item.guestId===stay.guestId).slice()
    .sort((a,b)=>(roomOf(a.roomId)?.number||'').localeCompare(roomOf(b.roomId)?.number||'',undefined,{numeric:true}));
  if(all.length<2)return '';
  const sum=asMoney(all.reduce((n,item)=>n+dueOf(item),0));
  return `<section class="client-rooms-account" aria-label="Habitaciones vinculadas a este cliente">
    <div class="client-rooms-title"><div><strong>Habitaciones del mismo titular</strong><p>Un cliente tiene ${all.length} habitaciones activas. Cada habitación posee sus propios cargos y pagos.</p></div>
      <div class="client-rooms-sum"><span>Por cobrar entre todas</span><strong>${money(sum)}</strong></div></div>
    <div class="client-rooms-links">${all.map(item=>{
      const current=item.id===stay.id,number=roomOf(item.roomId)?.number||'—';
      return current?`<span class="client-room-current" aria-current="true">Hab. ${esc(number)} · Actual · ${money(dueOf(item))}</span>`:
        btn('Hab. '+esc(number)+' · '+money(dueOf(item)),'select-room','btn-secondary btn-sm',
          `type="button" data-id="${esc(item.roomId)}" aria-label="Abrir cuenta de habitación ${esc(number)}"`);
    }).join('')}</div>
  </section>`;
}
  function renderRoomAccount(room,stay){
  const guest=stay?guestOf(stay.guestId):null,owed=stay?pendingChangeOf(stay):0,due=stay?dueOf(stay):0;
  const charges=stay?db.extras.filter(e=>e.stayId===stay.id):[];
  const pays=stay?(stay.payments||[]):[];
  const extensions=stay?(stay.extensions||[]):[];
  const extrasPeople=stay?(stay.additionalPeople||[]):[];
  const originalNights=stay?Math.max(1,getNightCount(stay.arrival,stay.departure)-extensions.reduce((n,e)=>n+Number(e.addedNights||1),0)):0;
  const history=stay?`
    <div class="account-summary">
      <div class="account-main-total"><span>Saldo pendiente</span><strong class="${due>0?'text-red':'text-green'}">${money(due)}</strong></div>
      <details class="account-totals-details"><summary>Ver resumen de importes · Total ${money(totalOf(stay))} · Abonado ${money(paidOf(stay))}</summary><div class="account-total-grid">
        <div><span>Tarifa por noche</span><strong>${money(stay.roomRate)}</strong></div>
        <div><span>Noches totales</span><strong>${getNightCount(stay.arrival,stay.departure)}</strong></div>
        <div><span>Hospedaje</span><strong>${money(stay.roomTotal)}</strong></div>
        <div><span>Varios</span><strong>${money(extrasOf(stay.id))}</strong></div>
        <div><span>Personas adicionales</span><strong>${money(additionalPeopleOf(stay))}</strong></div>
        <div><span>Total cuenta</span><strong>${money(totalOf(stay))}</strong></div>
        <div><span>Abonos y anticipos</span><strong>${money(paidOf(stay))}</strong></div>
        <div><span>Acompañantes facturados</span><strong>${extrasPeople.length}</strong></div>
      </div></details>
      ${owed>0?`<div class="account-change-due"><strong>Vuelto pendiente de entregar: ${money(owed)}</strong><span>Es dinero a favor del huésped y no reduce el saldo de hospedaje.</span></div>`:''}
    </div>
    ${renderClientRooms(stay)}
    <div class="account-columns"><details class="account-info-details"><summary>Datos del huésped</summary><div class="account-info-content">
      <div class="account-detail"><span>Nombre</span><strong>${esc(guestName(guest)||'No disponible')}</strong></div>
      <div class="account-detail"><span>Documento</span><strong>${esc(guest?.document||'—')}</strong></div>
      <div class="account-detail"><span>Teléfono</span><strong>${esc(guest?.phone||'—')}</strong></div>
      <div class="account-detail"><span>Correo</span><strong>${esc(guest?.email||'—')}</strong></div>
      <div class="account-detail"><span>Ingreso</span><strong>${datePretty(stay.arrival)}</strong></div>
      <div class="account-detail"><span>Salida prevista</span><strong>${datePretty(stay.departure)}</strong></div>
      <div class="account-detail"><span>Desayuno</span><strong>${stay.breakfast==='con'?'Incluido':'No incluido'}</strong></div>
      ${stay.notes?`<div class="account-detail"><span>Observaciones</span><strong>${esc(stay.notes)}</strong></div>`:''}
    </div></details><details class="account-info-details"><summary>Desglose de la cuenta</summary><div class="account-info-content">
      <div class="account-line"><div><strong>Hospedaje inicial · ${originalNights} noche(s)</strong><small>${money(stay.roomRate)} / noche</small></div><strong>${money(initialLodgingOf(stay))}</strong></div>
      ${extensions.map(e=>`<div class="account-line"><div><strong>Ampliación de estadía</strong><small>${datePretty(e.oldDeparture)} → ${datePretty(e.newDeparture)}</small></div><strong>${money(e.amount)}</strong></div>`).join('')}
      ${extrasPeople.map(p=>`<div class="account-line"><div><strong>Persona adicional: ${esc(p.name||'Acompañante')}</strong><small>${p.category==='adulto'?'Adulto':'Niño de 6 a 12 años'} · ${p.nights} noche(s) × ${money(p.unitPrice)}</small></div><strong>${money(p.amount)}</strong></div>`).join('')}
      ${charges.map(e=>`<div class="account-line"><div><strong>${esc(e.productName)}</strong><small>${e.quantity} × ${money(e.price)}</small></div><strong>${money(e.price*e.quantity)}</strong></div>`).join('')}
      ${stay.advance>0?`<div class="account-line paid"><div><strong>Anticipo</strong><small>Reserva vinculada</small></div><strong>−${money(stay.advance)}</strong></div>`:''}
      ${pays.map(p=>`<div class="account-line paid"><div><strong>Pago por ${p.method==='transferencia'?'transferencia':'efectivo'}</strong><small>${esc(p.createdAt?new Date(p.createdAt).toLocaleString('es-EC'):'')} ${p.cashChange>0?' · recibido '+money(p.cashTendered)+' · vuelto '+money(p.cashChange)+' ('+(p.changeStatus==='pendiente'?'pendiente':'dado')+')':''}</small></div><strong>−${money(p.amount)}</strong></div>`).join('')}
      ${!charges.length&&!pays.length&&!extrasPeople.length&&!extensions.length&&!(stay.advance>0)?'<p class="mini-caption">Sin otros movimientos todavía.</p>':''}
    </div></details></div>
    <div class="account-actions">
      ${btn('Catálogo completo de Varios','room-add-extras','btn-secondary',`data-id="${esc(stay.id)}"`)}
      ${btn('Ver salidas y cobros','room-go-checkout','btn-secondary',`data-id="${esc(stay.id)}"`)}
      <span class="mini-caption">Todos los cargos y abonos se incluyen en el saldo de esta habitación.</span>
    </div>
    <div class="phase2-operation-list">
      ${renderRoomExtraSection(stay)}
      ${renderBreakfastSection(stay)}
      ${renderAdditionalPersonSection(stay)}
      ${renderExtendStaySection(stay)}
      ${renderFinalAccountSection(stay)}
    </div>
    <details class="phase2-history section-gap">
      <summary>Ver historial completo de movimientos (${stayHistoryEvents(stay).length})</summary>
      ${renderStayTimeline(stay)}
    </details>
    <details class="account-payment-section"><summary>Registrar abono parcial o total</summary><div class="account-payment-content"><p class="mini-caption">Para pagar y registrar la salida en una sola operación, utilice «Cierre de cuenta final». Si recibe más efectivo, registre el vuelto.</p>
      ${renderPaymentForm(stay)}
    </div></details>
    ${owed>0?`<div class="account-change-actions"><strong>Vueltos pendientes a esta habitación</strong>${changeMovements().filter(x=>changePending(x.owner)>0&&((x.stayId===stay.id)||(stay.reservationId&&x.source==='reserva'&&x.id===stay.reservationId))).map(x=>`<div class="account-line"><div><span>${esc(x.label)}</span><strong>${money(changePending(x.owner))}</strong></div>${btn('Entregar vuelto','settle-change','btn-secondary btn-sm',`data-source="${esc(x.source)}" data-id="${esc(x.id)}"`)}</div>`).join('')}</div>`:''}
  `:`<div class="account-empty">
     <p>${room.status==='arrendada'?'Habitación arrendada; fuera del inventario operativo.':room.status==='limpieza'?'En limpieza. Marque disponible cuando esté lista.':'No hay estadía activa en esta habitación.'}</p>
     ${room.status==='disponible'?btn('Registrar ingreso','start-room-checkin','btn-primary',`data-id="${esc(room.id)}"`):''}
     ${room.status==='limpieza'?btn('Marcar limpia / disponible','mark-room-clean','btn-primary',`data-id="${esc(room.id)}"`):''}
     ${room.status==='disponible'?btn('Marcar pendiente de limpieza','mark-room-dirty','btn-secondary',`data-id="${esc(room.id)}"`):''}
   </div>`;
  return `<div class="account-overlay" data-action="close-room-account" role="presentation">
    <div class="account-dialog" role="dialog" aria-modal="true" aria-label="Cuenta de habitación ${esc(room.number)}" data-account-dialog>
      <div class="account-dialog-header"><div><span class="eyebrow">CUENTA POR HABITACIÓN</span><h2>Habitación ${esc(room.number)}</h2><p>${esc(LABELS[room.type])} · ${roomStateLabel(room.status)}</p></div>
        <div class="account-heading-total"><span>Saldo por cobrar</span><strong>${money(due)}</strong></div>
        <button class="account-close" data-action="close-room-account" type="button" aria-label="Cerrar cuenta de habitación">×</button></div>
      <div class="account-dialog-body">${history}</div>
    </div></div>`;
}
  function roomDateValid(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&addIsoDays(value,0)===value&&value>=today();
}
  function roomPlanningDate(){
  return ui.roomDateMode&&roomDateValid(ui.roomDate)?ui.roomDate:today();
}
  function roomPlanForDate(room,date=roomPlanningDate()){
  const valid=roomDateValid(date)?date:today();
  const booking=db.reservations.find(b=>b.roomId===room.id&&['pendiente','confirmada'].includes(b.status)&&b.arrival<=valid&&b.departure>valid)||null;
  const stay=activeStays().find(s=>s.roomId===room.id&&s.arrival<=valid&&s.departure>valid)||null;
  const arriving=db.reservations.filter(b=>b.roomId===room.id&&['pendiente','confirmada'].includes(b.status)&&b.arrival===valid);
  const leaving=db.stays.filter(s=>s.roomId===room.id&&s.status==='activa'&&s.departure===valid);
  let status='libre',label='Libre previsto',note='Sujeto a salidas y limpieza';
  if(room.status==='arrendada'){status='arrendada';label='Arrendada';note='Fuera de operación';}
  else if(stay){status='ocupada';label='Ocupada prevista';note='Hasta '+datePretty(stay.departure);}
  else if(booking){status='reservadas';label='Reservada';note='Llega '+datePretty(booking.arrival)+' · Sale '+datePretty(booking.departure);}
  else if(valid===today()&&room.status==='ocupada'){status='ocupada';label='Ocupada (estado actual)';note='Salida por confirmar';}
  else if(room.status==='limpieza'){status='limpieza';label='Pendiente de limpieza';note='Limpieza no confirmada';}
  return {status,label,note,room,stay,booking,arriving,leaving,day:valid};
}
  function roomPlansForDate(date=roomPlanningDate()){
  return db.rooms.map(room=>roomPlanForDate(room,date));
}
  function roomPrintData(date=roomPlanningDate()){
  const projected=Boolean(ui.roomDateMode);
  const plans=roomPlansForDate(date);
  const summary={occupied:0,reserved:0,free:0,cleaning:0,rented:0};
  const rows=plans.map(p=>{
    const physical=p.room.status;
    const state=projected?p.status:(physical==='disponible'?'libre':physical);
    if(state==='ocupada')summary.occupied++;
    else if(state==='reservadas')summary.reserved++;
    else if(state==='libre')summary.free++;
    else if(state==='limpieza')summary.cleaning++;
    else if(state==='arrendada')summary.rented++;
    const currentLabels={disponible:'Disponible / limpia',ocupada:'Ocupada',limpieza:'Pendiente de limpieza',arrendada:'Arrendada'};
    return {
      number:String(p.room.number),type:LABELS[p.room.type]||p.room.type,
      status:projected?p.label:(currentLabels[physical]||'Sin estado'),
      arrival:p.booking?.arrival||p.stay?.arrival||p.arriving[0]?.arrival||'',
      departure:p.booking?.departure||p.stay?.departure||p.leaving[0]?.departure||'',
      note:projected?p.note:(p.booking?'Reserva registrada · Llega '+datePretty(p.booking.arrival):'Estado físico de recepción'),
      isArrival:p.arriving.length>0,isDeparture:p.leaving.length>0
    };
  });
  return {date,summary,rows,projected};
}
  function reservedRoomIds(){
    const valid=new Set(db.rooms.filter(r=>r.status!=='arrendada').map(r=>r.id));
    return new Set(db.reservations.filter(b=>
      ['pendiente','confirmada'].includes(b.status)&&b.departure>today()&&valid.has(b.roomId)
    ).map(b=>b.roomId));
  }
  function roomOverviewCounts(){
  if(ui.roomDateMode){
    const plans=roomPlansForDate();
    const duePlans=plans.filter(p=>p.status==='ocupada'&&p.stay&&dueOf(p.stay)>0);
    return {occupied:plans.filter(p=>p.status==='ocupada').length,
      clean:plans.filter(p=>p.status==='libre').length,
      owing:duePlans.length,reserved:plans.filter(p=>p.status==='reservadas').length,
      receivable:asMoney(duePlans.reduce((n,p)=>n+dueOf(p.stay),0))};
  }
  const rooms=db.rooms,active=activeStays(),openStaysByRoom=new Map(active.map(st=>[st.roomId,st]));
  const occupied=rooms.filter(r=>r.status==='ocupada').length;
  const clean=rooms.filter(r=>r.status==='disponible').length;
  const owingStays=rooms.filter(r=>r.status==='ocupada').map(r=>openStaysByRoom.get(r.id)).filter(st=>st&&dueOf(st)>0);
  const owing=owingStays.length;
  const receivable=asMoney(owingStays.reduce((n,st)=>n+dueOf(st),0));
  const reserved=reservedRoomIds().size;
  return {occupied,clean,owing,reserved,receivable};
}
  function renderRoomsOverview(){
  const c=roomOverviewCounts(),future=Boolean(ui.roomDateMode);
  const card=(filter,title,number,subtitle,symbol,kind,label)=>{
    const selected=ui.roomFilter===filter;
    return `<button type="button" class="metric rooms-kpi rooms-kpi-${kind}${selected?' is-active':''}"
      data-action="filter-room-summary" data-id="${filter}" aria-pressed="${selected}"
      aria-label="${esc(label)}" title="${esc(label)}">
      <div class="metric-top"><span class="metric-title">${title}</span><span class="metric-icon" aria-hidden="true">${symbol}</span></div>
      <div class="metric-value">${number}</div>
      <div class="metric-sub">${subtitle}</div>
    </button>`;
  };
  return `<div class="metrics rooms-overview" role="group" aria-label="Filtrar mapa por indicadores de habitaciones">
    ${card('ocupada','Ocupadas',c.occupied,future?'Con alojamiento previsto':'Con huéspedes alojados','⌂','occupied','Filtrar habitaciones ocupadas')}
    ${card('disponible',future?'Libres previstas':'Limpias',c.clean,future?'Sin ocupación registrada · limpieza por confirmar':'Disponibles para ingresar','✓','clean','Filtrar habitaciones disponibles')}
    ${card('por-cobrar','X/C',c.owing,'Ocupadas por cobrar · '+money(c.receivable),'$','owing','Filtrar habitaciones ocupadas con saldo por cobrar')}
    ${card('reservadas','Reservadas',c.reserved,future?'Con reserva en la fecha':'Habitaciones apartadas desde hoy','▤','reserved','Filtrar habitaciones reservadas')}
  </div>`;
}
  function roomForecastTile(plan){
  const r=plan.room,owed=plan.stay?dueOf(plan.stay):0;
  const css=plan.status==='libre'?'disponible':plan.status==='reservadas'?'reserved-planned':plan.status;
  const tag=plan.status==='libre'?'Libre previsto':plan.label;
  const detail=plan.booking?`Reserva: ${datePretty(plan.booking.arrival)} – ${datePretty(plan.booking.departure)}`:plan.stay?`Estadía: ${datePretty(plan.stay.arrival)} – ${datePretty(plan.stay.departure)}`:plan.note;
  const flags=[plan.arriving.length?'Llegada de reserva':null,plan.leaving.length?'Salida prevista':null].filter(Boolean);
  return `<button type="button" class="room-tile ${esc(css)} room-forecast" data-action="select-room" data-id="${esc(r.id)}" title="Consultar habitación ${esc(r.number)} para ${esc(datePretty(plan.day))}">
    <div class="room-topline"><span class="room-no">${esc(r.number)}</span>${plan.stay&&owed>0?`<span class="room-due-amount unpaid">Por cobrar<br><strong>${money(owed)}</strong></span>`:''}</div>
    <div class="room-type">${esc(LABELS[r.type]||r.type)}</div>
    <div class="room-forecast-range">${esc(detail)}</div>
    <div class="room-badges"><span class="room-badge ${esc(css)}">${esc(tag)}</span></div>
    ${flags.length?`<div class="room-forecast-flags">${flags.map(x=>`<small>${esc(x)}</small>`).join('')}</div>`:''}
  </button>`;
}
  function renderRoomDatePicker(){
  if(!ui.roomDateMode)return '';
  const date=roomPlanningDate(),rows=roomPlansForDate(date);
  const summary={occupied:rows.filter(x=>x.status==='ocupada').length,
    reserved:rows.filter(x=>x.status==='reservadas').length,
    free:rows.filter(x=>x.status==='libre').length};
  return `<div class="room-date-panel" id="room-date-panel">
    <div class="room-date-choice">
      <label for="room-plan-date">Consultar ocupación para</label>
      <input id="room-plan-date" type="date" min="${today()}" value="${esc(date)}" aria-label="Fecha de ocupación prevista">
      ${btn('Hoy','room-plan-today','btn-secondary btn-sm',`type="button"`)}
      ${btn('Mañana','room-plan-tomorrow','btn-secondary btn-sm',`type="button"`)}
      ${btn('Estado actual','toggle-room-dates','btn-secondary btn-sm',`type="button"`)}
    </div>
    <div class="room-date-note"><strong>${esc(datePretty(date))}</strong> · ${summary.occupied} ocupadas previstas · ${summary.reserved} reservadas · ${summary.free} libres previstas.
      La disponibilidad futura depende de las salidas y limpiezas pendientes; no se garantiza que una habitación esté físicamente lista.
      Las fechas de salida liberan la noche siguiente y las reservas sin habitación asignada no aparecen en el mapa.
    </div>
  </div>`;
}
  function renderRoomPlanDetail(room,plan){
  if(!plan)return '';
  return `<section class="panel room-date-detail" aria-label="Planificación de habitación seleccionada">
    <div class="panel-head"><div><h2>Planificación · habitación ${esc(room.number)}</h2>
      <p>${esc(datePretty(plan.day))} — ${esc(plan.label)}</p></div></div>
    <div class="room-date-detail-body">
      <div><strong>Información prevista:</strong> ${esc(plan.note)}</div>
      ${plan.booking?`<div><strong>Reserva:</strong> entrada ${datePretty(plan.booking.arrival)} · salida ${datePretty(plan.booking.departure)}</div>`:''}
      ${plan.arriving.length?`<div><strong>Llegada programada:</strong> ${plan.arriving.length} reserva(s) para esta fecha</div>`:''}
      ${plan.leaving.length?`<div><strong>Salidas programadas:</strong> ${plan.leaving.length} estadía(s) finalizan este día</div>`:''}
      <small>La ficha de cuenta que aparece debajo corresponde al estado actual, no a un cobro futuro.</small>
    </div>
  </section>`;
}
  function roomHousekeepingPrintHtml(report){
  const generated=new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short'}).format(new Date());
  const fmt=d=>d?datePretty(d):'—';
  const rows=report.rows.map(x=>`<tr>
    <td class="num">${esc(x.number)}</td><td>${esc(x.type)}</td>
    <td class="status">${esc(x.status)}</td>
    <td>${esc(fmt(x.arrival))}${x.isArrival?' · Llega':''}</td>
    <td>${esc(fmt(x.departure))}${x.isDeparture?' · Sale':''}</td>
    <td class="check"></td><td class="note"></td>
  </tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Hotel Unicornio · Camarería · ${esc(report.date)}</title>
    <style>
    @page{size:A4 landscape;margin:13mm 12mm}
    *{box-sizing:border-box}body{margin:0;color:#192d24;font:11px Arial,sans-serif}
    h1{font:700 21px Georgia,serif;margin:0 0 4px}h2{font:700 13px Arial,sans-serif;margin:0 0 12px}
    .header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #2b5b43;padding-bottom:11px;margin-bottom:10px}
    .meta{font-size:10px;color:#526459;text-align:right;line-height:1.7}
    .summary{display:flex;gap:16px;flex-wrap:wrap;border:1px solid #d8e5d9;background:#f5f8f4;padding:8px 10px;margin:8px 0 12px}
    .summary strong{font-size:13px}.summary span{font-size:10px}
    .notelead{font-size:9px;color:#626b61;margin:10px 0}
    table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}
    thead{display:table-header-group}tr{break-inside:avoid}
    th,td{border:1px solid #aab5aa;padding:6px 5px;text-align:left;vertical-align:middle;min-height:23px;overflow-wrap:anywhere}
    th{background:#e9f0ea;font-size:9px;text-transform:uppercase}
    td.num{font-size:13px;font-weight:800;text-align:center}
    td.status{font-weight:700}td.check{text-align:center}
    tr:nth-child(even) td{background:#fafcf9}
    .footer{margin-top:12px;display:flex;gap:26px;justify-content:space-between;font-size:10px;align-items:end}
    .signature{border-bottom:1px solid #8c9a8e;min-width:170px;height:28px}
    .no-print{margin-bottom:12px;font:12px Arial,sans-serif}
    .no-print button{background:#285f49;color:white;padding:8px 14px;border:0;border-radius:5px;cursor:pointer}
    @media print{.no-print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="no-print"><button type="button" onclick="window.print()">Imprimir reporte</button></div>
    <header class="header"><div><h1>Hotel Unicornio</h1><h2>REPORTE DE CAMARERÍA — ${esc(datePretty(report.date))}</h2></div>
      <div class="meta">Fecha de consulta: ${esc(report.date)}<br>Generado: ${esc(generated)}<br>Puerto Francisco de Orellana, Ecuador</div></header>
    <div class="summary"><span><strong>${report.summary.occupied}</strong> ocupadas</span>
      <span><strong>${report.summary.reserved}</strong> reservadas</span>
      <span><strong>${report.summary.free}</strong> ${report.projected?'libres previstas':'disponibles / limpias'}</span>
      <span><strong>${report.summary.cleaning}</strong> por limpiar</span>
      <span><strong>${report.summary.rented}</strong> arrendadas</span>
      <span><strong>${report.rows.length}</strong> habitaciones</span></div>
    <table><thead><tr><th style="width:6%">Habitación</th><th style="width:18%">Tipo</th>
      <th style="width:17%">Estado</th><th style="width:13%">Llegada</th>
      <th style="width:13%">Salida</th><th style="width:11%">Limpieza ✓</th>
      <th style="width:22%">Observaciones / novedades</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="notelead">Reporte operativo. ${report.projected?'Las fechas planificadas son previsiones basadas en ingresos y reservas registrados.':'Los estados corresponden al mapa físico actual; reservas y salidas son informativas.'} Una salida prevista no confirma que se haya realizado limpieza. No contiene datos personales de huéspedes.</div>
    <footer class="footer"><div>Elaboró / Recepción<div class="signature"></div></div>
      <div>Verificó / Camarería<div class="signature"></div></div>
      <div>Observaciones generales<div class="signature" style="min-width:270px"></div></div></footer>
    </body></html>`;
}
  function printHousekeepingReport(){
  const date=roomPlanningDate();
  const html=roomHousekeepingPrintHtml(roomPrintData(date));
  const page=window.open('','_blank','width=1100,height=780');
  if(!page){toast('El navegador bloqueó la ventana de impresión. Autorice ventanas emergentes para imprimir el reporte de camarería.','error');return;}
  page.opener=null;
  page.document.open();
  page.document.write(html);
  page.document.close();
  page.focus();
  page.print();
}
  function renderRooms(){
  const dateMode=Boolean(ui.roomDateMode),date=roomPlanningDate();
  const plans=dateMode?roomPlansForDate(date):[];
  const byId=dateMode?new Map(plans.map(x=>[x.room.id,x])):new Map();
  const reservedIds=dateMode?new Set(plans.filter(x=>x.status==='reservadas').map(x=>x.room.id)):reservedRoomIds();
  const debtIds=new Set(activeStays().filter(st=>dueOf(st)>0).map(st=>st.roomId));
  const filtered=db.rooms.filter(r=>{
    if(ui.roomTypeFilter!=='todos'&&r.type!==ui.roomTypeFilter)return false;
    if(ui.roomFilter==='todos')return true;
    if(dateMode){
      const p=byId.get(r.id);
      if(ui.roomFilter==='reservadas')return p.status==='reservadas';
      if(ui.roomFilter==='por-cobrar')return p.status==='ocupada'&&p.stay&&dueOf(p.stay)>0;
      if(ui.roomFilter==='disponible')return p.status==='libre';
      return p.status===ui.roomFilter;
    }
    if(ui.roomFilter==='reservadas')return reservedIds.has(r.id);
    if(ui.roomFilter==='por-cobrar')return r.status==='ocupada'&&debtIds.has(r.id);
    return r.status===ui.roomFilter;
  });
  const selected=roomOf(ui.selectedRoomId);
  const stay=selected?activeStays().find(st=>st.roomId===selected.id):null;
  const unpaid=activeStays().filter(st=>dueOf(st)>0),totalReceivable=asMoney(unpaid.reduce((n,st)=>n+dueOf(st),0));
  const filteredTitle=dateMode?`Vista prevista para ${datePretty(date)}`:`${db.rooms.length} habitaciones · ${unpaid.length} con saldo por cobrar · total pendiente ${money(totalReceivable)}`;
  return head('Control operativo','Habitaciones','Toque una habitación para abrir su cuenta, revisar cargos y registrar pagos.',btn('Nuevo ingreso','go-ingreso'))+
    renderRoomsOverview()+
    `<section class="panel" id="room-map">
      <div class="panel-head"><div><h2>Mapa de habitaciones</h2><p>${filteredTitle}</p></div>${roomsLegend()}</div>
      <div class="filters room-filters-bar">
        <div class="room-filter-selects">
          <select id="filter-room-status" aria-label="Filtrar por estado">${selectOptions([['todos','Todos los estados'],['disponible',dateMode?'Libres previstas':'Disponibles'],['ocupada','Ocupadas'],['por-cobrar','Ocupadas por cobrar'],['reservadas','Reservadas'],['limpieza','Pendientes de limpieza'],['arrendada','Arrendadas']],ui.roomFilter)}</select>
          <select id="filter-room-type" aria-label="Filtrar por tipo">${selectOptions([['todos','Todos los tipos'],...ROOM_TYPES.map(x=>[x,LABELS[x]])],ui.roomTypeFilter)}</select>
        </div>
        <div class="room-filter-actions">
          ${btn((dateMode?'Cerrar fechas':'Ver por fecha'),'toggle-room-dates',dateMode?'btn-light':'btn-secondary',`type="button" aria-expanded="${dateMode}"`)}
          ${btn('Imprimir reporte camarería','print-housekeeping','btn-secondary',`type="button"`)}
        </div>
      </div>
      ${renderRoomDatePicker()}
      <div class="room-grid">${filtered.length?filtered.map(r=>dateMode?roomForecastTile(byId.get(r.id)):roomTile(r)).join(''):noRows('No hay habitaciones que coincidan con el filtro y la fecha.')}</div>
    </section>
    ${selected&&dateMode?renderRoomPlanDetail(selected,byId.get(selected.id)):''}
    ${selected?renderRoomAccount(selected,stay):''}`;
}
  function availableForCheckin(r,arrival,departure,excludeReservationId){
    if(r.status!=='disponible'||activeStays().some(s=>s.roomId===r.id))return false;
    return !db.reservations.some(b=>b.id!==excludeReservationId&&b.roomId===r.id&&['pendiente','confirmada'].includes(b.status)&&overlap(arrival,departure,b.arrival,b.departure));
  }
  function availableForBooking(r,arrival,departure,excludeReservationId){
    if(db.reservations.some(b=>b.id!==excludeReservationId&&b.roomId===r.id&&['pendiente','confirmada'].includes(b.status)&&overlap(arrival,departure,b.arrival,b.departure)))return false;
    if(db.stays.some(s=>s.status==='activa'&&s.roomId===r.id&&overlap(arrival,departure,s.arrival,s.departure)))return false;
    if(arrival<=today()&&r.status!=='disponible')return false;
    return true;
  }
  function checkinAssignments(d){
  const main={key:'principal',type:String(d.type||'individual'),breakfast:String(d.breakfast||'sin'),roomId:String(d.roomId||''),primary:true};
  const extras=(ui.checkinExtraRooms||[]).map(row=>{
    const key=row.key;
    return {key,type:String(d[key+'__type']||'individual'),breakfast:String(d[key+'__breakfast']||'sin'),roomId:String(d[key+'__roomId']||''),primary:false};
  });
  return [main,...extras];
}
  function syncCheckinVariosForm(){
  const form=document.getElementById('checkin-form');
  if(!form)return;
  const values=readForm('checkin-form');
  for(const row of ui.checkinVarios||[]){
    if(values[row.key+'__qty']!==undefined)row.quantity=values[row.key+'__qty'];
    if(values[row.key+'__room']!==undefined)row.roomKey=values[row.key+'__room'];
  }
}
  function quoteCheckinVarios(d){
  const assigned=checkinAssignments(d),validKeys=new Set(assigned.map(e=>e.key));
  const rows=[],byProduct=new Map();
  let cents=0;
  for(const row of ui.checkinVarios||[]){
    const p=productOf(row.productId),quantity=Number(row.quantity);
    if(!p||p.price===null||!Number.isFinite(Number(p.price))||Number(p.price)<=0||
       !Number.isSafeInteger(moneyCents(p.price))||moneyCents(p.price)<=0)
      return {error:'Un producto agregado no tiene precio válido. Revise la lista de Varios.'};
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)
      return {error:'La cantidad de '+p.name+' debe ser un número entero entre 1 y 1000.'};
    if(!validKeys.has(row.roomKey))return {error:'Seleccione una habitación válida para el consumo '+p.name+'.'};
    const lineCents=moneyCents(p.price)*quantity;
    if(!Number.isSafeInteger(lineCents)||cents+lineCents>100000000)
      return {error:'El total de Varios excede el límite de esta operación.'};
    cents+=lineCents;
    const count=(byProduct.get(p.id)||0)+quantity;byProduct.set(p.id,count);
    if(p.stock!==null&&count>Number(p.stock))
      return {error:'Inventario insuficiente de '+p.name+'. Disponibles: '+p.stock+', solicitados: '+count+'.'};
    rows.push({key:row.key,roomKey:row.roomKey,product:p,productId:p.id,quantity,
      price:asMoney(p.price),total:asMoney(lineCents/100)});
  }
  return {items:rows,total:asMoney(cents/100),error:null};
}
  function filterCheckinProducts(query){
  const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const needle=norm(query);
  if(!needle)return [];
  return db.products.filter(p=>p.price!==null&&Number(p.price)>0&&
    (norm(p.name).includes(needle)||norm(CATEGORIES[p.category]||p.category).includes(needle)))
    .sort(sortProduct).slice(0,12);
}
  function renderCheckinProductResults(query){
  const matches=filterCheckinProducts(query);
  if(!String(query||'').trim())return '<p class="mini-caption">Escriba el nombre de un producto, por ejemplo: agua, cola, galleta o champú.</p>';
  if(!matches.length)return '<p class="mini-caption">No hay productos con precio definido que coincidan. Revise el catálogo en Varios.</p>';
  return matches.map(p=>`<div class="checkin-product-result">
    <div><strong>${esc(p.name)}</strong><small>${esc(CATEGORIES[p.category]||p.category)} · ${p.stock===null?'Stock sin conteo':p.stock+' unidades disponibles'}</small></div>
    <span>${money(p.price)}</span>
    ${btn('Agregar','checkin-add-product','btn-secondary btn-sm',`type="button" data-id="${esc(p.id)}" ${p.stock!==null&&p.stock<=0?'disabled':''}`)}
  </div>`).join('');
}
  function renderCheckinVarios(d){
  const assignments=checkinAssignments(d);
  const roomOptions=assignments.map((room,i)=>[room.key,
    (room.roomId?'Hab. '+(roomOf(room.roomId)?.number||'—'):i===0?'Habitación principal':'Habitación '+(i+1)+' (sin asignar)')]);
  const quote=quoteCheckinVarios(d),total=quote.error?'Revisar consumos':money(quote.total);
  return `<details id="checkin-varios-panel" class="group-rooms checkin-varios" aria-label="Varios para este huésped" ${ui.checkinVariosOpen?'open':''}>
    <summary class="checkin-varios-toggle">
      <span class="checkin-varios-toggle-title"><strong>Varios para este mismo huésped</strong>
        <small>${(ui.checkinVarios||[]).length} producto(s) seleccionados</small></span>
      <span class="checkin-varios-toggle-price"><small>Total de Varios</small><strong>${total}</strong></span>
      <span class="checkin-varios-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div class="checkin-varios-content">
      <p class="checkin-varios-intro">Busque productos y agréguelos al momento del ingreso. Cada consumo se cargará a la habitación que elija.</p>
    <div class="field checkin-varios-search"><label for="checkin-varios-search">Buscar producto en Varios</label>
      <input type="search" id="checkin-varios-search" autocomplete="off" placeholder="Buscar agua, gaseosa, galletas, aseo…" value="${esc(ui.checkinProductSearch||'')}">
    </div>
    <div class="checkin-product-results" id="checkin-product-results" aria-live="polite">${renderCheckinProductResults(ui.checkinProductSearch)}</div>
    <div class="checkin-varios-selected" id="checkin-varios-selected">${(ui.checkinVarios||[]).map((row,i)=>{
      const p=productOf(row.productId),subtotal=p?Number(p.price||0)*Number(row.quantity||0):0;
      return `<div class="checkin-vario-row"><div class="checkin-vario-heading"><strong>${i+1}. ${esc(p?.name||'Producto no disponible')}</strong>
        ${btn('Quitar','checkin-remove-product','btn-secondary btn-sm',`type="button" data-id="${esc(row.key)}"`)}</div>
        <div class="checkin-vario-fields">
          ${field('Cantidad',row.key+'__qty',row.quantity,{id:row.key+'-qty',type:'number',min:1,max:1000,step:1})}
          ${select('Cargar a habitación',row.key+'__room',roomOptions,row.roomKey,'',row.key+'-room')}
          <div class="checkin-vario-subtotal"><span>Subtotal</span><strong id="${esc(row.key)}-subtotal">${money(subtotal)}</strong></div>
        </div></div>`;
    }).join('')||'<p class="mini-caption">Todavía no se han agregado consumos. También puede hacerlo posteriormente desde la cuenta de la habitación.</p>'}</div>
    ${quote.error?`<p class="discount-rule-warning">${esc(quote.error)}</p>`:''}
    <div class="group-breakdown-line group-breakdown-total checkin-varios-total"><span>Total de Varios</span><strong id="checkin-varios-total">${total}</strong></div>
    <p class="mini-caption">Los Varios nunca tienen descuento. Se agregan al saldo de la habitación y al cálculo de cobro, y descuentan existencias si existe inventario registrado.</p>
    </div>
  </details>`;
}
  function checkinGroupEstimate(d){
    const nights=getNightCount(d.arrival,d.departure),entries=checkinAssignments(d);
    const quote=quoteCheckinVarios(d);
    const items=entries.map(e=>{
      const normalNightly=rate(e.type,e.breakfast);
      const nightly=checkinNightRate(e.type,e.breakfast,d.paymentMethod);
      const total=nightly===null||!Number.isFinite(nightly)||nightly<0?null:asMoney(nights*nightly);
      const saved=total===null||normalNightly===null?0:asMoney((normalNightly-nightly)*nights);
      const variosTotal=quote.error?0:asMoney(quote.items.filter(row=>row.roomKey===e.key).reduce((n,row)=>n+row.total,0));
      return {...e,nightly,normalNightly,total,saved,variosTotal,
        fullTotal:total===null?null:asMoney(total+variosTotal)};
    });
    const total=items.some(e=>e.total===null)?null:asMoney(items.reduce((sum,e)=>sum+e.total,0));
    const variosTotal=quote.error?null:quote.total;
    const grandTotal=total===null||variosTotal===null?null:asMoney(total+variosTotal);
    return {nights,items,total,variosTotal,grandTotal,variosError:quote.error||null,varios:quote.items||[]};
  }
  function prepareCheckinGroup(d,booking=null){
    const choice=checkinPaymentChoice(d.paymentMethod);
    if(!choice)return {error:'Seleccione una forma de pago válida.'};
    if(choice.discounted){
      if(choice.method!=='transferencia')return {error:'El precio con descuento solo está autorizado para transferencia.'};
      if(d.invoice==='si')return {error:'La tarifa con descuento está disponible únicamente sin solicitud de factura.'};
      if(booking)return {error:'No se puede aplicar el descuento a una reserva previamente confirmada con otra tarifa. Mantenga el precio de la reserva.'};
      if(checkinAssignments(d).some(item=>item.breakfast!=='sin'))
        return {error:'Los precios con descuento proporcionados son únicamente sin desayuno. Seleccione sin desayuno o utilice tarifa normal.'};
    }
    const estimate=checkinGroupEstimate(d);
    if(estimate.variosError)return {error:estimate.variosError};
    if(!Number.isSafeInteger(estimate.nights)||estimate.nights<1)return {error:'La fecha de salida debe ser posterior a la de entrada.'};
    if(estimate.items.length<1||estimate.items.length>db.rooms.filter(r=>r.type!=='arrendada').length)
      return {error:'Número de habitaciones inválido para este ingreso.'};
    if(booking&&(!['pendiente','confirmada'].includes(booking.status)||booking.type!==estimate.items[0].type||
         (booking.roomId&&booking.roomId!==estimate.items[0].roomId)))
      return {error:'La habitación principal debe coincidir con la reserva vinculada, su tarifa y sus fechas.'};
    const ids=new Set();
    for(const item of estimate.items){
      if(!TYPES.includes(item.type)||!['con','sin'].includes(item.breakfast))
        return {error:'Hay un tipo de habitación o desayuno no válido.'};
      if(item.total===null)return {error:'Tarifa no disponible: revise el tipo de habitación, el desayuno o el límite del descuento.'};
      const room=roomOf(item.roomId);
      if(!room||!roomCompatible(room,item.type)||!availableForCheckin(room,d.arrival,d.departure,item.primary?booking?.id:null))
        return {error:'La habitación '+(room?.number||'seleccionada')+' no está disponible o no corresponde al tipo solicitado.'};
      if(ids.has(room.id))return {error:'Una habitación no puede asignarse dos veces al mismo ingreso. Revise las seleccionadas.'};
      ids.add(room.id);
    }
    const depositCents=moneyCents(booking?.advance||0);
    const firstTotalCents=moneyCents(estimate.items[0].total),totalCents=moneyCents(estimate.grandTotal);
    if(!Number.isSafeInteger(depositCents)||depositCents<0||depositCents>firstTotalCents)
      return {error:'El anticipo excede el precio de la habitación principal. Revise la reserva.'};
    const amountCents=choice.method==='por_cobrar'?0:totalCents-depositCents;
    const payment=asMoney(amountCents/100);
    // No se permite recibir huéspedes sin un pago confirmado o una autorización de crédito.
    if(choice.method==='por_cobrar' && (totalCents-depositCents)>0 && d.creditConfirmed!=='si')
      return {error:'Para registrar una habitación por cobrar active la primera confirmación. Se pedirá otra al guardar.'};
    if(choice.method!=='por_cobrar' && amountCents>0){
      if(d.paymentVerified!=='si')
        return {error:'Debe confirmar la recepción del dinero o la acreditación bancaria antes de registrar el ingreso.'};
      if(choice.method==='efectivo' && String(d.cashTendered??'').trim()==='')
        return {error:'Ingrese el efectivo recibido del huésped; no se permite registrar un cobro sin contar el dinero.'};
    }
    // Any submitted paymentAmount (including a forged HTML field) is deliberately ignored.
    if(choice.method==='transferencia'&&amountCents>0&&!String(d.transferCode||'').trim())
      return {error:'Ingrese el número de referencia de la transferencia.'};
    const tender=choice.method==='por_cobrar'
      ?{received:0,change:0,status:'no_aplica'}
      :resolveTendered(d.cashTendered,choice.method,payment,d.changeStatus);
    if(tender.error)return {error:tender.error};
    let remaining=amountCents,changeAllocated=false;
    const items=estimate.items.map((e,i)=>{
      const advanceCents=i===0?depositCents:0,chargeCents=moneyCents(e.total)+moneyCents(e.variosTotal)-advanceCents;
      const appliedCents=Math.min(remaining,chargeCents);remaining-=appliedCents;
      const assignedChangeCents=!changeAllocated&&appliedCents>0?moneyCents(tender.change):0;
      if(appliedCents>0)changeAllocated=true;
      const allocatedTender={received:asMoney((appliedCents+assignedChangeCents)/100),
        change:asMoney(assignedChangeCents/100),
        status:assignedChangeCents>0?tender.status:'no_aplica'};
      return {...e,advance:asMoney(advanceCents/100),payment:asMoney(appliedCents/100),
        tender:allocatedTender,room:roomOf(e.roomId)};
    });
    if(remaining!==0)return {error:'No se pudo distribuir el pago. Revise los importes.'};
    return {...estimate,items,deposit:asMoney(depositCents/100),payment,
      method:choice.method,discounted:choice.discounted,tender,error:null};
  }
  function renderCheckinExtraRooms(d){
  const entries=checkinAssignments(d),nights=getNightCount(d.arrival,d.departure);
  return `<section class="group-rooms" aria-label="Habitaciones adicionales del cliente">
    <div class="group-rooms-heading"><div><strong>Más habitaciones para este mismo cliente</strong><p>Un cliente puede tener varias habitaciones. Cada habitación mantiene su propia cuenta y solo un titular.</p></div>
      ${btn('＋ Agregar otra habitación','add-checkin-room','btn-secondary',`type="button" ${entries.length>=25?'disabled':''}`)}</div>
    ${entries.slice(1).map((entry,index)=>`<div class="group-room-item">
      <div class="group-room-top"><strong>Habitación adicional ${index+2}</strong>
      ${btn('Quitar','remove-checkin-room','btn-secondary btn-sm',`type="button" data-id="${esc(entry.key)}"`)}</div>
      <div class="form-grid cols-3">
        ${select('Tipo de habitación',entry.key+'__type',TYPES.map(x=>[x,LABELS[x]]),entry.type,'',entry.key+'-type')}
        ${select('Desayuno',entry.key+'__breakfast',[['sin','Sin desayuno'],['con','Con desayuno']],entry.breakfast,'',entry.key+'-breakfast')}
        ${select('Asignar habitación',entry.key+'__roomId',checkinRoomOptions({...d,type:entry.type,primary:false},entries.slice(0,index+1).map(e=>e.roomId)),entry.roomId,'required',entry.key+'-room')}
      </div>
      <div class="group-room-price"><span>Tarifa por noche</span><strong id="${esc(entry.key)}-rate">${checkinRateLabel(entry.type,entry.breakfast,d.paymentMethod)}</strong>
        <span>Subtotal ${nights} noche(s)</span><strong id="${esc(entry.key)}-total">${checkinNightRate(entry.type,entry.breakfast,d.paymentMethod)===null?'No aplica':money(nights*checkinNightRate(entry.type,entry.breakfast,d.paymentMethod))}</strong></div>
    </div>`).join('')}
    ${entries.length>1?`<p class="mini-caption section-gap">Las ${entries.length} habitaciones se registrarán a nombre del mismo cliente, con saldos individuales. El pago inicial se distribuye en el orden mostrado.</p>`:''}
  </section>`;
}
  function renderCheckinBreakdown(d){
  const {items,nights,total,variosTotal,grandTotal}=checkinGroupEstimate(d);
  return `<div class="group-breakdown" id="checkin-room-breakdown">
    ${items.map((e,i)=>`<div class="group-breakdown-line"><div><strong>${e.roomId?`Hab. ${esc(roomOf(e.roomId)?.number||'—')}`:i===0?'Habitación principal':'Habitación adicional '+(i+1)}</strong>
      <small>${esc(LABELS[e.type])} · ${e.breakfast==='con'?'Con desayuno':'Sin desayuno'} · ${nights} noche(s)${e.saved>0?' · Ahorra '+money(e.saved):''}${e.variosTotal>0?' · Varios '+money(e.variosTotal):''}</small></div>
      <strong>${e.total===null?'Por definir':money(e.total)}</strong></div>`).join('')}
    <div class="group-breakdown-line"><span>Hospedaje</span><strong>${total===null?'Por definir':money(total)}</strong></div>
    <div class="group-breakdown-line"><span>Varios agregados al ingresar</span><strong>${variosTotal===null?'Revisar':money(variosTotal)}</strong></div>
    <div class="group-breakdown-line group-breakdown-total"><span>Total hospedaje + Varios</span><strong>${grandTotal===null?'Por definir':money(grandTotal)}</strong></div>
  </div>`;
}
  function checkinRoomOptions(d,excluded=[]){
    const roomExcluded=new Set(excluded.filter(Boolean));
    const rooms=db.rooms.filter(r=>!roomExcluded.has(r.id)&&roomCompatible(r,d.type)&&
      availableForCheckin(r,d.arrival,d.departure,d.primary===false?null:ui.prefillBookingId));
    return [['','Seleccionar habitación disponible'],...rooms.map(r=>[r.id,'Habitación '+r.number])];
  }
  function renderCheckin(){
    const d=ui.checkinDraft||(ui.checkinDraft=initialCheckinDraft());
    const estimation=checkinGroupEstimate(d),nights=estimation.nights,nightRate=checkinNightRate(d.type,d.breakfast,d.paymentMethod),stayTotal=estimation.grandTotal,b=reservationOf(ui.prefillBookingId);
    const bookedAdvance=b?.advance||0,initialPayment=checkinPaymentAmount(d,stayTotal,bookedAdvance),choice=checkinPaymentChoice(d.paymentMethod),amountPending=asMoney(Math.max(0,(stayTotal||0)-bookedAdvance));
    return head('Recepción / check-in','Registrar ingreso de huésped','Búsqueda por cédula y asignación de una o varias habitaciones al mismo titular.',btn('Ver habitaciones','go-habitaciones','btn-secondary'))+
    `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Nuevo registro de hospedaje</h2><p>Complete los datos obligatorios marcados con *</p></div>${tag('Ingreso','success')}</div>
      <div class="panel-body">${b?`<div class="info-strip"><span>Reserva vinculada: <strong>${esc(b.name)}</strong> · ${datePretty(b.arrival)} · anticipo ${money(bookedAdvance)}</span><button class="btn btn-link" data-action="unlink-booking">Quitar</button></div>`:''}
      ${lookupBlock('ingreso',ui.lookup.ingreso,ui.lookupMessage.ingreso,ui.lookupResult.ingreso)}
      <form id="checkin-form">
        <div class="form-section-label">01 · Datos del huésped</div>${guestFields(d)}
        <div class="form-section-label">02 · Detalles de alojamiento</div><div class="form-grid cols-3">
          ${field('Fecha de entrada','arrival',d.arrival,{type:'date',required:true})}${field('Fecha de salida','departure',d.departure,{type:'date',required:true})}
          ${select('Tipo de habitación','type',TYPES.map(x=>[x,LABELS[x]]),d.type)}
          ${select('Desayuno','breakfast',[['sin','Sin desayuno'],['con','Con desayuno']],d.breakfast)}
          ${select('Asignar habitación','roomId',checkinRoomOptions({...d,primary:true}),d.roomId,'required')}
          <div class="field"><label>Precio por noche</label><div class="readonly-info" id="checkin-night-rate">${checkinRateLabel(d.type,d.breakfast,d.paymentMethod)}</div></div>
        </div>
        ${renderCheckinExtraRooms(d)}
        ${renderCheckinVarios(d)}
        <section class="checkin-payment-compact" aria-label="Forma de pago y tarifa"><div class="form-section-label">03 · Forma de pago y tarifa</div><div class="form-grid cols-3 compact-payment-grid">
          ${select('Forma de pago / precio','paymentMethod',CHECKIN_PAYMENT_OPTIONS,d.paymentMethod||'efectivo')}
          ${select('Turno de recepción','shift',[['dia','Día'],['noche','Noche']],d.shift||'dia')}
          <div class="field compact-payment-value"><label>Valor a cobrar en el ingreso</label><div class="readonly-info checkin-auto-pay" id="checkin-auto-payment" title="Calculado automáticamente; no editable">${money(initialPayment)}</div></div>
          <div class="field ${choice?.method==='transferencia'?'':'hidden'}" id="transfer-field"><label for="transferCode">Código de transferencia *</label><input name="transferCode" id="transferCode" placeholder="Referencia bancaria" value="${esc(d.transferCode||'')}"></div>
        </div>${cashChangeFields('checkin',d)}
        <div class="checkin-verification ${choice?.method==='por_cobrar'||initialPayment<=0?'hidden':''}" id="checkin-payment-verification">
          <label class="checkin-confirm-label" for="checkin-payment-verified">
            <input id="checkin-payment-verified" type="checkbox" name="paymentVerified" value="si" ${d.paymentVerified==='si'?'checked':''}>
            <span>Confirmo que el pago se recibió y verificó antes de registrar el ingreso.</span>
          </label>
          <p>Efectivo: cuente el dinero. Transferencia: verifique el abono y anote la referencia.</p>
        </div>
        <div class="checkin-credit-authorization ${choice?.method==='por_cobrar'&&amountPending>0?'':'hidden'}" id="checkin-credit-authorization">
          <strong>Excepción: habitación por cobrar</strong>
          <p>El huésped ingresará con saldo pendiente. No se registrará dinero en caja.</p>
          <label class="checkin-confirm-label" for="checkin-credit-confirmed">
            <input id="checkin-credit-confirmed" type="checkbox" name="creditConfirmed" value="si" ${d.creditConfirmed==='si'?'checked':''}>
            <span>Primera confirmación: autorizo expresamente que esta habitación quede por cobrar.</span>
          </label>
          <p>Al guardar aparecerá la segunda confirmación con el saldo pendiente.</p>
        </div>
        <div class="mini-caption section-gap" id="checkin-payment-help">${choice?.method==='por_cobrar'?'No entra dinero en caja; queda saldo pendiente por habitación.':'Cobro total calculado automáticamente; anticipos descontados.'}</div>
        <div class="discount-rule-warning ${choice?.discounted&&(d.invoice==='si'||checkinAssignments(d).some(e=>e.breakfast!=='sin')||b)?'':'hidden'}" id="discount-rule-warning">El descuento solo se permite por transferencia, sin desayuno, sin solicitud de factura y sin reservas de precio previamente confirmado. Seleccione tarifa normal o revise los datos.</div>
        </section>
        <div class="form-section-label">04 · Facturación y observaciones</div><div class="form-grid cols-3">
          ${select('¿Solicita factura?','invoice',[['no','No'],['si','Sí, solicita factura']],d.invoice)}
        </div><div id="invoice-fields" class="form-grid cols-2 section-gap ${d.invoice==='si'?'':'hidden'}">
          ${field('Nombre / razón social','invoiceName',d.invoiceName,{placeholder:'Nombre de facturación'})}${field('Cédula / RUC','invoiceId',d.invoiceId,{placeholder:'Identificación tributaria'})}
          ${field('Dirección','invoiceAddress',d.invoiceAddress,{placeholder:'Dirección para factura'})}${field('Correo para factura','invoiceEmail',d.invoiceEmail,{type:'email',placeholder:'factura@ejemplo.com'})}
        </div><div class="form-grid section-gap">${field('Observaciones / solicitudes adicionales','notes',d.notes,{textarea:true,full:true,placeholder:'Horario de llegada, requerimientos, observaciones...'})}</div>
        <div class="form-actions"><button class="btn btn-secondary" type="reset" id="clear-checkin">Limpiar formulario</button><button class="btn btn-primary" type="submit" id="checkin-submit">${choice?.method==='por_cobrar'?'Solicitar ingreso por cobrar':'Registrar ingreso con pago'}</button></div>
      </form></div></section>
      <aside class="panel"><div class="panel-head"><div><h2>Resumen de hospedaje</h2><p>Tarifa según configuración del hotel</p></div></div><div class="panel-body">
        <div class="summary-card"><div class="mini-caption">TOTAL HOSPEDAJE + VARIOS</div><div class="summary-price" id="checkin-total">${stayTotal===null?'Por definir':money(stayTotal)}</div>${renderCheckinBreakdown(d)}<div class="summary-pair"><span>Tarifa por noche principal</span><strong id="preview-rate">${checkinRateLabel(d.type,d.breakfast,d.paymentMethod)}</strong></div><div class="summary-pair"><span>Noches por habitación</span><strong id="preview-nights">${nights}</strong></div><div class="summary-pair"><span>Anticipo registrado</span><strong id="preview-advance">${money(bookedAdvance)}</strong></div><div class="summary-pair"><span>Pago automático al ingreso</span><strong id="preview-payment">${money(initialPayment)}</strong></div><div class="summary-pair total"><span>Saldo pendiente</span><strong id="preview-due">${stayTotal===null?'Por definir':money(Math.max(0,stayTotal-bookedAdvance-initialPayment))}</strong></div></div>
        <div class="dashboard-notice"><strong>Tarifa aplicable:</strong> habitación completa. El descuento solo se selecciona al pagar por transferencia para hospedaje sin desayuno y sin solicitud de factura; no se aplica a personas adicionales, niños ni consumos. La facturación debe cumplir las obligaciones tributarias aplicables.</div>
        <div class="dashboard-notice"><strong>Facturación:</strong> esta versión registra la solicitud, pero no emite comprobantes electrónicos del SRI.</div>
      </div></aside></div>`;
  }

  // El buscador de reservas consulta únicamente db.guests, cargado tras autenticar en Supabase.
  const normalizeReservationGuestText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function reservationGuestMatches(query){
    const q=normalizeReservationGuestText(query);
    if(q.length<2)return [];
    return db.guests.filter(g=>[guestName(g),g.document,g.phone].some(v=>normalizeReservationGuestText(v).includes(q)))
      .sort((a,b)=>{
        const rank=g=>normalizeReservationGuestText(g.document).startsWith(q)?0:normalizeReservationGuestText(guestName(g)).startsWith(q)?1:2;
        return rank(a)-rank(b)||guestName(a).localeCompare(guestName(b),'es');
      }).slice(0,15);
  }
  function reservationGuestField(d){
    return `<div class="field reservation-guest-field">
      <label for="reservation-document">Cédula o RUC personal (opcional)</label>
      <div class="reservation-guest-input">
        <input id="reservation-document" name="document" inputmode="numeric" autocomplete="off" maxlength="13" placeholder="10 dígitos o 13 terminados en 001" value="${esc(d.document||'')}">
        <button type="button" class="btn btn-secondary" id="reservation-search-button" data-action="open-reservation-guest-search" aria-haspopup="dialog" aria-controls="reservation-guest-dialog" title="Buscar un huésped registrado">Buscar</button>
      </div>
      <small class="reservation-guest-hint">Puede escribir la cédula o buscar un huésped existente.</small>
    </div>`;
  }
  function renderReservationGuestResults(query){
    if(normalizeReservationGuestText(query).length<2)return '<p class="mini-caption">Escriba al menos dos caracteres del nombre, la cédula o el teléfono.</p>';
    const matches=reservationGuestMatches(query);
    if(!matches.length)return '<p class="mini-caption">No se encontraron huéspedes. Cierre la búsqueda y complete los datos manualmente.</p>';
    return matches.map(g=>`<button type="button" class="reservation-guest-result" data-action="select-reservation-guest" data-id="${esc(g.id)}">
      <strong>${esc(guestName(g)||'Sin nombre')}</strong>
      <span>${esc(g.document||'Sin documento')} · ${esc(g.phone||'Sin teléfono')}</span>
    </button>`).join('');
  }
  function renderReservationGuestDialog(){
    if(!ui.reservationGuestSearchOpen)return '';
    const query=ui.reservationGuestSearchQuery||'';
    return `<div class="reservation-guest-overlay" data-reservation-guest-overlay>
      <section class="reservation-guest-dialog" id="reservation-guest-dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-guest-title">
        <header class="reservation-guest-header">
          <div><h2 id="reservation-guest-title">Buscar huésped registrado</h2><p>Seleccione una ficha para completar la reserva automáticamente.</p></div>
          <button type="button" class="reservation-guest-close" data-action="close-reservation-guest-search" aria-label="Cerrar búsqueda">×</button>
        </header>
        <div class="reservation-guest-body">
          <label for="reservation-guest-search-input">Nombre, cédula/RUC o teléfono</label>
          <input id="reservation-guest-search-input" type="search" autocomplete="off" placeholder="Escriba para buscar..." value="${esc(query)}" aria-controls="reservation-guest-results">
          <div id="reservation-guest-results" class="reservation-guest-results" role="group" aria-label="Resultados de búsqueda">${renderReservationGuestResults(query)}</div>
          <p class="reservation-guest-help">La búsqueda consulta huéspedes registrados. Si no aparece, ingrese los datos manualmente en Crear reserva.</p>
        </div>
      </section>
    </div>`;
  }
  function openReservationGuestSearch(){
    const form=document.getElementById('reservation-form');
    if(form)ui.reservationDraft={...ui.reservationDraft,...readForm('reservation-form')};
    ui.reservationGuestSearchQuery=String(ui.reservationDraft?.document||ui.reservationDraft?.name||'').trim();
    ui.reservationGuestSearchOpen=true;
    render();
    document.getElementById('reservation-guest-search-input')?.focus();
  }
  function closeReservationGuestSearch(){
    ui.reservationGuestSearchOpen=false;ui.reservationGuestSearchQuery='';
    render();
    document.getElementById('reservation-search-button')?.focus();
  }
  function selectReservationGuest(id){
    const g=guestOf(id);if(!g)return;
    const form=document.getElementById('reservation-form');
    if(form)ui.reservationDraft={...ui.reservationDraft,...readForm('reservation-form')};
    ui.reservationDraft={...initialReservationDraft(),...ui.reservationDraft,
      name:guestName(g),phone:String(g.phone||''),document:String(g.document||'')};
    ui.reservationGuestSearchOpen=false;ui.reservationGuestSearchQuery='';
    render();
    document.getElementById('reservation-document')?.focus();
  }

  function renderReservations(){
    const d=ui.reservationDraft||(ui.reservationDraft=initialReservationDraft());
    const nights=getNightCount(d.arrival,d.departure),total=rate(d.type,d.breakfast)*nights;
    const arr=db.reservations.slice().sort((a,b)=>a.arrival.localeCompare(b.arrival));
    return head('Recepción / planificación','Reservas y próximas llegadas','Agende estancias, registre anticipos y convierta reservas en ingresos.',btn('Exportar nómina CSV','export-roster','btn-secondary'))+
      `<details class="reservation-create-details" id="reservation-create-details" ${ui.reservationCreateOpen?'open':''}>
        <summary class="reservation-create-summary">
          <span class="reservation-create-intro"><strong>Crear reserva</strong><small>Se solicita un anticipo del 50% para confirmar.</small></span>
          <span class="reservation-create-toggle-label">
            <span class="reservation-create-collapsed-text">Mostrar formulario</span>
            <span class="reservation-create-expanded-text">Ocultar formulario</span>
            <span class="reservation-create-arrow" aria-hidden="true">⌄</span>
          </span>
        </summary>
        <div class="two-col reservation-create-content"><section class="panel"><div class="panel-body"><form id="reservation-form"><div class="form-grid cols-2">
        ${field('Nombre completo','name',d.name,{required:true,placeholder:'Nombre del titular de la reserva'})}${field('Teléfono / WhatsApp','phone',d.phone,{required:true,placeholder:'09XXXXXXXX'})}
        ${reservationGuestField(d)}${field('Fecha de llegada','arrival',d.arrival,{type:'date',required:true})}
        ${field('Fecha de salida','departure',d.departure,{type:'date',required:true})}
        ${select('Tipo de habitación','type',TYPES.map(x=>[x,LABELS[x]]),d.type)}
        ${select('Desayuno','breakfast',[['sin','Sin desayuno'],['con','Con desayuno']],d.breakfast)}
        ${select('Asignar habitación (opcional)','roomId',reservationRoomOptions(d),d.roomId)}
        ${field('Anticipo recibido (USD)','advance',d.advance,{type:'number',min:0,step:'0.01',placeholder:'0.00'})}${select('Método del anticipo','advanceMethod',[['efectivo','Efectivo'],['transferencia','Transferencia']],d.advanceMethod||'efectivo')}${field('Referencia bancaria (si transferencia)','advanceRef',d.advanceRef,{placeholder:'Número de transacción'})}${select('Turno','shift',[['dia','Día'],['noche','Noche']],d.shift||'dia')}
        ${field('Observaciones','notes',d.notes,{textarea:true,full:true,placeholder:'Hora de llegada, solicitud especial...'})}
        </div>${cashChangeFields('reservation')}<div class="summary-card section-gap"><div class="summary-pair"><span>Tarifa por noche</span><strong id="reservation-rate">${rateLabel(d.type,d.breakfast)}</strong></div><div class="summary-pair"><span>Duración</span><strong id="reservation-nights">${nights} noches</strong></div><div class="summary-pair total"><span>Total estimado</span><strong id="reservation-total">${rate(d.type,d.breakfast)===null?'Por definir':money(total)}</strong></div><div class="summary-pair"><span>Anticipo sugerido (50%)</span><strong id="reservation-deposit">${rate(d.type,d.breakfast)===null?'Por definir':money(total*.5)}</strong></div></div>
        <div class="mini-caption section-gap">Si no asigna habitación, la reserva no bloquea inventario específico. Sujeto a disponibilidad.</div><div class="form-actions"><button type="reset" class="btn btn-secondary">Limpiar</button><button type="submit" class="btn btn-primary">Guardar reserva</button></div></form></div></section>
        <aside class="panel"><div class="panel-head"><div><h2>Condiciones de reserva</h2><p>Información vigente del hotel</p></div></div><div class="panel-body"><div class="summary-pair"><span>Check-in</span><strong>Desde 12:00</strong></div><div class="summary-pair"><span>Check-out</span><strong>Hasta 14:00</strong></div><div class="summary-pair"><span>Anticipo</span><strong>50%</strong></div><div class="summary-pair"><span>Aviso para devolución</span><strong>24 h antes</strong></div><div class="separator"></div><p class="mini-caption">El anticipo no es reembolsable si el cliente no se presenta sin el aviso previsto. Las reservas sin pago suficiente quedan pendientes.</p><div class="dashboard-notice">Los saldos y anticipos se registran en el navegador de este dispositivo, no en una cuenta bancaria.</div></div></aside>
      </div></details><section class="panel section-gap reservation-roster"><div class="panel-head"><div><h2>Nómina de reservas</h2><p>${arr.length} reservas registradas en este navegador</p></div></div>${arr.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Huésped</th><th>Llegada / salida</th><th>Habitación</th><th>Total / anticipo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${arr.map(b=>`<tr><td><strong>${esc(b.name)}</strong><br><span class="mini-caption">${esc(b.phone)}</span></td><td>${datePretty(b.arrival)}<br><span class="mini-caption">${datePretty(b.departure)}</span></td><td>${esc(LABELS[b.type])}<br><span class="mini-caption">${esc(roomOf(b.roomId)?.number||'Por asignar')}</span></td><td><strong>${money(b.total)}</strong><br><span class="mini-caption">Anticipo ${money(b.advance)}</span></td><td>${tag(({pendiente:'Pendiente',confirmada:'Confirmada',alojada:'Alojada',finalizada:'Finalizada',cancelada:'Cancelada'})[b.status]||b.status,b.status==='confirmada'?'success':b.status==='pendiente'?'warning':b.status==='cancelada'?'danger':'')}</td><td><div class="table-actions">${['pendiente','confirmada'].includes(b.status)?btn('Ingresar','checkin-booking','btn-light btn-sm',`data-id="${esc(b.id)}"`)+btn('Cancelar','cancel-booking','btn-danger btn-sm',`data-id="${esc(b.id)}"`):'—'}</div></td></tr>`).join('')}</tbody></table></div>`:noRows('No hay reservas. Utilice el formulario para crear la primera.')}</section>${renderReservationGuestDialog()}`;
  }
  function reservationRoomOptions(d){
    const selectedRooms=db.rooms.filter(r=>roomCompatible(r,d.type)&&availableForBooking(r,d.arrival,d.departure));
    return [['','Por asignar'],...selectedRooms.map(r=>[r.id,'Habitación '+r.number])];
  }
  function renderCheckout(){
    const stays=activeStays().slice().sort((a,b)=>a.departure.localeCompare(b.departure));
    const selected=stayOf(ui.selectedStayId)||stays[0];
    if(selected&&!stays.some(x=>x.id===selected.id))ui.selectedStayId=stays[0]?.id||null;
    const s=stayOf(ui.selectedStayId)||stays[0];
    const dues=s?dueOf(s):0;
    const closedStays=db.stays.filter(x=>x.status==='finalizada').slice().sort((a,b)=>String(b.actualCheckout||b.createdAt||'').localeCompare(String(a.actualCheckout||a.createdAt||'')));
    const closedPages=Math.max(1,Math.ceil(closedStays.length/30));
    ui.closedHistoryPage=Math.min(Math.max(0,Number(ui.closedHistoryPage)||0),closedPages-1);
    const history=closedStays.slice(ui.closedHistoryPage*30,(ui.closedHistoryPage+1)*30);
    const viewed=stayOf(ui.selectedHistoryStayId);
    return head('Recepción / cierre','Salidas y cobros','Revise la cuenta, registre abonos y libere habitaciones para limpieza.',btn('Ver habitaciones','go-habitaciones','btn-secondary'))+
    `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Habitaciones ocupadas</h2><p>${stays.length} estadías en curso</p></div></div><div class="panel-body checkout-list">${stays.length?stays.map(x=>`<div class="checkout-item"><div class="room-no">${esc(roomOf(x.roomId)?.number||'—')}</div><div class="flex-grow"><strong>${esc(guestName(guestOf(x.guestId)))}</strong><small>Salida: ${datePretty(x.departure)} · saldo ${money(dueOf(x))}</small></div><button type="button" class="btn ${s?.id===x.id?'btn-primary':'btn-secondary'} btn-sm" data-action="select-stay" data-id="${esc(x.id)}">Gestionar</button></div>`).join(''):noRows('No hay huéspedes alojados actualmente.')}</div></section>
    <aside class="panel"><div class="panel-head"><div><h2>Liquidación de estadía</h2><p>Detalle y registro de cobro</p></div></div><div class="panel-body">${s?`<div class="summary-card"><div class="mini-caption">HABITACIÓN ${esc(roomOf(s.roomId)?.number||'—')}</div><div class="summary-price">${money(totalOf(s))}</div><div class="summary-pair"><span>Hospedaje</span><strong>${money(s.roomTotal)}</strong></div><div class="summary-pair"><span>Varios</span><strong>${money(extrasOf(s.id))}</strong></div><div class="summary-pair"><span>Personas adicionales</span><strong>${money(additionalPeopleOf(s))}</strong></div><div class="summary-pair"><span>Abonado</span><strong>${money(paidOf(s))}</strong></div><div class="summary-pair total"><span>Saldo pendiente</span><strong class="${dues>0?'text-red':'text-green'}">${money(dues)}</strong></div><div class="summary-pair"><span>Vuelto pendiente a favor del huésped</span><strong>${money(pendingChangeOf(s))}</strong></div></div>
      ${renderPaymentForm(s)}
      ${renderFinalAccountSection(s)}
      <div class="separator"></div>${btn('Registrar check-out','checkout-stay','btn-primary',`data-id="${esc(s.id)}"`)}<div class="mini-caption section-gap">La salida pasa la habitación a <strong>pendiente de limpieza</strong>. Los saldos se pagan antes de cerrar; los vueltos sin entregar siguen registrados en caja.</div>`:noRows('Seleccione una estadía para gestionar su cuenta.')}</div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Historial de salidas</h2><p>${closedStays.length} estadías finalizadas · movimientos guardados en Supabase</p></div>
    <div class="account-history-pagination">${btn('Más recientes','history-newer','btn-secondary btn-sm',ui.closedHistoryPage<=0?'disabled':'')}
    <span>Página ${ui.closedHistoryPage+1} de ${closedPages}</span>
    ${btn('Más antiguas','history-older','btn-secondary btn-sm',ui.closedHistoryPage>=closedPages-1?'disabled':'')}</div></div>${history.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Huésped</th><th>Habitación</th><th>Salida</th><th>Total</th><th>Saldo</th><th>Historial</th></tr></thead><tbody>${history.map(x=>`<tr><td><strong>${esc(guestName(guestOf(x.guestId)))}</strong></td><td>${esc(roomOf(x.roomId)?.number||'—')}</td><td>${datePretty(x.actualCheckout?.slice(0,10)||x.departure)}</td><td>${money(totalOf(x))}</td><td>${tag(money(dueOf(x)),dueOf(x)?'warning':'success')}</td><td>${btn('Ver movimientos','show-stay-history','btn-secondary btn-sm',`data-id="${esc(x.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:noRows('Aún no hay salidas registradas.')}</section>${viewed&&viewed.status==='finalizada'?renderClosedHistoryDialog(viewed):''}`;
  }
  const paidDirect=x=>!x.stayId&&['efectivo','transferencia'].includes(x.method);
  const productOf=id=>db.products.find(p=>p.id===id);
  const shiftOptions=[['dia','Día'],['noche','Noche']];
  const destinations=()=>[['caja','Venta directa / caja'],...activeStays().map(s=>[s.id,'Cargar a Hab. '+(roomOf(s.roomId)?.number||'—')+' · '+guestName(guestOf(s.guestId))])];
  const catName=c=>CATEGORIES[c]||'Otros / servicios';
  function renderExtras(){
    const filtered=db.products.filter(p=>ui.productCategory==='todas'||p.category===ui.productCategory).slice().sort(sortProduct);
    const sold=db.extras.slice().reverse();
    const amount=sold.reduce((x,e)=>x+e.price*e.quantity,0);
    return head('Recepción / ventas','Varios y productos','Venta directa en caja o cargo a una habitación, con control opcional de existencias.',btn('Inventario de productos','go-inventario','btn-secondary'))+
    `<section class="panel"><div class="panel-head"><div><h2>Catálogo de precios</h2><p>Precios transcritos del cartel proporcionado; sin precio visible en helados y lavandería.</p></div><div class="filters"><select id="filter-product-category" aria-label="Filtrar categoría">${selectOptions([['todas','Todas las categorías'],...Object.entries(CATEGORIES)],ui.productCategory)}</select><span class="mini-caption">${filtered.length} productos. Seleccione uno para agregarlo a la venta.</span></div><div class="product-catalog-grid">${filtered.map(p=>`<button class="product-item" type="button" data-action="pick-product" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${esc(catName(p.category))}</small><span class="price">${p.price===null?'Precio sin definir':money(p.price)}</span><small>Stock: ${p.stock===null?'pendiente de conteo':p.stock}</small></button>`).join('')}</div></section>
    <div class="two-col section-gap"><section class="panel"><div class="panel-head"><div><h2>Registrar venta de un producto</h2><p>Venta de mostrador o consumo cargado al huésped</p></div></div><div class="panel-body"><form id="extra-form"><div class="form-grid cols-2">
      ${select('Destino del consumo','stayId',destinations(),ui.extraTarget||'caja')}
      ${select('Producto','productId',[['','Seleccione el producto'],...db.products.slice().sort(sortProduct).map(p=>[p.id,`${catName(p.category)} · ${p.name}`])],'','required')}
      ${field('Cantidad','quantity','1',{type:'number',min:1,max:1000,step:1,required:true})}
      <div class="field"><label>Importe</label><div class="readonly-info" id="extra-preview">Seleccione un producto</div></div>
      ${select('Pago de venta directa','method',[['efectivo','Efectivo'],['transferencia','Transferencia']],'efectivo')}
      ${select('Turno','shift',shiftOptions,'dia')}
      ${field('Código de transferencia (si aplica)','reference','',{placeholder:'Referencia bancaria'})}
      ${field('Encargado de turno','operator','',{placeholder:'Nombre del trabajador'})}
      </div>${cashChangeFields('extra')}<div class="dashboard-notice">Si elige una habitación ocupada, el importe se agrega a la cuenta del huésped y <strong>no entra en caja hasta que se cobre</strong>. Si elige venta directa, se contabiliza inmediatamente por su forma de pago.</div><div class="form-actions"><button class="btn btn-primary" type="submit">Registrar consumo / venta</button></div></form></div></section>
      <aside class="panel"><div class="panel-head"><div><h2>Cargos adicionales</h2><p>Lavandería, helados sin precio definido y otros servicios</p></div></div><div class="panel-body"><form id="manual-extra-form"><div class="form-grid">
      ${field('Concepto','name','',{required:true,placeholder:'Ej. Lavandería, helado de coco, minibar...'})}
      ${select('Categoría','category',[['otros','Otros / lavandería'],['helados','Helados'],['bebidas','Bebidas'],['confiteria','Confitería'],['aseo','Aseo personal']],'otros')}
      ${select('Destino','stayId',destinations(),ui.extraTarget||'caja')}
      ${field('Importe total (USD)','amount','',{required:true,type:'number',min:0.01,step:'0.01',placeholder:'0.00'})}
      ${select('Forma de pago si es directa','method',[['efectivo','Efectivo'],['transferencia','Transferencia']],'efectivo')}
      ${select('Turno','shift',shiftOptions,'dia')}
      ${field('Referencia de transferencia (si aplica)','reference','',{placeholder:'Referencia bancaria'})}
      ${field('Encargado','operator','',{placeholder:'Nombre del trabajador'})}
      </div>${cashChangeFields('manual')}<button class="btn btn-secondary section-gap" type="submit">Registrar cobro adicional</button></form></div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Registro de ventas</h2><p>${sold.length} operaciones · ${money(amount)} facturado, con cargos a habitaciones y ventas cobradas</p></div></div>${sold.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Destino</th><th>Categoría / producto</th><th>Cantidad</th><th>Importe</th><th>Cobro</th></tr></thead><tbody>${sold.slice(0,150).map(x=>`<tr><td>${timePretty(x.createdAt)}</td><td>${x.stayId?'Hab. '+esc(roomOf(stayOf(x.stayId)?.roomId)?.number||'—'):'Caja'}</td><td>${esc(catName(x.category))}<br><strong>${esc(x.productName)}</strong></td><td>${x.quantity}</td><td><strong>${money(x.price*x.quantity)}</strong></td><td>${x.stayId?'Pendiente en cuenta':x.method==='transferencia'?'Transferencia':'Efectivo'}</td></tr>`).join('')}</tbody></table></div>`:noRows('Aún no se registran ventas ni consumos.')}</section>`;
  }
  function renderStock(){
    const list=db.products.filter(p=>ui.stockCategory==='todas'||p.category===ui.stockCategory).slice().sort(sortProduct);
    const counted=db.products.filter(p=>p.stock!==null).length;
    const todayMoves=db.stockMoves.filter(m=>localDateOf(m.createdAt)===today());
    return head('Inventario / varios','Existencias de productos','Sustituye el conteo manual del cuaderno: ingreso, merma y conteo físico.',btn('Ir a ventas','go-varios','btn-secondary'))+
    `<div class="metrics"><div class="metric"><div class="metric-top"><span class="metric-title">Referencias del catálogo</span></div><div class="metric-value">${db.products.length}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Productos contados</span></div><div class="metric-value">${counted}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Pendientes de contar</span></div><div class="metric-value">${db.products.length-counted}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Movimientos hoy</span></div><div class="metric-value">${todayMoves.length}</div></div></div>
    <div class="two-col section-gap"><section class="panel"><div class="panel-head"><div><h2>Registrar movimiento de inventario</h2><p>El primer movimiento de cada producto debe ser un conteo físico.</p></div></div><div class="panel-body"><form id="stock-form"><div class="form-grid">
    ${select('Producto','productId',[['','Seleccione producto'],...db.products.slice().sort(sortProduct).map(p=>[p.id,`${catName(p.category)} · ${p.name}`])],'','required')}
    ${select('Tipo de movimiento','mode',[['conteo','Conteo físico (fijar cantidad)'],['entrada','Ingreso / reposición (+)'],['merma','Merma / pérdida (-)']],'conteo')}
    ${field('Cantidad en unidades','quantity','',{required:true,type:'number',min:0,step:1,placeholder:'0'})}
    ${select('Turno','shift',shiftOptions,'dia')}
    ${field('Encargado','operator','',{placeholder:'Trabajador que realizó el conteo'})}
    ${field('Observación','note','',{placeholder:'Entrega de proveedor, conteo, ajuste...'})}
    </div><button class="btn btn-primary section-gap" type="submit">Guardar movimiento</button></form><div class="dashboard-notice">Las cantidades manuscritas de las fotos no se cargan como stock actual: primero registre el inventario físico vigente. Cada venta descontará unidades una vez que el producto esté contado.</div></div></section>
    <aside class="panel"><div class="panel-head"><div><h2>Últimos movimientos</h2><p>Ventas y cambios de existencias registrados</p></div></div><div class="panel-body"><div class="movement-list">${db.stockMoves.length?db.stockMoves.slice().reverse().slice(0,15).map(m=>`<div class="movement-row"><div><strong>${esc(m.productName)}</strong><div class="mini-caption">${esc(({conteo:'Conteo físico',entrada:'Ingreso',merma:'Merma',venta:'Venta'})[m.mode]||m.mode)} · ${timePretty(m.createdAt)}${m.operator?' · '+esc(m.operator):''}</div></div><strong>${m.mode==='conteo'?'=':m.mode==='entrada'?'+':'−'}${m.quantity}</strong></div>`).join(''):noRows('No hay movimientos de inventario.')}</div></div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Stock por producto</h2><p>Estado del inventario por categorías</p></div></div><div class="filters"><select id="filter-stock-category">${selectOptions([['todas','Todas las categorías'],...Object.entries(CATEGORIES)],ui.stockCategory)}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Categoría</th><th>Producto</th><th>Precio</th><th>Existencia</th></tr></thead><tbody>${list.map(p=>`<tr><td>${esc(catName(p.category))}</td><td><strong>${esc(p.name)}</strong></td><td>${p.price===null?'Sin tarifa':money(p.price)}</td><td>${p.stock===null?tag('Sin conteo','warning'):tag(String(p.stock)+' uds.',p.stock===0?'danger':p.stock<=5?'warning':'success')}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function cashItems(date,shift){
    const items=[];
    const same=(stamp,turn)=>localDateOf(stamp)===date&&(turn||'dia')===shift;
    for(const b of db.reservations)if(b.advance>0&&same(b.createdAt,b.shift))items.push({group:'Hotel (anticipos)',method:b.advanceMethod||'efectivo',amount:b.advanceMethod==='efectivo'?Number(b.cashTendered??b.advance):b.advance,credited:b.advance,concept:'Anticipo de reserva'});
    for(const stay of db.stays)for(const pay of stay.payments||[])if(same(pay.createdAt,pay.shift))items.push({group:'Hotel (cobros de estadía)',method:pay.method,amount:pay.method==='efectivo'?Number(pay.cashTendered??pay.amount):pay.amount,credited:pay.amount,concept:'Hab. '+(roomOf(stay.roomId)?.number||'—')});
    for(const e of db.extras)if(paidDirect(e)&&same(e.createdAt,e.shift))items.push({group:e.category==='helados'?'Helados':e.category==='otros'?'Adicionales / servicios':'Varios',method:e.method,amount:e.method==='efectivo'?Number(e.cashTendered??e.price*e.quantity):e.price*e.quantity,credited:asMoney(e.price*e.quantity),concept:e.productName});
    return items;
  }
  function cashTotals(date,shift){
    const items=cashItems(date,shift),otherOut=db.cashMovements.filter(m=>m.date===date&&m.shift===shift).reduce((sum,m)=>sum+Number(m.amount),0);
    const changeGiven=asMoney(changeMovements().filter(x=>x.owner.changeStatus==='dado'&&x.owner.changeDeliveredAt&&localDateOf(x.owner.changeDeliveredAt)===date&&(x.owner.changeDeliveredShift||x.owner.shift||'dia')===shift).reduce((sum,x)=>sum+Number(x.owner.cashChange||0),0));
    const changePendingTotal=asMoney(changeMovements().reduce((sum,x)=>sum+changePending(x.owner),0));
    const total=method=>asMoney(items.filter(e=>e.method===method).reduce((sum,e)=>sum+Number(e.amount),0));
    const groups=['Hotel (anticipos)','Hotel (cobros de estadía)','Varios','Helados','Adicionales / servicios'].map(label=>({label,efectivo:asMoney(items.filter(e=>e.group===label&&e.method==='efectivo').reduce((s,e)=>s+e.amount,0)),transferencia:asMoney(items.filter(e=>e.group===label&&e.method==='transferencia').reduce((s,e)=>s+e.amount,0))}));
    return {items,groups,cash:total('efectivo'),transfer:total('transferencia'),out:asMoney(otherOut+changeGiven),otherOut:asMoney(otherOut),changeGiven,changePendingTotal};
  }
  function renderCash(){
    const date=ui.cashDate||today(),shift=ui.cashShift||'dia',sum=cashTotals(date,shift),prev=db.closures.find(c=>c.date===date&&c.shift===shift);
    const charged=db.extras.filter(e=>Boolean(e.stayId)&&localDateOf(e.createdAt)===date&&(e.shift||'dia')===shift);
    const peopleCharged=db.stays.flatMap(stay=>(stay.additionalPeople||[]).filter(p=>localDateOf(p.createdAt)===date&&(p.shift||'dia')===shift));
    const pending=asMoney(charged.reduce((v,e)=>v+e.price*e.quantity,0)+peopleCharged.reduce((v,p)=>v+Number(p.amount||0),0));
    const draft=ui.cashDraft||{};
    const float=Number(draft.float??prev?.float??0),expected=asMoney(float+sum.cash-sum.out);
    return head('Recepción / control financiero','Cierre de caja por turno','Consolidado de cobros de hospedaje, productos, helados, lavandería y gastos.',btn('Exportar reporte CSV','export-cash','btn-secondary'))+
    `<div class="panel"><div class="panel-head"><div><h2>Seleccionar jornada</h2><p>Se muestran únicamente los cobros del turno indicado</p></div></div><div class="panel-body"><div class="form-grid cols-3">${field('Fecha de cierre','cash-date',date,{type:'date',id:'cash-date'})}${select('Turno','cash-shift',shiftOptions,shift)}<div class="field"><label>Moneda</label><div class="readonly-info">USD · Dólares</div></div></div></div></div>
    <div class="metrics section-gap"><div class="metric"><div class="metric-top"><span class="metric-title">Entradas en efectivo</span></div><div class="metric-value small-metric">${money(sum.cash)}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Transferencias</span></div><div class="metric-value small-metric">${money(sum.transfer)}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Salidas en efectivo (incluye vueltos)</span></div><div class="metric-value small-metric">${money(sum.out)}</div><div class="metric-sub">Vueltos entregados: ${money(sum.changeGiven)}</div></div><div class="metric"><div class="metric-top"><span class="metric-title">Cargos a habitaciones (varios + personas)</span></div><div class="metric-value small-metric">${money(pending)}</div><div class="metric-sub">Se suman como cargos; se cobran al registrar abonos</div></div></div>
    <div class="two-col section-gap"><section class="panel"><div class="panel-head"><div><h2>Desglose de ingresos</h2><p>Venta del día por concepto y forma de cobro</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Concepto</th><th>Efectivo</th><th>Transferencia</th></tr></thead><tbody>${sum.groups.map(g=>`<tr><td>${esc(g.label)}</td><td>${money(g.efectivo)}</td><td>${money(g.transferencia)}</td></tr>`).join('')}<tr><td><strong>EFECTIVO / TRANSFERENCIA RECIBIDOS</strong></td><td><strong>${money(sum.cash)}</strong></td><td><strong>${money(sum.transfer)}</strong></td></tr><tr><td>Vuelto entregado (salida de efectivo)</td><td>−${money(sum.changeGiven)}</td><td>—</td></tr><tr><td>Otros retiros / gastos</td><td>−${money(sum.otherOut)}</td><td>—</td></tr></tbody></table></div><div class="panel-body"><h3>Últimos cobros del turno</h3>${sum.items.length?sum.items.slice().reverse().slice(0,12).map(x=>`<div class="movement-row"><div><strong>${esc(x.concept)}</strong><div class="mini-caption">${esc(x.group)} · ${esc(x.method)}</div></div><strong>${money(x.amount)}</strong></div>`).join(''):noRows('No hay cobros en este turno.')}</div></section>
    <aside class="panel"><div class="panel-head"><div><h2>Arqueo y cierre</h2><p>Compara efectivo esperado contra contado</p></div></div><div class="panel-body"><form id="cash-close-form"><div class="form-grid">
    ${field('Encargado','operator',draft.operator??prev?.operator??'',{required:true,placeholder:'Nombre de quien cierra caja'})}
    ${field('Fondo inicial / cambio (USD)','float',draft.float??prev?.float??0,{type:'number',required:true,min:0,step:'0.01'})}
    ${field('Efectivo contado al cierre (USD)','counted',draft.counted??prev?.counted??'',{type:'number',required:true,min:0,step:'0.01'})}
    ${field('Observaciones','notes',draft.notes??prev?.notes??'',{textarea:true,placeholder:'Diferencias, incidencias, justificaciones...'})}
    </div><div class="summary-card section-gap"><div class="summary-pair"><span>Fondo inicial</span><strong id="cash-float-preview">${money(float)}</strong></div><div class="summary-pair"><span>Entradas efectivo</span><strong>${money(sum.cash)}</strong></div><div class="summary-pair"><span>Vueltos entregados</span><strong>${money(sum.changeGiven)}</strong></div><div class="summary-pair"><span>Otros gastos / retiros</span><strong>${money(sum.otherOut)}</strong></div><div class="summary-pair"><span>Vuelto pendiente de todos los turnos</span><strong class="text-red">${money(sum.changePendingTotal)}</strong></div><div class="summary-pair total"><span>EFECTIVO ESPERADO</span><strong id="cash-expected-preview">${money(expected)}</strong></div><div class="summary-pair"><span>Diferencia (contado − esperado)</span><strong id="cash-variance-preview">${Number.isFinite(Number(draft.counted??prev?.counted))?money(asMoney(Number(draft.counted??prev?.counted)-expected)):'Sin arqueo'}</strong></div></div><button type="submit" class="btn btn-primary section-gap">${prev?'Actualizar cierre guardado':'Guardar cierre de caja'}</button></form><div class="dashboard-notice">El efectivo recibido se suma completo. El vuelto entregado se descuenta como salida; el vuelto pendiente sigue físicamente en caja, pero es una obligación del hotel con el huésped. Las transferencias no forman parte del efectivo.</div></div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Vueltos pendientes de entregar</h2><p>Dinero a devolver al huésped o comprador · no es ingreso definitivo</p></div><strong class="text-red">${money(sum.changePendingTotal)}</strong></div><div class="panel-body">
      ${changeMovements().filter(x=>changePending(x.owner)>0).length?changeMovements().filter(x=>changePending(x.owner)>0).map(x=>`<div class="account-line"><div><strong>${esc(x.label)}</strong><small>Vuelto pendiente: ${money(changePending(x.owner))}</small></div>${btn('Vuelto entregado','settle-change','btn-secondary btn-sm',`data-source="${esc(x.source)}" data-id="${esc(x.id)}"`)}</div>`).join(''):noRows('No hay vueltos pendientes.')}
    </div></section>
    <div class="two-col section-gap"><section class="panel"><div class="panel-head"><div><h2>Registrar retiro o gasto de caja</h2><p>Por ejemplo, un gasto menor del turno</p></div></div><div class="panel-body"><form id="cash-out-form"><div class="form-grid">${select('Tipo','kind',[['gasto','Gasto'],['retiro','Retiro de efectivo']],'gasto')}${field('Monto (USD)','amount','',{required:true,type:'number',min:0.01,step:'0.01'})}${field('Motivo','note','',{required:true,placeholder:'Detalle del movimiento'})}${field('Encargado','operator','',{placeholder:'Trabajador'})}</div><button class="btn btn-secondary section-gap" type="submit">Registrar salida de efectivo</button></form></div></section>
    <section class="panel"><div class="panel-head"><div><h2>Historial de cierres</h2><p>Arqueos registrados en este navegador</p></div></div><div class="panel-body">${db.closures.length?db.closures.slice().reverse().slice(0,12).map(c=>`<div class="movement-row"><div><strong>${datePretty(c.date)} · ${c.shift==='noche'?'Noche':'Día'}</strong><div class="mini-caption">${esc(c.operator)} · esperado ${money(c.expected)}</div></div><strong class="${c.variance?'text-red':'text-green'}">${money(c.variance)}</strong></div>`).join(''):noRows('Todavía no se registran cierres de caja.')}</div></section></div>`;
  }
  function renderGuests(){
    const q=ui.lookup.huespedes;
    const g=ui.lookupResult.huespedes?getGuestByDocument(q):null;
    const sorted=db.guests.slice().reverse();
    return head('Directorio / clientes','Registro de huéspedes','Consulte si una persona ya existe o cree su ficha para futuras visitas.',btn('Registrar ingreso','go-ingreso'))+
      `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Buscar o registrar persona</h2><p>La búsqueda se realiza en los registros guardados en este navegador.</p></div></div><div class="panel-body">${lookupBlock('huespedes',q,ui.lookupMessage.huespedes,ui.lookupResult.huespedes)}<form id="guest-form">${guestFields(g||{})}<div class="form-actions"><button type="reset" class="btn btn-secondary">Limpiar</button><button type="submit" class="btn btn-primary">${g?'Actualizar huésped':'Guardar nuevo huésped'}</button></div></form></div></section>
      <aside class="panel"><div class="panel-head"><div><h2>Directorio local</h2><p>Personas registradas en el dispositivo</p></div></div><div class="panel-body"><div class="summary-card"><div class="mini-caption">HUÉSPEDES REGISTRADOS</div><div class="summary-price">${db.guests.length}</div><div class="summary-pair"><span>Con correo registrado</span><strong>${db.guests.filter(g=>g.email).length}</strong></div><div class="summary-pair"><span>Con teléfono registrado</span><strong>${db.guests.filter(g=>g.phone).length}</strong></div></div><div class="dashboard-notice"><strong>Identificación:</strong> este prototipo no consulta Registro Civil ni SRI. No existe acceso a datos personales externos.</div></div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Listado de huéspedes</h2><p>Directorio de pruebas, no compartido con otros dispositivos</p></div></div>${sorted.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Nombre completo</th><th>Documento</th><th>Teléfono</th><th>Correo</th><th>Habitaciones activas</th><th>Acción</th></tr></thead><tbody>${sorted.map(g=>`<tr><td><strong>${esc(guestName(g))}</strong></td><td>${esc('******'+g.document.slice(-4))}</td><td>${esc(g.phone||'—')}</td><td>${esc(g.email||'—')}</td><td><div class="guest-room-links">${activeStays().filter(st=>st.guestId===g.id).map(st=>btn('Hab. '+esc(roomOf(st.roomId)?.number||'—'),'select-room','btn-secondary btn-sm',`type="button" data-id="${esc(st.roomId)}"`)).join('')||'—'}</div></td><td>${btn('Registrar ingreso','checkin-guest','btn-light btn-sm',`data-id="${esc(g.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:noRows('No hay huéspedes guardados. Cree un registro usando datos ficticios.')}</section>`;
  }
  function renderSettings(){
    return head('Administración / catálogo','Tarifas y ajustes','Tarifario fotografiado, productos con precios e inventario real editable.',btn('Restablecer demo','reset-demo','btn-danger'))+
    `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Tarifario del Hotel Unicornio</h2><p>USD por habitación y noche · valores incluyen IVA según tarifario proporcionado</p></div></div><div class="panel-body"><form id="rates-form"><div class="settings-table"><span class="settings-head">Tipo</span><span class="settings-head">Sin desayuno</span><span class="settings-head">Con desayuno</span></div>${TYPES.map(t=>`<div class="settings-table"><span class="text-strong">${esc(LABELS[t])}</span><div class="field"><input aria-label="${LABELS[t]} sin desayuno" name="${t}-sin" type="number" step="0.01" min="0" required value="${esc(db.config.rates[t]?.sin??'')}"></div><div class="field"><input aria-label="${LABELS[t]} con desayuno" name="${t}-con" type="number" step="0.01" min="0" ${t.endsWith('_ventilador')?'':'required'} placeholder="Por definir" value="${esc(db.config.rates[t]?.con??'')}"></div></div>`).join('')}
    <div class="form-section-label">Tarifas adicionales, según cartel de recepción</div><div class="form-grid cols-3">${field('Niño mayor de 5 años','childRate',db.config.childRate,{type:'number',min:0,step:'0.01',hint:'USD 5 por adicional; falta confirmar política para 5 años o menos.'})}${field('Persona adicional mayor de 12 años','extraPersonRate',db.config.extraPersonRate,{type:'number',min:0,step:'0.01',hint:'USD 10. No se suma automáticamente al hospedaje.'})}${field('Entrada antes de check-in','earlyFee',db.config.earlyFee,{type:'number',min:0,step:'0.01',hint:'Cargo de USD 10, según cartel.'})}</div>
    <div class="dashboard-notice">El tarifario fotografiado no especifica el precio <strong>con desayuno para habitaciones con ventilador</strong>. Se mantiene pendiente, sin inventar un valor.</div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar tarifas</button></div></form></div></section>
    <aside class="panel"><div class="panel-head"><div><h2>Catálogo de productos</h2><p>${db.products.length} artículos y servicios · precios editables</p></div></div><div class="panel-body"><form id="products-form"><div class="product-settings-list">${db.products.slice().sort(sortProduct).map(p=>`<div class="settings-table" style="grid-template-columns:1fr minmax(85px,110px)"><span class="text-strong">${esc(p.name)}<small class="mini-caption" style="display:block">${esc(CATEGORIES[p.category]||p.category||'Otros')}</small></span><div class="field"><input type="number" aria-label="Precio ${esc(p.name)}" name="product-${esc(p.id)}" min="0" step="0.01" placeholder="Por definir" value="${esc(p.price??'')}"></div></div>`).join('')}</div><div class="form-actions"><button type="submit" class="btn btn-primary">Guardar precios</button></div></form><div class="divider"></div><form id="new-product-form"><div class="form-grid">${field('Nuevo producto / servicio','name','',{required:true,placeholder:'Ej. Servicio de planchado'})}${select('Categoría','category',Object.entries(CATEGORIES),'otros')}${field('Precio unitario','price','',{type:'number',min:0,step:'0.01',placeholder:'Por definir'})}</div><button class="btn btn-secondary section-gap" type="submit">Agregar al catálogo</button></form></div></aside></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Inventario de habitaciones</h2><p>Según hoja entregada: 19 flexibles A/C, 2 flexibles ventilador, 2 dobles, 2 triples y 8 arrendadas únicas.</p></div></div><div class="panel-body"><div class="pill-list">${db.rooms.map(r=>`<span class="small-tag">${esc(r.number)} · ${esc(LABELS[r.type])}</span>`).join('')}</div>
      <details class="inventory-details section-gap"><summary>Editar número, categoría y estado del inventario</summary><form id="room-inventory-form"><div class="inventory-row inventory-heading"><span>Número</span><span>Tipo</span><span>Estado</span><span>Acción</span></div>${db.rooms.map(r=>`<div class="inventory-row"><input aria-label="Número de ${esc(r.number)}" name="${esc(r.id)}__number" value="${esc(r.number)}" maxlength="8" required><select aria-label="Tipo de ${esc(r.number)}" name="${esc(r.id)}__type">${selectOptions(ROOM_TYPES.map(t=>[t,LABELS[t]]),r.type)}</select><span>${statusTag(r.status)}</span><button class="btn btn-sm btn-danger" type="button" data-action="delete-room" data-id="${esc(r.id)}">Eliminar</button></div>`).join('')}<div class="form-actions"><button class="btn btn-primary" type="submit">Guardar inventario</button></div></form></details>
      <div class="form-section-label">Agregar una habitación</div><form id="new-room-form"><div class="form-grid cols-3">${field('Número de habitación','number','',{required:true,placeholder:'Ej. 31'})}${select('Categoría física','type',ROOM_TYPES.map(t=>[t,LABELS[t]]),'flex_aire')}<div class="field"><label>&nbsp;</label><button class="btn btn-secondary" type="submit">Agregar habitación</button></div></div></form>
      <div class="dashboard-notice"><strong>Revisar con recepción:</strong> el listado de arrendadas repite 101 dos veces, por eso aparece una sola habitación 101. La habitación triple se lee como 38. Las arrendadas están bloqueadas y fuera del inventario operativo.</div>
      <div class="dashboard-notice">Todo lo registrado aquí se guarda <strong>únicamente en este navegador</strong>. No utilice datos de clientes reales hasta implementar inicio de sesión y una base de datos protegida.</div></div></section>`;
  }
  function updatePricing(){
    const ci=document.getElementById('checkin-form');
    if(ci){
      syncCheckinVariosForm();
      const f=readForm('checkin-form'),estimate=checkinGroupEstimate(f),n=estimate.nights,
        r=checkinNightRate(f.type,f.breakfast,f.paymentMethod),total=estimate.grandTotal,
        adv=reservationOf(ui.prefillBookingId)?.advance||0,paid=checkinPaymentAmount(f,total,adv),
        choice=checkinPaymentChoice(f.paymentMethod);
      const mappings={
        'checkin-night-rate':r===null?'No aplica / revisar':money(r),
        'preview-rate':r===null?'No aplica / revisar':money(r),
        'preview-nights':n,
        'checkin-total':total===null?'Por definir':money(total),
        'preview-advance':money(adv),
        'preview-payment':money(paid),
        'checkin-auto-payment':money(paid),
        'preview-due':total===null?'Por definir':money(Math.max(0,total-adv-paid))
      };
      Object.entries(mappings).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
      document.getElementById('transfer-field')?.classList.toggle('hidden',choice?.method!=='transferencia');
      document.getElementById('checkin-payment-verification')?.classList.toggle('hidden',choice?.method==='por_cobrar'||paid<=0);
      document.getElementById('checkin-credit-authorization')?.classList.toggle('hidden',choice?.method!=='por_cobrar'||!(total!==null&&total>adv));
      const submit=document.getElementById('checkin-submit');
      if(submit)submit.textContent=choice?.method==='por_cobrar'?'Solicitar ingreso por cobrar':'Registrar ingreso con pago';
      const help=document.getElementById('checkin-payment-help');
      if(help)help.textContent=choice?.method==='por_cobrar'
        ?'No entra dinero en caja; queda saldo pendiente por habitación.'
        :'Cobro total calculado automáticamente; anticipos descontados.';
      const invalidDiscount=Boolean(choice?.discounted&&(f.invoice==='si'||Boolean(ui.prefillBookingId)||
        checkinAssignments(f).some(item=>item.breakfast!=='sin')));
      document.getElementById('discount-rule-warning')?.classList.toggle('hidden',!invalidDiscount);
      const variosQuote=quoteCheckinVarios(f);
      const variosTotal=document.getElementById('checkin-varios-total');
      if(variosTotal)variosTotal.textContent=variosQuote.error?'Revisar consumos':money(variosQuote.total);
      for(const row of ui.checkinVarios||[]){
        const el=document.getElementById(row.key+'-subtotal'),product=productOf(row.productId);
        if(el)el.textContent=product&&Number.isFinite(Number(row.quantity))?money(asMoney(product.price*Number(row.quantity))):'Revise la cantidad';
      }
      const breakdown=document.getElementById('checkin-room-breakdown');
      if(breakdown)breakdown.outerHTML=renderCheckinBreakdown(f);
      for(const entry of estimate.items.slice(1)){
        const rateEl=document.getElementById(entry.key+'-rate'),totalEl=document.getElementById(entry.key+'-total');
        if(rateEl)rateEl.textContent=entry.nightly===null?'No aplica / revisar':money(entry.nightly);
        if(totalEl)totalEl.textContent=entry.total===null?'Por definir':money(entry.total);
      }
      updateCashPreview('checkin-form','checkin',paid,choice?.method||'por_cobrar');
    }
    const rForm=document.getElementById('reservation-form');
    if(rForm){const f=readForm('reservation-form'),n=getNightCount(f.arrival,f.departure),r=rate(f.type,f.breakfast);for(const [id,val] of Object.entries({'reservation-rate':r===null?'Por definir':money(r),'reservation-nights':n+' noches','reservation-total':r===null?'Por definir':money(n*r),'reservation-deposit':r===null?'Por definir':money(n*r*.5)})){const el=document.getElementById(id);if(el)el.textContent=val;}updateCashPreview('reservation-form','reservation',asMoney(f.advance||0),f.advanceMethod);}
    const xForm=document.getElementById('extra-form');
    if(xForm){const f=readForm('extra-form'),p=productOf(f.productId);const el=document.getElementById('extra-preview');if(el)el.textContent=!p?'Seleccione un producto':p.price!==null&&Number(p.price)>0?money(Number(p.price)*(Number(f.quantity)||0)):'Precio sin configurar';updateCashPreview('extra-form','extra',asMoney(Number(p?.price||0)*Number(f.quantity||0)),f.method,f.stayId==='caja');}
    const manual=document.getElementById('manual-extra-form');if(manual){const f=readForm('manual-extra-form');updateCashPreview('manual-extra-form','manual',asMoney(Number(f.amount||0)),f.method,f.stayId==='caja');}
    const payment=document.getElementById('payment-form');if(payment){const f=readForm('payment-form');updateCashPreview('payment-form','payment',asMoney(Number(f.amount||0)),f.method);}
    const roomExtraForm=document.getElementById('room-extra-form');
    if(roomExtraForm){
      const f=readForm('room-extra-form'),product=productOf(f.productId);
      const sum=product&&Number.isFinite(Number(product.price))&&Number(product.price)>0?Number(product.price)*Number(f.quantity||0):0;
      const preview=document.getElementById('room-extra-preview');
      if(preview)preview.textContent=product&&Number(product.price)>0?'Cargo a la cuenta: '+money(asMoney(sum)):'Seleccione un producto con precio establecido.';
    }
    const breakfastForm=document.getElementById('room-breakfast-form');
    if(breakfastForm){
      const f=readForm('room-breakfast-form'),q=Number(f.quantity),preview=document.getElementById('room-breakfast-preview');
      if(preview)preview.textContent=Number.isSafeInteger(q)&&q>=1&&q<=100
        ?q+' desayuno(s) × '+money(BREAKFAST_EXTRA_PRICE)+' = '+money(q*BREAKFAST_EXTRA_PRICE)
        :'Ingrese una cantidad válida de 1 a 100.';
    }
    const extensionForm=document.getElementById('room-extension-form');
    if(extensionForm){
      const f=readForm('room-extension-form'),stay=stayOf(f.stayId),quote=stay?extensionQuote(stay,f.nights):{error:'No se encontró la estadía.'};
      const preview=document.getElementById('room-extension-preview'),error=document.getElementById('room-extension-error'),submit=document.getElementById('room-extension-submit');
      if(preview)preview.textContent=quote.error?'Revise la cantidad y las fechas para continuar.':'Salida actual: '+datePretty(stay.departure)+' · Nueva salida: '+datePretty(quote.newDeparture)+' · Cargo: '+money(quote.total)+' ('+quote.nights+' noches × '+money(stay.roomRate)+')';
      if(error){error.textContent=quote.error||'';error.classList.toggle('hidden',!quote.error);}
      if(submit)submit.disabled=Boolean(quote.error);
    }
    const personForm=document.getElementById('room-person-form');
    if(personForm){
      const f=readForm('room-person-form'),unit=Number(f.category==='nino'?db.config.childRate:db.config.extraPersonRate),nights=Number(f.nights||0);
      const preview=document.getElementById('room-person-preview');
      if(preview)preview.textContent=Number.isFinite(unit)&&unit>0&&Number.isSafeInteger(nights)&&nights>0
        ?'Cargo a la cuenta: '+money(asMoney(unit*nights))+' ('+nights+' noche(s) × '+money(unit)+')'
        :'Revise la tarifa y el número de noches.';
    }
    const finalize=document.getElementById('finalize-form');
    if(finalize){
      const f=readForm('finalize-form'),stay=stayOf(f.stayId),due=stay?dueOf(stay):0;
      updateCashPreview('finalize-form','final',due,f.method,due>0);
      document.getElementById('final-reference-field')?.classList.toggle('hidden',f.method!=='transferencia');
    }
    const cForm=document.getElementById('cash-close-form');if(cForm){const f=readForm('cash-close-form'),sum=cashTotals(ui.cashDate||today(),ui.cashShift||'dia'),flt=Number(f.float||0),expected=asMoney(flt+sum.cash-sum.out),counted=String(f.counted??'').trim();for(const [id,v] of Object.entries({'cash-float-preview':money(flt),'cash-expected-preview':money(expected),'cash-variance-preview':counted===''?'Sin arqueo':money(asMoney(Number(counted)-expected))})){const el=document.getElementById(id);if(el)el.textContent=v;}}
  }
  function refreshRoomSelect(formType){
  const form=document.getElementById(formType==='ingreso'?'checkin-form':'reservation-form');
  if(!form)return;
  if(formType!=='ingreso'){
    const fd=readForm('reservation-form'),el=form.elements.namedItem('roomId');
    if(!el)return;
    const options=reservationRoomOptions(fd),current=fd.roomId;
    el.innerHTML=selectOptions(options,options.some(x=>x[0]===current)?current:'');
    return;
  }
  const fd=readForm('checkin-form'),entries=checkinAssignments(fd),used=[];
  for(const e of entries){
    const name=e.primary?'roomId':e.key+'__roomId',el=form.elements.namedItem(name);
    if(!el)continue;
    const options=checkinRoomOptions({...fd,type:e.type,primary:e.primary},used);
    const valid=options.some(x=>x[0]===e.roomId)?e.roomId:'';
    el.innerHTML=selectOptions(options,valid);
    if(valid)used.push(valid);
  }
  ui.checkinDraft={...ui.checkinDraft,...readForm('checkin-form')};
}
  function guestData(f){return {firstName:String(f.firstName||'').trim(),secondName:String(f.secondName||'').trim(),lastName:String(f.lastName||'').trim(),secondLastName:String(f.secondLastName||'').trim(),document:String(f.document||'').trim(),phone:String(f.phone||'').trim(),email:String(f.email||'').trim()};}
  function saveGuest(g){
    const found=getGuestByDocument(g.document);
    if(found){Object.assign(found,{...g,document:found.document});return found;} // No cambia el formato histórico ni duplica cédula/RUC.
    const newGuest={...g,id:uid('guest'),createdAt:new Date().toISOString()};db.guests.push(newGuest);return newGuest;
  }
  function lookupGuest(scope){
    const doc=document.getElementById('lookup-'+scope)?.value.trim()||'';
    const verified=checkEcuadorDocument(doc);
    if(!verified.valid){
      ui.lookup[scope]=doc;ui.lookupMessage[scope]=verified.error;ui.lookupResult[scope]=false;
      toast(verified.error,'error');render();return;
    }
    const found=getGuestByDocument(doc);
    ui.lookup[scope]=doc;ui.lookupResult[scope]=Boolean(found);
    ui.lookupMessage[scope]=found?'Huésped encontrado: '+guestName(found)+'. Datos cargados.':'Usuario no registrado. Complete los datos para crear su ficha.';
    if(scope==='ingreso'){
      const ci=document.getElementById('checkin-form');if(ci)ui.checkinDraft={...ui.checkinDraft,...readForm('checkin-form'),...(found?guestData(found):{firstName:'',secondName:'',lastName:'',secondLastName:'',phone:'',email:''}),document:doc};
    }
    render();
  }
  function splitFullName(name){
    const arr=String(name||'').trim().split(/\s+/);
    if(arr.length===1)return {firstName:arr[0]||'',secondName:'',lastName:'',secondLastName:''};
    if(arr.length===2)return {firstName:arr[0],secondName:'',lastName:arr[1],secondLastName:''};
    if(arr.length===3)return {firstName:arr[0],secondName:'',lastName:arr[1],secondLastName:arr[2]};
    return {firstName:arr[0],secondName:arr[1],lastName:arr[2],secondLastName:arr.slice(3).join(' ')};
  }
  function startBookedCheckin(id){
    const b=reservationOf(id);if(!b||!['pendiente','confirmada'].includes(b.status)){toast('Esta reserva no permite registrar un nuevo ingreso.','error');return;}
    const guest=b.document&&getGuestByDocument(b.document);
    const parsed=guest?guestData(guest):splitFullName(b.name);
    ui.prefillBookingId=id;
    ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;
    ui.checkinDraft={...initialCheckinDraft(),...parsed,document:b.document||'',phone:b.phone||'',arrival:b.arrival,departure:b.departure,type:b.type,roomId:b.roomId||'',breakfast:b.breakfast,notes:b.notes||'',paymentAmount:'0'};
    ui.lookup.ingreso=b.document||'';ui.lookupMessage.ingreso=guest?'Huésped encontrado y vinculado a la reserva.':'Reserva precargada; confirme los datos del huésped.';ui.lookupResult.ingreso=Boolean(guest);
    navigate('ingreso');
  }
  function processCheckin(){
  syncCheckinVariosForm();
  const f=readForm('checkin-form'),g=guestData(f),b=reservationOf(ui.prefillBookingId);
  if(!g.firstName||!g.lastName||!g.phone){
    toast('Complete nombre, apellido y teléfono.','error');return;
  }
  const checked=checkEcuadorDocument(g.document);
  if(!checked.valid){toast(checked.error,'error');return;}
  const plan=prepareCheckinGroup(f,b);
  if(plan.error){toast(plan.error,'error');refreshRoomSelect('ingreso');return;}
  if(f.invoice==='si'&&(!f.invoiceName?.trim()||!f.invoiceId?.trim()||!f.invoiceAddress?.trim()||!f.invoiceEmail?.trim())){
    toast('Complete los cuatro datos de facturación.','error');return;
  }
  if(plan.method==='por_cobrar'){
    const unpaid=asMoney(plan.grandTotal-plan.deposit);
    if(unpaid>0){
      const rooms=plan.items.map(item=>'Hab. '+item.room.number).join(', ');
      const message='SEGUNDA CONFIRMACIÓN — INGRESO POR COBRAR\n\n'+
        'Huésped: '+g.firstName+' '+g.lastName+'\n'+
        'Habitación(es): '+rooms+'\n'+
        'Saldo pendiente: '+money(unpaid)+'\n\n'+
        '¿Confirma por segunda vez que autoriza el ingreso SIN recibir el pago? Esta excepción quedará registrada en el historial.';
      if(!window.confirm(message))return;
    }
  }
  if(plan.items.length>1){
    const msg=`¿Registrar ${plan.items.length} habitaciones al mismo cliente (${g.firstName} ${g.lastName})? Hospedaje: ${money(plan.total)} · Varios: ${money(plan.variosTotal)} · Total: ${money(plan.grandTotal)}. Cada habitación tendrá su saldo y su propia salida.`;
    if(!window.confirm(msg))return;
  }
  const guest=saveGuest(g),checkinAt=new Date().toISOString();
  const groupId=plan.items.length>1?uid('group'):null,paymentGroupId=plan.payment>0?uid('payment-group'):null;
  const stays=plan.items.map((item,i)=>{
    const s={
      id:uid('stay'),guestId:guest.id,roomId:item.room.id,type:item.type,
      arrival:f.arrival,departure:f.departure,breakfast:item.breakfast,
      roomRate:item.nightly,roomTotal:item.total,advance:item.advance,payments:[],
      standardRoomRate:item.normalNightly,discountTotal:item.saved,
      tariffMode:plan.discounted?'descuento_sin_factura':'normal',
      creditApproval:plan.method==='por_cobrar'&&item.fullTotal>item.advance?{
        confirmed:true,confirmedAt:checkinAt,shift:f.shift==='noche'?'noche':'dia',
        amount:asMoney(item.fullTotal-item.advance),mode:'doble_confirmacion'
      }:null,
      paymentVerifiedAt:item.payment>0?checkinAt:null,
      invoiceRequested:f.invoice==='si',
      invoiceDetails:f.invoice==='si'?{name:f.invoiceName.trim(),identification:f.invoiceId.trim(),
        address:f.invoiceAddress.trim(),email:f.invoiceEmail.trim()}:null,
      notes:String(f.notes||'').trim(),
      reservationId:i===0?b?.id||null:null,groupId,
      status:'activa',createdAt:checkinAt
    };
    if(item.payment>0)s.payments.push(paidCashRecord({
      id:uid('pay'),amount:item.payment,method:plan.method,
      reference:plan.method==='transferencia'?String(f.transferCode||'').trim():'',
      shift:f.shift||'dia',createdAt:checkinAt,
      ...(paymentGroupId?{paymentGroupId}:{}),
    },item.tender,checkinAt,f.shift||'dia'));
    return s;
  });
  db.stays.push(...stays);
  // Los consumos quedan ligados a la cuenta de la habitación, no como ventas directas.
  // La cantidad y el precio se validaron antes de cualquier escritura en estado/stock.
  const at=checkinAt,shift=f.shift==='noche'?'noche':'dia';
  for(const line of plan.varios){
    const index=plan.items.findIndex(item=>item.key===line.roomKey);
    if(index<0)throw new Error('Habitación destino de Varios no encontrada');
    const stay=stays[index],product=line.product;
    db.extras.push({
      id:uid('extra'),stayId:stay.id,productId:product.id,
      productName:product.name,category:product.category||'otros',
      quantity:line.quantity,price:line.price,method:'pendiente',reference:'',
      shift,operator:'Recepción / ingreso',createdAt:at,cashTendered:0,cashChange:0,
      changeStatus:'no_aplica',changeDeliveredAt:null,changeDeliveredShift:null
    });
    if(product.stock!==null){
      const before=product.stock;product.stock-=line.quantity;
      db.stockMoves.push({id:uid('stock'),productId:product.id,productName:product.name,
        mode:'venta',quantity:line.quantity,previous:before,after:product.stock,shift,
        operator:'Recepción / ingreso',createdAt:at,note:'Varios cargados durante ingreso a Hab. '+(roomOf(stay.roomId)?.number||'—')});
    }
  }
  for(const item of plan.items)item.room.status='ocupada';
  if(b)b.status='alojada';
  persist();
  ui.selectedRoomId=stays[0].roomId;ui.selectedStayId=stays[0].id;
  ui.checkinDraft=null;ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;
  ui.lookup.ingreso='';ui.lookupMessage.ingreso='';ui.lookupResult.ingreso=false;ui.prefillBookingId=null;
  navigate('habitaciones');
  toast('Ingreso registrado: '+stays.length+' habitación(es) y '+plan.varios.length+' consumo(s) a nombre de '+guestName(guest)+'. Saldo conjunto '+money(asMoney(stays.reduce((sum,s)=>sum+dueOf(s),0)))+'.');
}
  function processReservation(){
    const f=readForm('reservation-form');const name=String(f.name||'').trim(),phone=String(f.phone||'').trim(),n=getNightCount(f.arrival,f.departure),advance=Number(f.advance||0),document=String(f.document||'').trim();
    if(!name||!phone||n<1){toast('Ingrese titular, teléfono y fechas válidas.','error');return;}
    if(document&&!validDoc(document)){toast(checkEcuadorDocument(document).error,'error');return;}
    if(f.roomId&&(!roomOf(f.roomId)||!roomCompatible(roomOf(f.roomId),f.type)||!availableForBooking(roomOf(f.roomId),f.arrival,f.departure))){toast('La habitación escogida no está libre durante esas fechas.','error');refreshRoomSelect('reservas');return;}
    if(rate(f.type,f.breakfast)===null){toast('Configure la tarifa con desayuno antes de reservar ese tipo.','error');return;}
    const total=asMoney(n*rate(f.type,f.breakfast));
    if(advance>0&&f.advanceMethod==='transferencia'&&!String(f.advanceRef||'').trim()){toast('Ingrese referencia de la transferencia del anticipo.','error');return;}
    if(!Number.isFinite(advance)||advance<0||advance>total){toast('El anticipo no puede ser negativo ni superar el total.','error');return;}
    const tender=resolveTendered(f.cashTendered,f.advanceMethod,advance,f.changeStatus);if(tender.error){toast(tender.error,'error');return;}
    const bookingAt=new Date().toISOString();
    const b=paidCashRecord({id:uid('booking'),name,phone,document,arrival:f.arrival,departure:f.departure,type:f.type,roomId:f.roomId||'',breakfast:f.breakfast,total,advance:asMoney(advance),status:total>0&&advance>=asMoney(total*.5)?'confirmada':'pendiente',advanceMethod:f.advanceMethod||'efectivo',advanceRef:String(f.advanceRef||'').trim(),shift:f.shift||'dia',notes:String(f.notes||'').trim(),createdAt:bookingAt},tender,bookingAt,f.shift||'dia');
    db.reservations.push(b);persist();ui.reservationDraft=null;ui.reservationCreateOpen=false;ui.reservationGuestSearchOpen=false;ui.reservationGuestSearchQuery='';render();toast('Reserva guardada como '+b.status+'.');
  }
  function processGuest(){
    const g=guestData(readForm('guest-form'));
    if(!g.firstName||!g.lastName||!g.phone){toast('Complete nombre, apellido y teléfono.','error');return;}
    const checked=checkEcuadorDocument(g.document);
    if(!checked.valid){toast(checked.error,'error');return;}
    const found=Boolean(getGuestByDocument(g.document));saveGuest(g);persist();ui.lookup.huespedes=g.document;ui.lookupMessage.huespedes=found?'Datos del huésped actualizados.':'Nuevo huésped registrado.';ui.lookupResult.huespedes=true;render();toast(found?'Ficha del huésped actualizada. Sincronizando...':'Huésped añadido. Sincronizando con Supabase...');
  }
  function processPayment(){
    const f=readForm('payment-form'),s=stayOf(f.stayId),amount=Number(f.amount);
    if(!s||s.status!=='activa'){toast('Seleccione una estadía activa.','error');return;}
    if(!Number.isFinite(amount)||amount<=0||amount>dueOf(s)+.001){toast('El cobro debe ser mayor que cero y no superar el saldo.','error');return;}
    if(f.method==='transferencia'&&!String(f.reference||'').trim()){toast('Debe registrar el código de transferencia.','error');return;}
    const tender=resolveTendered(f.cashTendered,f.method,amount,f.changeStatus);if(tender.error){toast(tender.error,'error');return;}
    const paidAt=new Date().toISOString();
    s.payments.push(paidCashRecord({id:uid('pay'),amount:asMoney(amount),method:f.method,shift:f.shift||'dia',reference:f.method==='transferencia'?f.reference.trim():'',createdAt:paidAt},tender,paidAt,f.shift||'dia'));
    persist();render();toast('Abono de '+money(amount)+' registrado.');
  }
  function appendExtra(f,product){
    const q=Number(f.quantity),stayId=f.stayId==='caja'?'':f.stayId,stay=stayOf(stayId);
    if(stayId&&(!stay||stay.status!=='activa')){toast('Debe seleccionar una habitación ocupada.','error');return false;}
    if(!Number.isInteger(q)||q<1||q>1000){toast('Cantidad inválida.','error');return false;}
    if(product?.price===null||!Number.isFinite(Number(product?.price))||Number(product.price)<=0){toast('Este artículo no tiene tarifa definida; configúrela o utilice el formulario de cobro adicional.','error');return false;}
    if(!['efectivo','transferencia'].includes(f.method)){toast('Seleccione forma de pago válida.','error');return false;}
    if(!stayId&&f.method==='transferencia'&&!String(f.reference||'').trim()){toast('La transferencia necesita un código de referencia.','error');return false;}
    if(product.stock!==null&&product.stock<q){toast('No hay existencias suficientes de '+product.name+'.','error');return false;}
    const createdAt=new Date().toISOString();
    const tender=stayId?{received:asMoney(product.price*q),change:0,status:'no_aplica'}:resolveTendered(f.cashTendered,f.method,asMoney(product.price*q),f.changeStatus);
    if(tender.error){toast(tender.error,'error');return false;}
    const e=paidCashRecord({id:uid('extra'),stayId,productId:product.id,productName:product.name,category:product.category||'otros',quantity:q,price:asMoney(product.price),method:stayId?'pendiente':f.method,reference:stayId?'':String(f.reference||'').trim(),shift:f.shift||'dia',operator:String(f.operator||'').trim(),createdAt},tender,createdAt,f.shift||'dia');
    db.extras.push(e);
    if(product.stock!==null){product.stock-=q;db.stockMoves.push({id:uid('stock'),productId:product.id,productName:product.name,mode:'venta',quantity:q,shift:f.shift||'dia',operator:e.operator,createdAt,note:stayId?'Cargo a habitación':'Venta directa'});}
    persist();return true;
  }
  function processExtra(){
    const f=readForm('extra-form'),product=productOf(f.productId);
    if(!product){toast('Seleccione un producto.','error');return;}
    if(appendExtra(f,product)){render();toast('Venta registrada: '+product.name+'.');}
  }
  function processManualExtra(){
    const f=readForm('manual-extra-form'),name=String(f.name||'').trim(),amount=Number(f.amount),stayId=f.stayId==='caja'?'':f.stayId;
    if(!name||name.length>80||!Number.isFinite(amount)||amount<=0||amount>100000){toast('Complete un concepto y un importe válido.','error');return;}
    if(stayId&&stayOf(stayId)?.status!=='activa'){toast('Seleccione una habitación ocupada.','error');return;}
    if(!stayId&&f.method==='transferencia'&&!String(f.reference||'').trim()){toast('La transferencia necesita referencia.','error');return;}
    const tender=stayId?{received:asMoney(amount),change:0,status:'no_aplica'}:resolveTendered(f.cashTendered,f.method,amount,f.changeStatus);
    if(tender.error){toast(tender.error,'error');return;}
    const soldAt=new Date().toISOString();
    db.extras.push(paidCashRecord({id:uid('extra'),stayId,productId:'manual',productName:name,category:CATEGORIES[f.category]?f.category:'otros',quantity:1,price:asMoney(amount),method:stayId?'pendiente':f.method,reference:stayId?'':String(f.reference||'').trim(),shift:f.shift||'dia',operator:String(f.operator||'').trim(),createdAt:soldAt},tender,soldAt,f.shift||'dia'));
    persist();render();toast('Cargo adicional registrado.');
  }
  function processRoomExtra(){
  const f=readForm('room-extra-form'),stay=stayOf(f.stayId),product=productOf(f.productId);
  if(!stay||stay.status!=='activa'){toast('La habitación ya no está ocupada.','error');return;}
  if(!product){toast('Seleccione un producto para agregar a la habitación.','error');return;}
  const success=appendExtra({...f,method:'efectivo',stayId:stay.id},product);
  if(success){render();toast('Consumo cargado a Hab. '+(roomOf(stay.roomId)?.number||'—')+': '+product.name+'. No se ha cobrado aún.');}
}
  function processBreakfast(){
    const f=readForm('room-breakfast-form'),stay=stayOf(f.stayId),quantity=Number(f.quantity);
    if(!stay||stay.status!=='activa'){toast('La habitación ya no tiene una estadía activa.','error');return;}
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100){toast('Indique entre 1 y 100 desayunos.','error');return;}
    const amount=asMoney(quantity*BREAKFAST_EXTRA_PRICE);
    if(!window.confirm('¿Agregar '+quantity+' desayuno(s) a '+money(BREAKFAST_EXTRA_PRICE)+' cada uno? Se cargarán '+money(amount)+' a la habitación.'))return;
    db.extras.push({
      id:uid('extra'),stayId:stay.id,productId:'servicio-desayuno-adicional',
      productName:'Desayuno adicional',category:'otros',quantity,price:BREAKFAST_EXTRA_PRICE,
      method:'pendiente',reference:'',shift:f.shift==='noche'?'noche':'dia',
      operator:String(f.operator||'').trim(),createdAt:new Date().toISOString(),
      cashTendered:0,cashChange:0,changeStatus:'no_aplica',changeDeliveredAt:null,changeDeliveredShift:null
    });
    persist();render();
    toast(quantity+' desayuno(s) agregados a Hab. '+(roomOf(stay.roomId)?.number||'—')+' por '+money(amount)+'. Cargo pendiente de cobro.');
  }
  function processAdditionalPerson(){
  const f=readForm('room-person-form'),stay=stayOf(f.stayId);
  if(!stay||stay.status!=='activa'){toast('Seleccione una estadía activa.','error');return;}
  const name=String(f.name||'').trim().replace(/\s+/g,' '),category=f.category,nights=Number(f.nights);
  const maxNights=getNightCount(stay.arrival,stay.departure);
  if(!name||name.length>100){toast('Ingrese el nombre de la persona adicional (máximo 100 caracteres).','error');return;}
  if(!['adulto','nino'].includes(category)){toast('Seleccione una categoría de edad válida.','error');return;}
  if(!Number.isSafeInteger(nights)||nights<1||nights>maxNights||nights>365){toast('Indique noches a cobrar entre 1 y las noches actuales de estadía.','error');return;}
  const unitPrice=Number(category==='adulto'?db.config.extraPersonRate:db.config.childRate);
  const cents=moneyCents(unitPrice);
  if(!Number.isFinite(unitPrice)||!Number.isSafeInteger(cents)||cents<=0||unitPrice>10000){toast('Configure una tarifa adicional válida antes de continuar.','error');return;}
  const amount=asMoney(cents*nights/100);
  if(!window.confirm('¿Agregar a '+name+' como '+(category==='adulto'?'adulto':'niño de 6 a 12 años')+' por '+nights+' noche(s)? Se cargarán '+money(amount)+' a la habitación.'))return;
  const createdAt=new Date().toISOString();
  if(!Array.isArray(stay.additionalPeople))stay.additionalPeople=[];
  stay.additionalPeople.push({id:uid('person'),name,category,nights,unitPrice:asMoney(unitPrice),amount,
    operator:String(f.operator||'').trim(),shift:f.shift==='noche'?'noche':'dia',createdAt});
  persist();render();toast('Persona adicional registrada. Cargo a la habitación: '+money(amount)+'.');
}
  function processExtendStay(){
    const f=readForm('room-extension-form'),stay=stayOf(f.stayId);
    if(!stay||stay.status!=='activa'){toast('La estadía no está activa.','error');return;}
    const nights=f.nights===undefined?1:Number(f.nights);
    const quote=extensionQuote(stay,nights);
    if(quote.error){toast(quote.error,'error');return;}
    const oldDeparture=stay.departure,room=roomOf(stay.roomId);
    if(!window.confirm('¿Extender la habitación '+(room?.number||'—')+' por '+quote.nights+' noche(s), del '+datePretty(oldDeparture)+' al '+datePretty(quote.newDeparture)+'? Se añadirán '+money(quote.total)+' al saldo.'))return;
    const stamp=new Date().toISOString();
    if(!Array.isArray(stay.extensions))stay.extensions=[];
    stay.extensions.push({id:uid('extension'),oldDeparture,newDeparture:quote.newDeparture,
      addedNights:quote.nights,rate:asMoney(stay.roomRate),amount:quote.total,
      operator:String(f.operator||'').trim(),shift:f.shift==='noche'?'noche':'dia',createdAt:stamp});
    stay.departure=quote.newDeparture;
    stay.roomTotal=asMoney(moneyCents(stay.roomTotal)/100+quote.total);
    persist();render();
    toast('Nueva salida: '+datePretty(quote.newDeparture)+'. '+quote.nights+' noche(s) y '+money(quote.total)+' agregados.');
  }
  function finishStay(stay,stamp,operator){
  const room=roomOf(stay.roomId);
  if(room)room.status='limpieza';
  stay.status='finalizada';stay.actualCheckout=stamp;stay.closedBy=operator;
  stay.closureSummary={total:totalOf(stay),paid:paidOf(stay),balance:dueOf(stay),
    cashChangePending:pendingChangeOf(stay),closedAt:stamp,operator};
  if(stay.reservationId){
    const booking=reservationOf(stay.reservationId);if(booking)booking.status='finalizada';
  }
}
  function processFinalSettlement(){
  const f=readForm('finalize-form'),stay=stayOf(f.stayId);
  if(!stay||stay.status!=='activa'){toast('Esta habitación ya no tiene una estadía activa.','error');return;}
  const operator=String(f.operator||'').trim(),due=dueOf(stay),stamp=new Date().toISOString();
  if(!operator||operator.length>100){toast('Indique el encargado que cierra la cuenta.','error');return;}
  if(paidOf(stay)>totalOf(stay)+0.001){toast('La cuenta tiene un pago excedente. Requiere conciliación antes de cerrar.','error');return;}
  let tender=null;
  if(due>0){
    if(!['efectivo','transferencia'].includes(f.method)){toast('Seleccione un método de pago final.','error');return;}
    if(f.method==='transferencia'&&!String(f.reference||'').trim()){toast('Ingrese la referencia de transferencia antes de cerrar.','error');return;}
    tender=resolveTendered(f.cashTendered,f.method,due,f.changeStatus);
    if(tender.error){toast(tender.error,'error');return;}
  }
  const remainingChange=asMoney(pendingChangeOf(stay)+(tender?.status==='pendiente'?tender.change:0));
  if(remainingChange>0&&!window.confirm('Este cierre dejará '+money(remainingChange)+' de vuelto pendiente a favor del huésped. Continuará en caja como obligación. ¿Desea cerrar así?'))return;
  const room=roomOf(stay.roomId);
  if(!window.confirm('¿Cerrar la cuenta de Hab. '+(room?.number||'—')+' y registrar la salida?'+(due>0?' Se cobrará '+money(due)+'.':'')))return;
  if(due>0){
    const shift=f.shift==='noche'?'noche':'dia';
    stay.payments=Array.isArray(stay.payments)?stay.payments:[];
    stay.payments.push(paidCashRecord({id:uid('pay'),amount:asMoney(due),method:f.method,
      shift,reference:f.method==='transferencia'?String(f.reference).trim():'',createdAt:stamp,
      operator,finalPayment:true},tender,stamp,shift));
  }
  finishStay(stay,stamp,operator);
  persist();
  ui.selectedRoomId=null;ui.selectedStayId=null;ui.selectedHistoryStayId=stay.id;
  navigate('salidas');
  toast('Cuenta finalizada: Hab. '+(room?.number||'—')+'. Saldo '+money(dueOf(stay))+'. Habitación pendiente de limpieza.');
}
  function exportStayHistory(stayId){
  const stay=stayOf(stayId),room=roomOf(stay?.roomId),guest=guestOf(stay?.guestId);
  if(!stay){toast('No se encontró la estadía.','error');return;}
  const events=stayHistoryEvents(stay);
  const rows=[['Hotel Unicornio - movimientos de habitación',room?.number||'—'],['Huésped',guestName(guest)],
    ['Inicio',stay.arrival,'Salida prevista',stay.departure],
    ['Fecha y hora','Tipo','Concepto','Detalle','Importe USD'],
    ...events.map(e=>[e.date,e.kind,e.title,e.description,e.amount===null?'':e.kind==='abono'?-e.amount:e.amount]),
    ['Total cuenta','','','',totalOf(stay)],['Total abonado','','','',paidOf(stay)],
    ['Saldo actual','','','',dueOf(stay)],['Vuelto pendiente','','','',pendingChangeOf(stay)]];
  downloadCsv(rows,'movimientos-habitacion-'+(room?.number||'s-n')+'-'+String(stay.id).replace(/[^a-z0-9-]/gi,'')+'.csv');
}
  function processStock(){
    const f=readForm('stock-form'),p=productOf(f.productId),q=Number(f.quantity),mode=f.mode;
    if(!p||!Number.isInteger(q)||q<0||q>100000||!['conteo','entrada','merma'].includes(mode)){toast('Seleccione un producto y cantidad válida.','error');return;}
    if(mode!=='conteo'&&q===0){toast('Un ingreso o merma debe ser mayor que cero.','error');return;}
    if(mode!=='conteo'&&p.stock===null){toast('Primero registre un conteo físico inicial.','error');return;}
    if(mode==='merma'&&p.stock<q){toast('La merma supera el stock registrado.','error');return;}
    const previous=p.stock;
    p.stock=mode==='conteo'?q:mode==='entrada'?p.stock+q:p.stock-q;
    db.stockMoves.push({id:uid('stock'),productId:p.id,productName:p.name,mode,quantity:q,previous,after:p.stock,shift:f.shift||'dia',operator:String(f.operator||'').trim(),note:String(f.note||'').trim(),createdAt:new Date().toISOString()});
    persist();render();toast('Inventario actualizado: '+p.name+' · '+p.stock+' unidades.');
  }
  function processCashOut(){
    const f=readForm('cash-out-form'),amount=Number(f.amount);
    if(!Number.isFinite(amount)||amount<=0||amount>100000||!String(f.note||'').trim()){toast('Indique el motivo y un importe positivo.','error');return;}
    db.cashMovements.push({id:uid('cashout'),date:ui.cashDate||today(),shift:ui.cashShift||'dia',kind:f.kind==='retiro'?'retiro':'gasto',amount:asMoney(amount),operator:String(f.operator||'').trim(),note:f.note.trim(),createdAt:new Date().toISOString()});
    persist();render();toast('Salida de efectivo registrada.');
  }
  function processCashClose(){
    const f=readForm('cash-close-form'),date=ui.cashDate||today(),shift=ui.cashShift||'dia',float=Number(f.float),counted=Number(f.counted),operator=String(f.operator||'').trim();
    if(!operator||!Number.isFinite(float)||float<0||!Number.isFinite(counted)||counted<0){toast('Complete encargado, fondo y efectivo contado.','error');return;}
    const sum=cashTotals(date,shift),expected=asMoney(float+sum.cash-sum.out);
    const close={date,shift,operator,float:asMoney(float),counted:asMoney(counted),cash:sum.cash,transfer:sum.transfer,out:sum.out,changeGiven:sum.changeGiven,changePendingAtClose:sum.changePendingTotal,expected,variance:asMoney(counted-expected),notes:String(f.notes||'').trim(),createdAt:new Date().toISOString()};
    const i=db.closures.findIndex(c=>c.date===date&&c.shift===shift);
    if(i>=0&&!window.confirm('Ya existe un cierre para esta fecha y turno. ¿Desea actualizarlo con el arqueo actual?'))return;
    if(i>=0)db.closures[i]={...db.closures[i],...close};else db.closures.push({id:uid('closing'),...close});
    ui.cashDraft=null;persist();render();toast('Cierre guardado. Diferencia: '+money(close.variance)+'.');
  }
  function exportCash(){
    const date=ui.cashDate||today(),shift=ui.cashShift||'dia',summary=cashTotals(date,shift),closed=db.closures.find(c=>c.date===date&&c.shift===shift);
    const rows=[['Hotel Unicornio - cierre de caja','Fecha',date,'Turno',shift],['Concepto','Efectivo USD','Transferencia USD'],...summary.groups.map(g=>[g.label,g.efectivo,g.transferencia]),['EFECTIVO ENTREGADO / TRANSFERENCIAS',summary.cash,summary.transfer],['Vueltos entregados',summary.changeGiven,''],['Otros gastos / retiros',summary.otherOut,''],['Total salidas de efectivo',summary.out,''],['Vueltos pendientes actuales',summary.changePendingTotal,''],['Fondo inicial',closed?.float??'',''],['Efectivo esperado',closed?.expected??'',''],['Efectivo contado',closed?.counted??'',''],['Diferencia',closed?.variance??'',''],['Encargado',closed?.operator??'',''],['Observaciones',closed?.notes??'','']];
    downloadCsv(rows,'cierre-caja-hotel-unicornio-'+date+'-'+shift+'.csv');
  }
  function downloadCsv(rows,filename){
    const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const csv='\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Reporte descargado.');
  }
  function processRates(){
    const f=readForm('rates-form'),next={};
    for(const type of TYPES){
      const sin=Number(f[type+'-sin']),raw=String(f[type+'-con']??'').trim(),con=raw===''?null:Number(raw);
      if(!Number.isFinite(sin)||sin<0||(con!==null&&(!Number.isFinite(con)||con<0))||(!type.endsWith('_ventilador')&&con===null)){toast('Revise las tarifas; faltan valores obligatorios o hay importes inválidos.','error');return;}
      next[type]={sin:asMoney(sin),con:con===null?null:asMoney(con)};
    }
    for(const v of ['childRate','extraPersonRate','earlyFee']){const raw=String(f[v]??'').trim();if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0)){toast('Revise los cargos adicionales.','error');return;}db.config[v]=raw===''?null:asMoney(raw);}
    db.config.rates=next;persist();render();toast('Tarifas guardadas. Los registros anteriores conservan sus importes.');
  }
  function processProducts(){
    const f=readForm('products-form');for(const p of db.products){const v=String(f['product-'+p.id]??'').trim();if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)){toast('Revise el precio de '+p.name+'.','error');return;}}
    for(const p of db.products){const v=String(f['product-'+p.id]??'').trim();p.price=v===''?null:asMoney(v);}
    persist();render();toast('Catálogo de productos actualizado.');
  }
  function processInventory(){
    const f=readForm('room-inventory-form'),proposed=[];
    for(const r of db.rooms){
      const number=String(f[r.id+'__number']||'').trim().toUpperCase(),type=f[r.id+'__type'];
      if(!/^[A-Z0-9-]{1,8}$/.test(number)||!ROOM_TYPES.includes(type)){toast('Revise número y tipo de habitación.','error');return;}
      if(type!==r.type&&(occupied(r.id)||db.reservations.some(b=>b.roomId===r.id&&['pendiente','confirmada'].includes(b.status)))){toast('No puede cambiar el tipo de una habitación ocupada o con reserva activa.','error');return;}
      proposed.push({id:r.id,number,type});
    }
    if(new Set(proposed.map(x=>x.number)).size!==proposed.length){toast('Los números de habitación no pueden repetirse.','error');return;}
    for(const r of db.rooms){const p=proposed.find(x=>x.id===r.id);r.number=p.number;if(p.type!==r.type){r.status=p.type==='arrendada'?'arrendada':r.status==='arrendada'?'disponible':r.status;}r.type=p.type;}
    persist();render();toast('Inventario de habitaciones actualizado.');
  }
  function processNewProduct(){
    const f=readForm('new-product-form'),name=String(f.name||'').trim(),price=String(f.price??'').trim();
    if(!name||name.length>60||db.products.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast('Use un nombre de producto único, de hasta 60 caracteres.','error');return;}
    if(price!==''&&(!Number.isFinite(Number(price))||Number(price)<0)){toast('Ingrese un precio válido o deje el campo vacío.','error');return;}
    db.products.push({id:uid('product'),name,category:CATEGORIES[f.category]?f.category:'otros',price:price===''?null:asMoney(price),stock:null});persist();render();toast('Producto agregado al catálogo.');
  }
  function processNewRoom(){
    const f=readForm('new-room-form'),number=String(f.number||'').trim().toUpperCase();if(!/^[A-Z0-9-]{1,8}$/.test(number)){toast('El número admite letras, cifras y guiones (máximo 8).','error');return;}
    if(db.rooms.some(r=>r.number.toUpperCase()===number)){toast('Ya existe una habitación con ese número.','error');return;}
    if(!ROOM_TYPES.includes(f.type)){toast('Seleccione un tipo válido.','error');return;}
    db.rooms.push({id:uid('room'),number,type:f.type,status:f.type==='arrendada'?'arrendada':'disponible'});persist();render();toast('Habitación '+number+' agregada.');
  }
  function exportRoster(){
    const rows=[['Tipo','Nombre','Habitación','Entrada','Salida','Estado','Total USD','Pagado USD','Saldo USD']];
    for(const b of db.reservations)rows.push(['Reserva',b.name,roomOf(b.roomId)?.number||'Por asignar',b.arrival,b.departure,b.status,b.total,b.advance,asMoney(b.total-b.advance)]);
    for(const s of db.stays)rows.push(['Hospedaje',guestName(guestOf(s.guestId)),roomOf(s.roomId)?.number||'',s.arrival,s.departure,s.status,totalOf(s),paidOf(s),dueOf(s)]);
    const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const csv='\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nomina-hotel-unicornio-'+today()+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Nómina de demostración exportada a CSV.');
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view]');if(nav){navigate(nav.dataset.view);return;}
    if(e.target.closest('#menu-toggle')){document.getElementById('sidebar').classList.toggle('open');return;}
    if(e.target.closest('#dismiss-notice')){document.querySelector('.notice')?.remove();return;}
    if(e.target.classList?.contains('reservation-guest-overlay')){closeReservationGuestSearch();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action,id=el.dataset.id;
    switch(action){
      case 'go-inicio':navigate('inicio');break;
      case 'go-ingreso':ui.prefillBookingId=null;ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;ui.checkinDraft=initialCheckinDraft();ui.lookup.ingreso='';ui.lookupMessage.ingreso='';navigate('ingreso');break;
      case 'go-reservas':navigate('reservas');break;
      case 'go-habitaciones':navigate('habitaciones');break;
      case 'toggle-room-dates':{
        ui.roomDateMode=!ui.roomDateMode;
        ui.roomDate=ui.roomDateMode?(roomDateValid(ui.roomDate)?ui.roomDate:today()):null;
        ui.roomFilter='todos';ui.selectedRoomId=null;render();
        break;
      }
      case 'room-plan-today':{
        ui.roomDateMode=true;ui.roomDate=today();ui.selectedRoomId=null;render();break;
      }
      case 'room-plan-tomorrow':{
        ui.roomDateMode=true;ui.roomDate=tomorrow();ui.selectedRoomId=null;render();break;
      }
      case 'print-housekeeping':printHousekeepingReport();break;
      case 'filter-room-summary':{
        if(!['ocupada','disponible','por-cobrar','reservadas'].includes(id))break;
        ui.roomFilter=ui.roomFilter===id?'todos':id;
        ui.selectedRoomId=null;
        render();
        document.getElementById('room-map')?.scrollIntoView?.({behavior:'smooth',block:'start'});
        break;
      }
      case 'go-salidas':navigate('salidas');break;
      case 'go-configuracion':navigate('configuracion');break;
      case 'go-inventario':navigate('inventario');break;
      case 'go-varios':navigate('varios');break;
      case 'go-caja':navigate('caja');break;
      case 'export-cash':exportCash();break;
      case 'pick-product':{const sel=document.querySelector('#extra-form [name=productId]');if(sel){sel.value=id;updatePricing();sel.closest('.panel')?.scrollIntoView({behavior:'smooth',block:'center'});}break;}
      case 'lookup-guest':lookupGuest(el.dataset.scope);break;
      case 'open-reservation-guest-search':openReservationGuestSearch();break;
      case 'close-reservation-guest-search':closeReservationGuestSearch();break;
      case 'select-reservation-guest':selectReservationGuest(id);break;
      case 'add-checkin-room':{
        const data=readForm('checkin-form');
        ui.checkinDraft={...ui.checkinDraft,...data};
        const max=db.rooms.filter(r=>r.type!=='arrendada').length;
        if(checkinAssignments(data).length>=max){toast('No se pueden registrar más habitaciones operativas en este ingreso.','error');break;}
        ui.checkinRowSeq=Number(ui.checkinRowSeq||0)+1;
        const key='batch'+ui.checkinRowSeq;
        if(!ui.checkinExtraRooms)ui.checkinExtraRooms=[];
        ui.checkinExtraRooms.push({key});
        ui.checkinDraft[key+'__type']='individual';
        ui.checkinDraft[key+'__breakfast']='sin';
        ui.checkinDraft[key+'__roomId']='';
        render();
        break;
      }
      case 'remove-checkin-room':{
        ui.checkinDraft={...ui.checkinDraft,...readForm('checkin-form')};
        ui.checkinExtraRooms=(ui.checkinExtraRooms||[]).filter(r=>r.key!==id);
        for(const row of ui.checkinVarios||[])if(row.roomKey===id)row.roomKey='principal';
        render();break;
      }
      case 'checkin-add-product':{
        ui.checkinVariosOpen=true;
        const product=productOf(id);if(!product||product.price===null||Number(product.price)<=0){toast('Producto no disponible o sin precio.','error');break;}
        const values=readForm('checkin-form');syncCheckinVariosForm();
        ui.checkinDraft={...ui.checkinDraft,...values};
        const existing=(ui.checkinVarios||[]).filter(row=>row.productId===id).reduce((sum,row)=>sum+(Number(row.quantity)||0),0);
        if(product.stock!==null&&existing+1>product.stock){toast('No quedan existencias disponibles de '+product.name+'.','error');break;}
        ui.checkinVariosSeq=Number(ui.checkinVariosSeq||0)+1;
        ui.checkinVarios.push({key:'checkvar'+ui.checkinVariosSeq,productId:id,quantity:'1',roomKey:'principal'});
        render();break;
      }
      case 'checkin-remove-product':{
        ui.checkinVariosOpen=true;
        const values=readForm('checkin-form');syncCheckinVariosForm();
        ui.checkinDraft={...ui.checkinDraft,...values};
        ui.checkinVarios=(ui.checkinVarios||[]).filter(row=>row.key!==id);
        render();break;
      }
      case 'select-room':ui.selectedRoomId=id;navigate('habitaciones');break;
      case 'close-room-account':
        if(e.target.closest('[data-account-dialog]')&&!e.target.closest('.account-close'))break;
        ui.selectedRoomId=null;render();break;
      case 'room-add-extras':ui.extraTarget=id;navigate('varios');break;
      case 'room-go-checkout':ui.selectedStayId=id;ui.selectedRoomId=null;navigate('salidas');break;
      case 'history-older':ui.closedHistoryPage=Number(ui.closedHistoryPage||0)+1;render();break;
      case 'history-newer':ui.closedHistoryPage=Math.max(0,Number(ui.closedHistoryPage||0)-1);render();break;
      case 'show-stay-history':ui.selectedHistoryStayId=id;render();break;
      case 'close-history-dialog':
        if(e.target.closest('[data-account-dialog]')&&!e.target.closest('.account-close'))break;
        ui.selectedHistoryStayId=null;render();break;
      case 'export-stay-history':exportStayHistory(id);break;
      case 'settle-change':{
        const r=changeMovements().find(x=>x.source===el.dataset.source&&x.id===id);
        if(!r||r.owner.changeStatus!=='pendiente'){toast('El vuelto ya no está pendiente.','error');break;}
        if(!window.confirm('¿Confirma que entregó físicamente '+money(r.owner.cashChange)+' de vuelto? Se descontará de la caja del turno actual.'))break;
        r.owner.changeStatus='dado';r.owner.changeDeliveredAt=new Date().toISOString();r.owner.changeDeliveredShift=ui.cashShift||'dia';
        persist();render();toast('Vuelto entregado: '+money(r.owner.cashChange)+'. La salida se registró en caja.');break;
      }
      case 'start-room-checkin':{
        const room=roomOf(id);if(!room||room.status!=='disponible'){toast('Esta habitación no está disponible.','error');break;}
        ui.prefillBookingId=null;ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;ui.checkinDraft={...initialCheckinDraft(),type:room.type==='flex_aire'?'individual':room.type==='flex_ventilador'?'individual_ventilador':room.type,roomId:room.id};ui.lookup.ingreso='';ui.lookupMessage.ingreso='';navigate('ingreso');break;
      }
      case 'mark-room-dirty':{
        const room=roomOf(id);if(!room||room.status==='ocupada'||room.status==='arrendada'){toast('No puede cambiar una habitación ocupada o arrendada.','error');break;}
        room.status='limpieza';persist();render();toast('Habitación '+room.number+' marcada pendiente de limpieza.');break;
      }
      case 'mark-room-clean':{
        const room=roomOf(id);if(!room||room.status==='ocupada'||room.status==='arrendada'){toast('Una habitación ocupada o arrendada no puede liberarse manualmente.','error');break;}
        room.status='disponible';persist();render();toast('Habitación '+room.number+' disponible.');break;
      }
      case 'checkin-booking':startBookedCheckin(id);break;
      case 'checkin-guest':{
        const g=guestOf(id);if(!g)break;
        ui.prefillBookingId=null;ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;ui.checkinDraft={...initialCheckinDraft(),...guestData(g)};ui.lookup.ingreso=g.document;ui.lookupMessage.ingreso='Huésped encontrado: '+guestName(g);ui.lookupResult.ingreso=true;navigate('ingreso');break;
      }
      case 'unlink-booking':ui.prefillBookingId=null;render();break;
      case 'cancel-booking':{
        const b=reservationOf(id);if(!b||!['pendiente','confirmada'].includes(b.status))break;
        if(!window.confirm('¿Cancelar esta reserva? Si existe un anticipo, gestione su devolución fuera de este prototipo.'))break;
        b.status='cancelada';persist();render();toast('Reserva cancelada.');break;
      }
      case 'select-stay':ui.selectedStayId=id;render();break;
      case 'checkout-stay':{
        const stay=stayOf(id);if(!stay||stay.status!=='activa')break;
        if(dueOf(stay)>0){toast('Antes de registrar la salida debe cancelar '+money(dueOf(stay))+'. Use Cierre de cuenta final para cobrar y cerrar en una operación.','error');break;}
        const pending=pendingChangeOf(stay);
        if(pending>0&&!window.confirm('Hay '+money(pending)+' de vuelto pendiente a favor del huésped. ¿Confirmar salida dejando esa obligación en caja?'))break;
        const room=roomOf(stay.roomId);
        if(!window.confirm('¿Registrar la salida de Hab. '+(room?.number||'—')+' y enviar a limpieza?'))break;
        finishStay(stay,new Date().toISOString(),'Recepción');
        persist();ui.selectedRoomId=null;ui.selectedStayId=null;ui.selectedHistoryStayId=stay.id;
        navigate('salidas');toast('Cuenta cerrada. Hab. '+(room?.number||'—')+' pendiente de limpieza.');break;
      }
      case 'delete-room':{
        const r=roomOf(id);if(!r)break;
        if(db.stays.some(s=>s.roomId===id)||db.reservations.some(b=>b.roomId===id)){toast('No puede eliminar una habitación con historial o reservas vinculadas.','error');break;}
        if(!window.confirm('¿Eliminar la habitación '+r.number+' del inventario de demostración?'))break;
        db.rooms=db.rooms.filter(x=>x.id!==id);if(ui.selectedRoomId===id)ui.selectedRoomId=null;persist();render();toast('Habitación eliminada.');break;
      }
      case 'export-roster':exportRoster();break;
      case 'reset-demo':{
        if(window.hotelCloud?.ready){toast('La opción de borrar todos los datos está deshabilitada mientras se usa la base compartida.','error');break;}
        if(!window.confirm('Se eliminarán todos los datos de demostración de este navegador. ¿Continuar?'))break;
        db=defaults();ui={view:'inicio',selectedRoomId:null,roomFilter:'todos',roomTypeFilter:'todos',lookup:{ingreso:'',huespedes:''},lookupMessage:{},lookupResult:{},checkinDraft:null,reservationDraft:null,reservationCreateOpen:false,reservationGuestSearchOpen:false,reservationGuestSearchQuery:'',selectedStayId:null,prefillBookingId:null,productCategory:'todas',stockCategory:'todas',cashDate:null,cashShift:'dia'};persist();render();toast('Demostración restablecida.');break;
      }
      default:break;
    }
  });
  // Keep expanded/collapsed state across UI redraws, without saving it to Supabase.
  document.addEventListener('toggle',e=>{
    if(e.target?.id==='checkin-varios-panel')ui.checkinVariosOpen=e.target.open;
    if(e.target?.id==='reservation-create-details')ui.reservationCreateOpen=e.target.open;
  },true);
  document.addEventListener('input',e=>{
    const target=e.target;
    if(target.id==='reservation-guest-search-input'){
      ui.reservationGuestSearchQuery=target.value;
      const results=document.getElementById('reservation-guest-results');
      if(results)results.innerHTML=renderReservationGuestResults(target.value);
      return;
    }
    if(target.id==='checkin-varios-search'){
      ui.checkinProductSearch=target.value;
      const list=document.getElementById('checkin-product-results');
      if(list)list.innerHTML=renderCheckinProductResults(target.value);
      return;
    }
    if(target.closest('#checkin-form')){
      const values=readForm('checkin-form');
      ui.checkinDraft={...ui.checkinDraft,...values,
        paymentVerified:values.paymentVerified||'',creditConfirmed:values.creditConfirmed||''};
      syncCheckinVariosForm();updatePricing();
    }
    if(target.closest('#reservation-form')){ui.reservationDraft={...ui.reservationDraft,...readForm('reservation-form')};updatePricing();}
    if(['#extra-form','#manual-extra-form','#cash-close-form','#payment-form','#room-extra-form','#room-breakfast-form','#room-extension-form','#room-person-form','#finalize-form'].some(s=>target.closest(s)))updatePricing();
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='filter-product-category'){ui.productCategory=el.value;render();return;}
    if(el.id==='filter-stock-category'){ui.stockCategory=el.value;render();return;}
    if(el.id==='cash-date'||el.id==='cash-shift'){ui.cashDraft=readForm('cash-close-form');if(el.id==='cash-date')ui.cashDate=el.value;else ui.cashShift=el.value;render();return;}
    if(el.id==='room-plan-date'){
      if(!roomDateValid(el.value)){
        toast('Seleccione una fecha válida de hoy en adelante para consultar las habitaciones.','error');
        el.value=roomPlanningDate();return;
      }
      ui.roomDateMode=true;ui.roomDate=el.value;ui.selectedRoomId=null;render();return;
    }
    if(el.id==='filter-room-status'){ui.roomFilter=el.value;render();return;}
    if(el.id==='filter-room-type'){ui.roomTypeFilter=el.value;render();return;}
    if(el.closest('#checkin-form')){
      const values=readForm('checkin-form');
      ui.checkinDraft={...ui.checkinDraft,...values,
        paymentVerified:values.paymentVerified||'',creditConfirmed:values.creditConfirmed||''};
      syncCheckinVariosForm();
      if(['type','arrival','departure','roomId'].includes(el.name)||/^batch\d+__(?:type|roomId)$/.test(el.name))refreshRoomSelect('ingreso');
      if(el.name==='paymentMethod'){
        // Cada cambio de método requiere confirmación nueva.
        const paidFlag=document.getElementById('checkin-payment-verified'),creditFlag=document.getElementById('checkin-credit-confirmed');
        if(paidFlag)paidFlag.checked=false;
        if(creditFlag)creditFlag.checked=false;
        ui.checkinDraft.paymentVerified='';
        ui.checkinDraft.creditConfirmed='';
        const transfer=checkinPaymentChoice(el.value)?.method==='transferencia';
        document.getElementById('transfer-field')?.classList.toggle('hidden',!transfer);
      }
      if(el.name==='invoice')document.getElementById('invoice-fields')?.classList.toggle('hidden',el.value!=='si');
      updatePricing();return;
    }
    if(el.closest('#reservation-form')){
      ui.reservationDraft={...ui.reservationDraft,...readForm('reservation-form')};
      if(['type','arrival','departure'].includes(el.name))refreshRoomSelect('reservas');
      updatePricing();return;
    }
    if(el.closest('#payment-form')&&el.name==='method')document.getElementById('payment-reference')?.classList.toggle('hidden',el.value!=='transferencia');
    if(['#payment-form','#extra-form','#manual-extra-form','#room-extra-form','#room-breakfast-form','#room-extension-form','#room-person-form','#finalize-form'].some(s=>el.closest(s)))updatePricing();
  });
  document.addEventListener('submit',e=>{
    const id=e.target?.id;if(!id)return;
    const handlers={'checkin-form':processCheckin,'reservation-form':processReservation,'guest-form':processGuest,'payment-form':processPayment,'room-extra-form':processRoomExtra,'room-person-form':processAdditionalPerson,'room-breakfast-form':processBreakfast,'room-extension-form':processExtendStay,'finalize-form':processFinalSettlement,'extra-form':processExtra,'manual-extra-form':processManualExtra,'stock-form':processStock,'cash-out-form':processCashOut,'cash-close-form':processCashClose,'rates-form':processRates,'products-form':processProducts,'new-product-form':processNewProduct,'new-room-form':processNewRoom,'room-inventory-form':processInventory};
    if(handlers[id]){e.preventDefault();handlers[id]();}
  });
  document.addEventListener('reset',e=>{
    const id=e.target?.id;
    if(id==='checkin-form'){e.preventDefault();ui.checkinExtraRooms=[];ui.checkinRowSeq=0;ui.checkinVarios=[];ui.checkinVariosSeq=0;ui.checkinProductSearch='';ui.checkinVariosOpen=false;ui.checkinDraft=initialCheckinDraft();ui.prefillBookingId=null;ui.lookup.ingreso='';ui.lookupMessage.ingreso='';ui.lookupResult.ingreso=false;render();}
    else if(id==='reservation-form'){e.preventDefault();ui.reservationDraft=initialReservationDraft();ui.reservationGuestSearchOpen=false;ui.reservationGuestSearchQuery='';render();}
    else if(id==='guest-form'){e.preventDefault();ui.lookup.huespedes='';ui.lookupMessage.huespedes='';ui.lookupResult.huespedes=false;render();}
  });
  
  document.addEventListener('keydown',e=>{
    if(ui.reservationGuestSearchOpen){
      if(e.key==='Escape'){e.preventDefault();closeReservationGuestSearch();return;}
      if(e.key==='Enter'&&e.target.id==='reservation-guest-search-input'){e.preventDefault();return;}
      if(e.key==='Tab'){
        const dialog=document.getElementById('reservation-guest-dialog');
        const controls=[...(dialog?.querySelectorAll('button:not([disabled]),input:not([disabled])')||[])];
        if(controls.length){
          if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus();return;}
          if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus();return;}
        }
      }
    }
    if(e.key==='Enter'&&e.target.id==='checkin-varios-search'){e.preventDefault();return;}
    if(e.key==='Escape'&&ui.selectedHistoryStayId){ui.selectedHistoryStayId=null;render();return;}
    if(e.key==='Escape'&&ui.selectedRoomId){ui.selectedRoomId=null;render();return;}
    if(e.key==='Enter'&&e.target.matches('#lookup-ingreso,#lookup-huespedes')){e.preventDefault();lookupGuest(e.target.id.replace('lookup-',''));}
  });
  document.getElementById('year').textContent=String(new Date().getFullYear());
  document.getElementById('current-date').textContent=new Intl.DateTimeFormat('es-EC',{weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  if(window.hotelCloud?.ready){
    window.hotelCloud.bindUI({replace:function(nextData){
      db=JSON.parse(JSON.stringify(nextData));
      // Avoid wiping partially completed forms when another device changes state.
      if(document.activeElement && document.activeElement.matches('input,select,textarea')) {
        toast('Hay actualizaciones de otro dispositivo. Se mostrarán al navegar de sección.');
      }else{render();}
    }});
  }
  render();
})();