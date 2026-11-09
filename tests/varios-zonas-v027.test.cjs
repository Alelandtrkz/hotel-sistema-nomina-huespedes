'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),styles=fs.readFileSync(path.resolve(__dirname,'../styles.css'),'utf8');
const tail='  render();\n})();';
assert(source.trimEnd().endsWith(tail),'app.js debe conservar su estructura de cierre');
const exposed=source.trimEnd().slice(0,-tail.length)+
 '\nwindow.__v27={defaults,renderExtras,renderSettings,renderSalesCatalogCards,updateSalesCatalog,productSalesZone,salesZoneMatches,salesFilteredProducts,processProducts,processNewProduct,locationStock,sortProduct,'+
 'setDB:d=>{db=d;},getDB:()=>db,setUI:d=>{ui=d;},getUI:()=>ui};\n})();';
const nodes={},handlers={},storage={},messages=[];
const document={
 getElementById(id){return nodes[id]||null},
 querySelectorAll(selector){return selector==='[data-action="sales-zone-filter"]'?nodes.__tabs||[]:[]},
 querySelector(){return null},
 addEventListener(type,callback){handlers[type]=callback},
 createElement(){return {className:'',textContent:'',remove(){},append(){}}}
};
const window={confirm(){return true},scrollTo(){}};
class FakeFormData{constructor(element){this.data=element.data||{}}entries(){return Object.entries(this.data)}}
const ctx={document,window,localStorage:{getItem:key=>storage[key]||null,setItem:(key,data)=>{storage[key]=data}},
 FormData:FakeFormData,Date,Intl,Number,Math,String,Array,Object,JSON,RegExp,Map,Set,URL,Blob,setTimeout(){},console};
