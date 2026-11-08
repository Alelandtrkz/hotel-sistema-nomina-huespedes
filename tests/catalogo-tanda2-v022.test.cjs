'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const first=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalogo/primera-tanda-fotos-2026-11-08.json'),'utf8'));
const second=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalogo/segunda-tanda-fotos-2026-11-08.json'),'utf8'));
const gtin13=c=>{
 if(!/^\d{13}$/.test(c))return false;
 const check=(10-[...c.slice(0,12)].reduce((sum,d,i)=>sum+Number(d)*(i%2===0?1:3),0)%10)%10;
 return check===Number(c[12]);
};
assert.equal(first.products.length,10,'Primera tanda debe conservar 10 productos');
assert.equal(second.products.length,10,'Segunda tanda requiere 10 productos');
const all=[...first.products,...second.products],codes=all.map(p=>p.barcode).filter(Boolean);
assert.equal(codes.length,18,'18 códigos legibles entre ambas tandas');
assert.equal(new Set(codes).size,codes.length,'No deben existir códigos duplicados');
assert.equal(new Set(all.map(p=>p.id)).size,all.length,'No deben existir IDs duplicados');
assert(second.products.every(p=>p.identityConfirmed&&gtin13(p.barcode)), 'Los 10 nuevos EAN-13 deben validarse');
assert(second.products.every(p=>p.price===null&&p.stock===null&&p.stockNevera===null&&p.stockBodega===null),'No asignar cantidades/precios no confirmados');
assert(second.products.every(p=>p.category==='bebidas'&&p.verificationSource.startsWith('https://')),'Cada ficha debe conservar fuente de verificación');
const expected=[
 ['7861030502017','Imperial Limonada con gas 550 ml'],
 ['7861030590328','Imperial Toronja 550 ml'],
 ['7702354945992','Saviloé Uva 320 ml'],
 ['7862109437582','Gatorade Manzana sin azúcar 500 ml'],
 ['7862127130502','Forestea Horchata 400 ml'],
 ['7862106704977','Vive 100 Mango 475 ml'],
 ['7861024626224','Sprite Lima Limón 300 ml'],
 ['7861024626255','Coca-Cola Original 300 ml'],
 ['7862109433294','Gatorade Frutas Tropicales 1 litro'],
 ['7862109433287','Gatorade Manzana 1 litro']
];
for(const [barcode,name] of expected){
 assert(second.products.some(p=>p.barcode===barcode&&p.name===name),'Ficha GTIN/name faltante: '+barcode);
}
console.log('PASS Segunda tanda: 10 códigos válidos; 20 fotos registradas, sin duplicados ni inventario ficticio.');
