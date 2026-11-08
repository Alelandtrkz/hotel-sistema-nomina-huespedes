'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const tail='  render();\n})();';
assert(original.trimEnd().endsWith(tail),'No coincide el cierre de app.js');
const source=original.trimEnd().slice(0,-tail.length)+
  '\nwindow.__roomV18={defaults,renderRoomAccount,renderRoomExtraSection,renderRoomProductMatches,renderSettings,renderBreakfastSection,renderExtendStaySection,'+
  'roomProductMatches,selectRoomExtraProduct,normalizeBarcode,barcodeValid,productByBarcode,applyRoomBarcode,extensionQuote,processBreakfast,processExtendStay,processProducts,processNewProduct,'+
  'stayHistoryEvents,totalOf,dueOf,paidOf,cashTotals,setDB:d=>{db=d;},getDB:()=>db,setUI:v=>{ui=v;},getUI:()=>ui};\n})();';
const messages=[],forms={};
const dom={
 'app-view':{innerHTML:''},breadcrumb:{textContent:''},year:{textContent:''},
 'current-date':{textContent:''},sidebar:{classList:{remove(){}}},
 toasts:{append(node){messages.push(node.textContent)}}
};
const listeners={};
const document={
 getElementById(id){return dom[id]||forms[id]||null;},
 querySelectorAll(){return []},querySelector(){return null;},
 addEventListener(name,cb){listeners[name]=cb;},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}},
 activeElement:null
};
let confirmed=true;
const window={scrollTo(){},confirm(){return confirmed;}};
class FakeFormData {constructor(el){this.values=el.data||{}} entries(){return Object.entries(this.values)}}
const sandbox={window,document,localStorage:{getItem(){return null},setItem(){}},
 Date,Intl,Math,Number,String,Object,JSON,Array,RegExp,Map,Set,URL,Blob,
 FormData:FakeFormData,setTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:5000});
