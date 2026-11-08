'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const catalogue=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalogo/primera-tanda-fotos-2026-11-08.json'),'utf8')).products;
const tail='  render();\n})();';
assert(app.trimEnd().endsWith(tail),'Cierre app.js no identificado');
const src=app.trimEnd().slice(0,-tail.length)+
 '\nwindow.__stockTest={defaults,renderStock,renderExtras,renderRoomProductMatches,productByBarcode,roomProductMatches,'+
 'processStock,appendExtra,applyRoomBarcode,locationStock,syncProductStock,stockAvailabilityLabel,'+
 'setDb:d=>{db=d;},getDb:()=>db,setUI:x=>{ui=x;},getUI:()=>ui,setContext:x=>{roomBarcodeContext=x;}};\n})();';
const messages=[],formNodes={},listeners={};
const dom={sidebar:{classList:{remove(){}}},'app-view':{innerHTML:''},breadcrumb:{textContent:''},
 year:{textContent:''},'current-date':{textContent:''},toasts:{append(n){messages.push(n.textContent)}}};
const document={
 getElementById:id=>formNodes[id]||dom[id]||null,
 querySelectorAll(){return []},querySelector(){return null},
 addEventListener(name,fn){listeners[name]=fn},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}}
};
const window={confirm(){return true},scrollTo(){}};
class FakeFormData{constructor(n){this.data=n.data||{}}entries(){return Object.entries(this.data)}}
const sandbox={document,window,localStorage:{getItem(){return null},setItem(){}},
 FormData:FakeFormData,Date,Intl,Math,Number,Array,String,Object,JSON,RegExp,Map,Set,URL,Blob,setTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(src,sandbox,{timeout:5000});
const t=window.__stockTest;
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failures++;console.error('FAIL',name,e.stack||e)}}
function setForm(id,data){formNodes[id]={data}}
function boot(){
 const db=t.defaults();
 for(const item of catalogue)db.products.push({...item});
 t.setDb(db);t.setUI({...t.getUI(),view:'inventario',stockCategory:'todas'});
 messages.length=0;return db;
}
test('Fotografías distintas: 10 registros, 8 códigos completos, sin duplicados',()=>{
 const seen=new Set();
 assert.equal(catalogue.length,10);
 assert.equal(catalogue.filter(p=>p.barcode).length,8);
 for(const p of catalogue){
  assert.equal(p.price,null);assert.equal(p.stock,null);assert.equal(p.stockNevera,null);assert.equal(p.stockBodega,null);
  assert(!seen.has(p.id));seen.add(p.id);
 }
});
test('La pantalla de inventario muestra nevera, bodega, escaneo, sin conteo',()=>{
 const db=boot(),html=t.renderStock();
 assert(html.includes('data-action="open-stock-barcode-scanner"'));
 assert(html.includes('id="stock-location"'));
 assert(html.includes('id="stock-mode"'));
 assert(html.includes('Nevera'));assert(html.includes('Bodega'));
 assert(html.includes('Sin conteo'));
 assert(!db.stockMoves.length);
});
test('Se pueden buscar artículos sin precio para identificarlos, sin autorizar venta',()=>{
 const db=boot(),p=db.products.find(x=>x.barcode==='7861024611640');
 assert.equal(t.productByBarcode('7861024611640').id,p.id);
 assert(t.roomProductMatches('frutas tropicales').some(x=>x.id===p.id));
 const html=t.renderRoomProductMatches('frutas tropicales');
 assert(html.includes('Precio pendiente'));assert(html.includes('disabled title="Precio de venta pendiente"'));
});
test('El escáner en modo inventario reconoce el código y no añade existencias',()=>{
 const db=boot(),dropdown={value:''},count={value:'',focus(){}};
 formNodes['stock-product']=dropdown;formNodes['stock-quantity']=count;
 formNodes['stock-form']={data:{productId:'',location:'nevera',mode:'conteo',quantity:''}};
 t.setContext('stock');
 assert(t.applyRoomBarcode('7861024605878'));
 assert.equal(dropdown.value,'foto-20261108-164508');
 assert.equal(db.stockMoves.length,0);
 assert.equal(t.productByBarcode('7861024605878').stock,null);
 delete formNodes['stock-product'];delete formNodes['stock-quantity'];delete formNodes['stock-form'];
});
test('El primer conteo registra nevera sin inventar cantidades en bodega',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164504');
 setForm('stock-form',{productId:p.id,location:'nevera',mode:'conteo',quantity:'32',operator:'Recepción noche'});
 t.processStock();
 assert.equal(p.stockNevera,32);assert.equal(p.stockBodega,null);assert.equal(p.stock,null);
 assert.equal(db.stockMoves.length,1);assert.equal(db.stockMoves[0].location,'nevera');
 delete formNodes['stock-form'];
});
test('Conteo bodega y suma total solo si ambas ubicaciones fueron contadas',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164504');
 setForm('stock-form',{productId:p.id,location:'nevera',mode:'conteo',quantity:'10'});
 t.processStock();
 setForm('stock-form',{productId:p.id,location:'bodega',mode:'conteo',quantity:'24'});
 t.processStock();
 assert.equal(p.stock,34);assert.equal(p.stockNevera,10);assert.equal(p.stockBodega,24);
 delete formNodes['stock-form'];
});
test('Traslado desde bodega a nevera no altera el total ni crea una venta',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164504');
 p.stockNevera=2;p.stockBodega=20;t.syncProductStock(p);
 setForm('stock-form',{productId:p.id,location:'bodega',mode:'traslado',quantity:'5'});
 t.processStock();
 assert.equal(p.stockNevera,7);assert.equal(p.stockBodega,15);assert.equal(p.stock,22);
 assert.equal(db.extras.length,0);assert.equal(db.stockMoves.at(-1).mode,'traslado');
 delete formNodes['stock-form'];
});
test('No se aceptan mermas mayores que la ubicación ni traslados sin conteos iniciales',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164504');
 p.stockNevera=2;
 setForm('stock-form',{productId:p.id,location:'nevera',mode:'merma',quantity:'4'});
 t.processStock();assert.equal(p.stockNevera,2);
 setForm('stock-form',{productId:p.id,location:'nevera',mode:'traslado',quantity:'1'});
 t.processStock();assert.equal(p.stockBodega,null);
 assert.equal(db.stockMoves.length,0);
 delete formNodes['stock-form'];
});
test('Vender un producto descontará solo de nevera, no del almacén',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164508');
 p.price=1.5;p.stockNevera=5;p.stockBodega=10;t.syncProductStock(p);
 const ok=t.appendExtra({stayId:'caja',quantity:'2',method:'efectivo',shift:'dia',cashTendered:'3'},p);
 assert(ok);assert.equal(p.stockNevera,3);assert.equal(p.stockBodega,10);assert.equal(p.stock,13);
 assert.equal(db.extras.length,1);
});
test('No puede vender cuando nevera está agotada aunque haya existencias en bodega',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164508');
 p.price=1.5;p.stockNevera=0;p.stockBodega=10;t.syncProductStock(p);
 assert.equal(t.stockAvailabilityLabel(p),'Reponer nevera');
 assert.equal(t.appendExtra({stayId:'caja',quantity:'1',method:'efectivo'},p),false);
 assert.equal(db.extras.length,0);assert.equal(p.stockBodega,10);
});
test('Las cantidades no contadas nunca se interpretan como cero',()=>{
 const db=boot(),p=db.products.find(x=>x.id==='foto-20261108-164508');
 assert.equal(t.locationStock(p,'nevera'),null);
 assert.equal(t.stockAvailabilityLabel(p),'Nevera sin conteo');
 assert(t.renderStock().includes('Sin conteo'));
});
if(failures)process.exitCode=1;
