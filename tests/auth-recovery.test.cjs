'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.resolve(__dirname,'../cloud.js'),'utf8');
assert(!src.includes('auth.signUp('),'No debe ofrecer alta duplicada del administrador');
assert(src.includes('auth.resetPasswordForEmail('),'Falta enviar enlace de recuperación');
assert(src.includes('auth.updateUser('),'Falta completar el cambio de contraseña');
const el={},events={},called={signIns:0,resets:0,updates:0},root='https://example.github.io/hotel-sistema-nomina-huespedes/';
let authCallback=null,session=null,invalid=true,storedNewPassword=null,linkParams=null;
function make(id){
  return el[id]||(el[id]={id,hidden:false,value:'',disabled:false,textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(name,cb){this.listeners=this.listeners||{};this.listeners[name]=cb;},append(){},prepend(){}});
}
const doc={
  readyState:'loading',head:{appendChild(){}},body:{
    prepend(node){el[node.id]=node;for(const m of node.innerHTML.matchAll(/id="([^"]+)"/g))make(m[1]);if(node.innerHTML.includes('id="cloud-recovery-form" hidden'))make('cloud-recovery-form').hidden=true;},
    appendChild(){}
  },
  documentElement:{classList:{add(){}}},
  createElement(tag){return {tagName:tag,innerHTML:'',textContent:'',style:{},classList:{toggle(){}},append(){},
    addEventListener(){},setAttribute(){}};},
  getElementById(id){return el[id]||null;},
  querySelector(){return null;},
  addEventListener(name,cb){events[name]=cb;}
};
const stubAuth={
  onAuthStateChange(cb){authCallback=cb;return {data:{subscription:{unsubscribe(){}}}};},
  async getSession(){return {data:{session}};},
  async signInWithPassword(){called.signIns++;return invalid?{error:{code:'invalid_credentials',message:'Invalid login credentials'}}:
    {error:null,data:{session}};},
  async resetPasswordForEmail(email,options){called.resets++;linkParams={email,options};return {error:null};},
  async updateUser(data){called.updates++;storedNewPassword=data.password;return {data:{user:{id:'example'}},error:null};},
  async getUser(){return {data:{user:{id:'admin',email:'hotelunicornio@hotmail.com',email_confirmed_at:'2026-11-07T00:00:00Z'}},error:null};}
};
const stubClient={auth:stubAuth,from(name){
  if(name==='hotel_staff')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{role:'admin',active:true},error:null};}};
  if(name==='hotel_cloud_state')return {select(){return this;},eq(){return this;},async single(){return {data:{revision:0,data:{rooms:[],products:[],reservations:[],stays:[],extras:[]}},error:null};}};
  if(name==='hotel_guests')return {select(){return this;},order(){return this;},async range(){return {data:[],error:null};}};
  throw new Error('Unknown table '+name);
}};
const win={location:{origin:'https://example.github.io',pathname:'/hotel-sistema-nomina-huespedes/',hash:'',search:'',
  reload(){this.reloaded=true;},assign(url){this.assigned=url;}},history:{replaceState(_a,_b,url){this.current=url;}},
  supabase:{createClient(){return stubClient;}},addEventListener(){},hotelCloud:null};
const sandbox={document:doc,window:win,console,Date,Intl,Number,Math,Map,String,Object,JSON,RegExp,
  setTimeout(fn){fn();return 1;},setInterval(){return 1;},URL,alert(){}};
vm.createContext(sandbox);vm.runInContext(src,sandbox,{timeout:3000});
function test(name,fn){return Promise.resolve().then(fn).then(()=>console.log('PASS',name),e=>{console.error('FAIL',name,e.stack||e);process.exitCode=1;});}
function submit(id){return el[id].listeners.submit({preventDefault(){}});}
function click(id){return el[id].listeners.click();}
function tick(){return new Promise(resolve=>setImmediate(resolve));}
(async function(){
 await test('La pantalla de acceso ofrece recuperación y no permite alta duplicada',async()=>{
   assert(events.DOMContentLoaded);events.DOMContentLoaded();await tick();
   assert(el['cloud-forgot']);assert(!el['cloud-register']);
   assert.equal(el['cloud-recovery-form'].hidden,true);
 });
 await test('La contraseña incorrecta produce orientación en español',async()=>{
   el['cloud-password'].value='clave-equivocada';
   await submit('cloud-auth-form');
   assert.equal(called.signIns,1);
   assert.match(el['cloud-message'].textContent,/Recuperar acceso/);
 });
 await test('Solicitar acceso envía correo al administrador y URL ya autorizada',async()=>{
   await click('cloud-forgot');
   assert.equal(called.resets,1);
   assert.equal(linkParams.email,'hotelunicornio@hotmail.com');
   assert.equal(linkParams.options.redirectTo,root);
   assert.match(el['cloud-message'].textContent,/Solicitud enviada/);
 });
 await test('El evento PASSWORD_RECOVERY habilita cambio de clave',async()=>{
   session={access_token:'test-token'};
   authCallback('PASSWORD_RECOVERY',session);
   assert.equal(el['cloud-auth-form'].hidden,true);
   assert.equal(el['cloud-recovery-form'].hidden,false);
 });
 await test('El formulario exige confirmar la contraseña',async()=>{
   el['cloud-new-password'].value='NuevaClaveSegura2026!';
   el['cloud-confirm-password'].value='OtraClaveSegura2026!';
   await submit('cloud-recovery-form');
   assert.equal(called.updates,0);
   assert.match(el['cloud-message'].textContent,/no coinciden/);
 });
 await test('El formulario rechaza la clave provisional e insegura',async()=>{
   el['cloud-new-password'].value='admin';
   el['cloud-confirm-password'].value='admin';
   await submit('cloud-recovery-form');
   assert.equal(called.updates,0);
 });
 await test('La clave nueva se guarda y abre sesión sin crear un usuario',async()=>{
   el['cloud-new-password'].value='NuevaClaveSegura2026!';
   el['cloud-confirm-password'].value='NuevaClaveSegura2026!';
   await submit('cloud-recovery-form');
   assert.equal(called.updates,1);
   assert.equal(storedNewPassword,'NuevaClaveSegura2026!');
   assert.equal(win.hotelCloud.ready,true);
   assert.equal(el['cloud-auth-gate'].classList!==undefined,true);
   assert.equal(win.history.current,root);
 });
 console.log('Pruebas con credenciales ficticias y servicios simulados; no se envían correos reales.');
})().catch(err=>{console.error(err);process.exitCode=1;});