const t=window.__roomV18;
let failed=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(err){failed++;console.error('FAIL',name,err.stack||err)}}
function form(id,data){forms[id]={data};}
function setup(){
 const d=t.defaults(),r=d.rooms.find(x=>x.id==='room-01');
 r.status='ocupada';
 d.guests=[{id:'guest-fake',firstName:'PRUEBA',lastName:'HUÉSPED',phone:'0990000000',document:'0102030400'}];
 d.stays=[{id:'stay-fake',guestId:'guest-fake',roomId:r.id,status:'activa',
  arrival:'2026-11-08',departure:'2026-11-10',roomRate:20,roomTotal:40,advance:0,payments:[],breakfast:'sin',
  createdAt:'2026-11-08T12:00:00Z'}];
 t.setDB(d);t.setUI({...t.getUI(),view:'habitaciones',selectedRoomId:r.id});
 messages.length=0;return {d,r,s:d.stays[0]};
}
test('Cuenta compacta: datos, desglose y pagos son secciones plegables',()=>{
 const {r,s}=setup(),html=t.renderRoomAccount(r,s);
 for(const label of ['Datos del huésped','Desglose de la cuenta','Registrar abono parcial o total','Agregar desayunos'])
   assert(html.includes(label),label);
 assert(html.includes('<details class="account-info-details"><summary>Datos del huésped'));
 assert(html.includes('<details class="account-info-details"><summary>Desglose de la cuenta'));
 assert(html.includes('<details class="account-payment-section"><summary>Registrar abono parcial o total'));
 assert(html.includes('<details class="account-totals-details">'));
});
test('Dos botones Buscar y Escanear en Varios y selector de producto original',()=>{
 const {s}=setup(),html=t.renderRoomExtraSection(s);
 assert(html.includes('data-action="toggle-room-extra-search"'));
 assert(html.includes('data-action="open-room-barcode-scanner"'));
 assert(html.includes('id="room-extra-product"'));
});
test('La búsqueda encuentra nombre con tilde, categoría y código; escapa etiquetas HTML',()=>{
 const {d}=setup();d.products[0].name='Bebida Café <script>';d.products[0].barcode='7500000000012';
 assert.equal(t.roomProductMatches('cafe')[0].id,d.products[0].id);
 assert(t.roomProductMatches('bebidas').length>0);
 assert(t.roomProductMatches('7500000000012').some(p=>p.id===d.products[0].id));
 const html=t.renderRoomProductMatches('cafe');
 assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
});
test('El catálogo permite asociar códigos sin cambiar precios ni huéspedes',()=>{
 const {d}=setup();const item=d.products[0];
 assert(t.renderSettings().includes('name="barcode-'+item.id+'"'));
 const values={};for(const p of d.products){values['product-'+p.id]=p.price===null?'':String(p.price);values['barcode-'+p.id]=p.id===item.id?'7501234567890':'';}
 form('products-form',values);t.processProducts();
 assert.equal(item.barcode,'7501234567890');
 assert.equal(t.productByBarcode('7501234567890').id,item.id);
 assert.equal(d.guests.length,1);
});
test('Códigos de barras duplicados se rechazan sin cambiar el catálogo',()=>{
 const {d}=setup();const values={};
 for(const p of d.products){values['product-'+p.id]=p.price===null?'':String(p.price);values['barcode-'+p.id]='';}
 values['barcode-'+d.products[0].id]='7501111000012';values['barcode-'+d.products[1].id]='7501111000012';
 form('products-form',values);t.processProducts();
 assert(!d.products[0].barcode);assert(!d.products[1].barcode);
 assert(messages.some(x=>/no pueden repetirse/.test(x)));
});
test('Escaneo o código escrito selecciona el producto sin realizar cargo ni cobro',()=>{
 const {d,s}=setup(),p=d.products[1];p.barcode='7509876543210';
 const picker={value:'',focus(){}},finder={classList:{add(){}}};
 dom['room-extra-product']=picker;dom['room-extra-search']=finder;
 assert(t.applyRoomBarcode('7509876543210'));
 assert.equal(picker.value,p.id);
 assert.equal(d.extras.length,0);assert.equal(t.dueOf(s),40);
 assert(!t.applyRoomBarcode('9999999999999'));
 delete dom['room-extra-product'];delete dom['room-extra-search'];
});
test('Desayunos 3 unidades generan cargo $15 sin movimiento directo de caja',()=>{
 const {d,s}=setup();form('room-breakfast-form',{stayId:s.id,quantity:'3',shift:'dia',operator:'PRUEBA'});
 t.processBreakfast();
 assert.equal(d.extras.length,1);
 assert.equal(d.extras[0].quantity,3);assert.equal(d.extras[0].price,5);
 assert.equal(d.extras[0].amount,undefined);
 assert.equal(d.extras[0].method,'pendiente');assert.equal(t.dueOf(s),55);
 assert.equal(d.stockMoves.length,0);
 assert(t.stayHistoryEvents(s).some(e=>e.title.includes('Desayuno adicional')&&e.amount===15));
});
test('Cantidad inválida o confirmación rechazada no añade desayunos',()=>{
 const {d,s}=setup();form('room-breakfast-form',{stayId:s.id,quantity:'0'});
 t.processBreakfast();
 form('room-breakfast-form',{stayId:s.id,quantity:'1.5'});t.processBreakfast();
 confirmed=false;form('room-breakfast-form',{stayId:s.id,quantity:'2'});t.processBreakfast();confirmed=true;
 assert.equal(d.extras.length,0);
});
test('Con desayuno incluido se advierte que el nuevo cargo es adicional',()=>{
 const {s}=setup();s.breakfast='con';
 assert(t.renderBreakfastSection(s).includes('ya incluye desayuno'));
});
test('Extender tres noches usa tarifa histórica, fecha final y movimiento único',()=>{
 const {s}=setup();
 assert.equal(t.extensionQuote(s,3).newDeparture,'2026-11-13');
 form('room-extension-form',{stayId:s.id,nights:'3',shift:'noche',operator:'RECEPCIÓN PRUEBA'});
 t.processExtendStay();
 assert.equal(s.departure,'2026-11-13');assert.equal(s.roomTotal,100);
 assert.equal(s.extensions.length,1);assert.equal(s.extensions[0].addedNights,3);
 assert.equal(s.extensions[0].amount,60);assert.equal(t.dueOf(s),100);
 assert(t.stayHistoryEvents(s).some(e=>e.title==='Noches adicionales'&&e.amount===60));
});
test('Reserva a mitad de la extensión de tres noches bloquea la operación completa',()=>{
 const {d,s}=setup();d.reservations.push({
  id:'booking-synthetic',roomId:s.roomId,status:'confirmada',arrival:'2026-11-12',departure:'2026-11-13'
 });
 assert(t.extensionQuote(s,1).total===20);
 assert(t.extensionQuote(s,3).error.includes('reserva'));
 form('room-extension-form',{stayId:s.id,nights:'3'});t.processExtendStay();
 assert.equal(s.roomTotal,40);assert.equal(s.departure,'2026-11-10');
 assert.equal((s.extensions||[]).length,0);
});
test('Extensiones no admiten fracciones, cero ni más de 90 noches',()=>{
 const {s}=setup();
 for(const n of [0,-1,1.5,91,'abc'])
   assert(t.extensionQuote(s,n).error,'Esperaba error para '+n);
});
test('Se mantienen los abonos y el saldo de desayunos más tres noches',()=>{
 const {s}=setup();form('room-breakfast-form',{stayId:s.id,quantity:'2'});t.processBreakfast();
 form('room-extension-form',{stayId:s.id,nights:'3'});t.processExtendStay();
 assert.equal(t.totalOf(s),110);
 s.payments.push({amount:30,method:'efectivo',createdAt:new Date().toISOString()});
 assert.equal(t.paidOf(s),30);assert.equal(t.dueOf(s),80);
});
test('El escáner utiliza biblioteca con versión fija, exige cámara y permite código manual',()=>{
 assert(original.includes('html5-qrcode@2.3.8'));
 assert(original.includes("facingMode:'environment'"));
 assert(original.includes('room-barcode-manual'));
 assert(original.includes('stopRoomBarcodeCamera()'));
});
if(failed)process.exitCode=1;