nodes.toasts={append:n=>messages.push(n.textContent)};
nodes['app-view']={innerHTML:''};nodes.breadcrumb={textContent:''};nodes.sidebar={classList:{remove(){}}};nodes.year={textContent:''};nodes['current-date']={textContent:''};
vm.createContext(ctx);vm.runInContext(exposed,ctx,{timeout:5000});
const t=window.__v27;
let fails=0;
function test(title,run){try{run();console.log('PASS',title)}catch(error){fails++;console.error('FAIL',title,error.stack||error)}}
function fixture(){
 const db=t.defaults();
 db.products=[
  {id:'p1',name:'Agua 1 litro',category:'bebidas',price:1,barcode:'B-AGUA',stockNevera:12,stockBodega:20,stock:32},
  {id:'p2',name:'Helado de fresa',category:'helados',price:1.5,stockNevera:null,stockBodega:null,stock:null},
  {id:'p3',name:'Cepillo',category:'aseo',price:1.5,stockNevera:2,stockBodega:0,stock:2},
  {id:'p4',name:'Galleta dulce',category:'confiteria',price:.75,stockNevera:0,stockBodega:0,stock:0},
  {id:'p5',name:'Powerade mora azul',category:'bebidas',price:1.5,zone:'vitrina',stockNevera:4,stockBodega:0,stock:4},
  {id:'p6',name:'Bodega especial',category:'otros',price:null,zone:'bodega',stockNevera:null,stockBodega:5,stock:null}
 ];
 t.setDB(db);t.setUI({...t.getUI(),view:'varios',productZone:'todas',productCategory:'todas',productSearch:''});
 for(const key of ['products-form','new-product-form','sales-catalog-grid','sales-catalog-result-count','__tabs'])delete nodes[key];
 messages.length=0;return db;
}
test('Catálogo rediseñado: encabezado compacto, zonas, buscador y tarjetas debajo ocupando ancho completo',()=>{
 fixture();const html=t.renderExtras();
 const panel=html.indexOf('sales-catalog-panel'),zones=html.indexOf('sales-zone-filters'),grid=html.indexOf('id="sales-catalog-grid"'),forms=html.indexOf('id="extra-form"');
 assert(panel>=0&&zones>panel&&grid>zones&&forms>grid);
 assert(html.includes('sales-catalog-header'));assert(html.includes('sales-catalog-search'));
 assert(!html.slice(panel,grid).includes('class="two-col"'));
 assert(styles.includes('.product-catalog-grid.sales-catalog-cards'));
 assert(styles.includes('repeat(auto-fill,minmax('));
 assert(styles.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
});
test('Se muestran filtros Todos, Vitrina, Nevera, Nevera helados y Bodega',()=>{
 fixture();const html=t.renderExtras();
 for(const zone of ['todas','vitrina','nevera','nevera_helados','bodega'])
   assert(html.includes('data-action="sales-zone-filter" data-id="'+zone+'"'));
 assert(html.includes('aria-pressed="true"'));
});
test('Zonas sin asignar se sugieren por categoría sin escribirlas en la base',()=>{
 const db=fixture();
 assert.equal(t.productSalesZone(db.products[0]).id,'nevera');
 assert.equal(t.productSalesZone(db.products[1]).id,'nevera_helados');
 assert.equal(t.productSalesZone(db.products[2]).id,'vitrina');
 assert.equal(t.productSalesZone(db.products[4]).id,'vitrina');
 assert.equal(t.productSalesZone(db.products[0]).confirmed,false);
 assert.equal(db.products[0].zone,undefined);
 assert(t.renderSalesCatalogCards([db.products[0]]).includes('Nevera · sugerida'));
});
test('Bodega aparece por asignación explícita o conteo físico, sin inventar existencias',()=>{
 const db=fixture();const filtered=t.salesFilteredProducts('bodega');
 assert(filtered.some(p=>p.id==='p1'));
 assert(filtered.some(p=>p.id==='p6'));
 assert(!filtered.some(p=>p.id==='p2'));
 assert.equal(t.locationStock(db.products[1],'bodega'),null);
 const card=t.renderSalesCatalogCards([db.products[5]]);
 assert(card.includes('Precio por definir'));
 assert(card.includes('disabled'));
});
test('Filtros de zona + categoría + búsqueda por código funcionan conjuntamente',()=>{
 fixture();
 assert.equal(t.salesFilteredProducts('nevera','bebidas','agua').length,1);
 assert.equal(t.salesFilteredProducts('nevera','bebidas','B-AGUA').length,1);
 assert.equal(t.salesFilteredProducts('nevera_helados').length,1);
 assert.equal(t.salesFilteredProducts('vitrina','aseo').length,1);
 assert.equal(t.salesFilteredProducts('vitrina','bebidas').length,1);
 assert.equal(t.salesFilteredProducts('todas','todas','sin coincidencia').length,0);
});
test('Cambiar zona actualiza solo el catálogo, sin reiniciar el formulario de venta',()=>{
 fixture();const cards={innerHTML:''},counter={textContent:''};
 nodes['sales-catalog-grid']=cards;nodes['sales-catalog-result-count']=counter;
 const button=(id)=>({dataset:{id},pressed:'',classList:{toggle(){ }},setAttribute(k,v){if(k==='aria-pressed')this.pressed=v}});
 nodes.__tabs=[button('todas'),button('nevera'),button('vitrina')];
 t.setUI({...t.getUI(),productZone:'vitrina'});
 t.updateSalesCatalog();
 assert(cards.innerHTML.includes('Cepillo'));
 assert(!cards.innerHTML.includes('Agua 1 litro'));
 assert(counter.textContent.startsWith('3 de 6'));
 assert.equal(nodes.__tabs[2].pressed,'true');
});
test('Tarifas y ajustes contiene selector de zona por producto, sin alterar tarifas o códigos',()=>{
 const db=fixture(),html=t.renderSettings();
 assert(html.includes('name="zone-p1"'));
 assert(html.includes('name="zone-p3"'));
 assert(html.includes('Zona sugerida (sin confirmar)'));
 assert(html.includes('Guardar precios, códigos y zonas'));
 const form={};for(const p of db.products){form['product-'+p.id]=String(p.price??'');form['barcode-'+p.id]=p.barcode||'';form['zone-'+p.id]=p.zone||'';}
 form['zone-p1']='vitrina';form['zone-p3']='nevera_helados';
 nodes['products-form']={data:form};
 t.processProducts();
 assert.equal(db.products[0].zone,'vitrina');
 assert.equal(db.products[2].zone,'nevera_helados');
 assert.equal(db.products[0].stockNevera,12);
 assert.equal(db.products[0].stockBodega,20);
 assert.equal(db.products[0].price,1);
 assert.equal(db.products[0].barcode,'B-AGUA');
 assert.equal(t.salesFilteredProducts('vitrina','bebidas').length,2);
});
test('Si se intenta asignar zona inventada el guardado se rechaza',()=>{
 const db=fixture(),form={};
 for(const p of db.products){form['product-'+p.id]=String(p.price??'');form['barcode-'+p.id]=p.barcode||'';form['zone-'+p.id]=p.zone||'';}
 form['zone-p1']='zona-secreta';
 nodes['products-form']={data:form};
 t.processProducts();
 assert.equal(db.products[0].zone,undefined);
 assert(messages.some(m=>m.includes('Revise la zona')));
});
test('Nuevo producto puede guardar una zona específica sin registrar stock ficticio',()=>{
 const db=fixture();nodes['new-product-form']={data:{name:'Producto prueba zona',category:'confiteria',price:'1.25',barcode:'NUEVO-TEST',zone:'vitrina'}};
 t.processNewProduct();
 const p=db.products.find(p=>p.name==='Producto prueba zona');
 assert(p);assert.equal(p.zone,'vitrina');assert.equal(p.stock,null);
});
test('Siguen operativas las tarjetas de venta y se bloquea producto sin precio/nevera agotada',()=>{
 const db=fixture();
 const html=t.renderSalesCatalogCards(db.products);
 assert(html.includes('data-action="pick-product" data-id="p1"'));
 assert(html.includes('data-action="pick-product" data-id="p6"'));
 assert(html.includes('Sin existencias en Nevera'));
 assert(html.includes('Configure primero el precio en Tarifas y ajustes'));
});
if(fails)process.exitCode=1;
