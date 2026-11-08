/* Hotel Unicornio - Supabase cloud beta
   This file contains ONLY a public/publishable browser key. Never insert service_role or secrets.
   Staff-only access is enforced server-side by Supabase Auth + RLS.
*/
(function() {
  "use strict";
  var URL = "https://ttkhklboogpqvgsyjtwz.supabase.co";
  var KEY = "sb_publishable_AKMdIRr5NKkt0nhVdbfE6A_vOcOZ7u0";
  var ADMIN_EMAIL = "hotelunicornio@hotmail.com";
  var CLIENT = null, ready=false, booting=false, disabled=false;
  var revision = 0, baseGuests=new Map(), pending=null, writing=false, stale=false;
  var uiCallbacks = null, refreshTimer=null, uiLoaded=false, lastSavedAt=null;
  var ROOT = window.location.origin + window.location.pathname;
  // Capture the recovery token marker before Supabase processes the URL fragment.
  var recoveryMode=/(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash || "");
  var recoveryValidated=false;
  var cloudApp = {ready:false,data:null,save:scheduleSave,bindUI:bindUI,refresh:refresh};
  window.hotelCloud = cloudApp;
  var style = document.createElement("style");
  style.textContent = "html:not(.hotel-authorized) .app-shell{display:none!important}" +
    "#cloud-auth-gate{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f5f2;padding:24px;font-family:system-ui,sans-serif;color:#23352e}" +
    "#cloud-auth-gate.hidden{display:none!important}" +
    ".cloud-auth-card{background:white;border:1px solid #e1e7e1;border-radius:17px;max-width:450px;width:100%;padding:32px;box-shadow:0 10px 34px rgba(20,47,36,.08)}" +
    ".cloud-auth-card h1{font-family:Georgia,serif;font-size:26px;margin:10px 0;color:#263e35}" +
    ".cloud-auth-card .cloud-symbol{font-family:Georgia,serif;font-size:30px;font-weight:bold;color:#315447}" +
    ".cloud-auth-card p{color:#66736c;font-size:14px;line-height:1.6}" +
    ".cloud-auth-card label{display:block;font-size:13px;font-weight:600;margin-top:17px}" +
    ".cloud-auth-card input{display:block;width:100%;box-sizing:border-box;background:white;border:1px solid #cdd8d0;border-radius:8px;padding:13px;margin-top:6px;color:#23352e;font-size:16px}" +
    ".cloud-auth-card button{border:0;border-radius:9px;background:#294d3e;color:white;padding:12px 16px;font-weight:600;cursor:pointer;margin-top:18px;width:100%;font-size:14px}" +
    ".cloud-auth-card button.secondary{background:#edf2ef;color:#294d3e;border:1px solid #d8e1da;margin-top:10px}" +
    ".cloud-auth-card button:disabled{opacity:.65;cursor:wait}" +
    ".cloud-auth-msg{font-size:13px;margin-top:14px;line-height:1.5;white-space:pre-line;min-height:16px;color:#994e2b}" +
    ".cloud-auth-foot{font-size:12px!important;margin-top:21px;padding-top:15px;border-top:1px solid #edf1ed}" +
    ".cloud-sync-indicator{font-size:12px;color:#315447;white-space:nowrap;margin-right:12px}" +
    ".cloud-sync-indicator.error{color:#a7352d;font-weight:600}" +
    ".cloud-auth-card .protected{background:#f2f5f1;padding:12px;border-radius:10px;color:#475d4d;font-size:13px}" +
    "#cloud-auth-gate [hidden]{display:none!important}" +
    ".cloud-auth-card button.recovery-link{background:transparent;color:#265942;border:0;text-decoration:underline;margin-top:7px;padding:11px 8px;font-weight:650}" +
    ".cloud-auth-card button.recovery-link:hover{color:#173d2e}" +
    ".cloud-auth-card .recovery-hint{font-size:12px;margin:8px 0 16px;line-height:1.6;color:#5e7467}";
  document.head.appendChild(style);
  function $id(id){return document.getElementById(id);}
  function message(s, isOk) {
    var el=$id("cloud-message"); if(el){el.textContent=s||"";el.style.color=isOk?"#2a624b":"#a7352d";}
  }
  function status(s,isError) {
    var el=$id("cloud-status");if(el){el.textContent=s;el.classList.toggle("error",!!isError);}
  }
  function gate() {
    if($id("cloud-auth-gate"))return;
    var g=document.createElement("div");g.id="cloud-auth-gate";
    g.innerHTML='<section class="cloud-auth-card">' +
      '<div class="cloud-symbol">U.</div><h1>Hotel Unicornio</h1>' +
      '<p>Sistema de recepción conectado a Supabase. Acceso únicamente autorizado.</p>' +
      '<div class="protected">Administrador: <strong>hotelunicornio@hotmail.com</strong>. Utilice la contraseña actual de la cuenta, no la clave provisional del proyecto.</div>' +
      '<form id="cloud-auth-form">' +
      '<label for="cloud-email">Correo de acceso</label>' +
      '<input id="cloud-email" type="email" autocomplete="username" readonly value="hotelunicornio@hotmail.com">' +
      '<label for="cloud-password">Contraseña</label>' +
      '<input id="cloud-password" type="password" autocomplete="current-password" required placeholder="Contraseña actual">' +
      '<button id="cloud-login" type="submit">Iniciar sesión</button>' +
      '</form>' +
      '<button class="recovery-link" id="cloud-forgot" type="button">¿Olvidaste tu contraseña? Recuperar acceso</button>' +
      '<form id="cloud-recovery-form" hidden>' +
      '<p class="recovery-hint">Enlace de recuperación verificado. Establezca una contraseña NUEVA y única, con un mínimo de 12 caracteres. No comparta su contraseña por chat.</p>' +
      '<label for="cloud-new-password">Nueva contraseña</label>' +
      '<input id="cloud-new-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required placeholder="Mínimo 12 caracteres">' +
      '<label for="cloud-confirm-password">Confirmar nueva contraseña</label>' +
      '<input id="cloud-confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required placeholder="Repita la nueva contraseña">' +
      '<button id="cloud-recovery-submit" type="submit">Guardar nueva contraseña</button>' +
      '<button id="cloud-recovery-cancel" type="button" class="secondary">Volver a iniciar sesión</button>' +
      '</form>' +
      '<div class="cloud-auth-msg" id="cloud-message" role="status" aria-live="polite"></div>' +
      '<p class="cloud-auth-foot" id="cloud-auth-foot">¿Cambiaste de dispositivo? La cuenta es la misma en ambos. Si la contraseña guardada por el navegador no funciona, solicite un enlace nuevo al correo del hotel. Los datos de huéspedes no se borrarán.</p>' +
      '</section>';
    document.body.prepend(g);
    $id("cloud-auth-form").addEventListener("submit",login);
    $id("cloud-forgot").addEventListener("click",requestRecovery);
    $id("cloud-recovery-form").addEventListener("submit",finishRecovery);
    $id("cloud-recovery-cancel").addEventListener("click",function(){window.location.assign(ROOT);});
    if(recoveryMode){
      showRecoveryForm();
      message("Comprobando el enlace de recuperación...",true);
    }
  }
  function showRecoveryForm() {
    var a=$id("cloud-auth-form"),b=$id("cloud-forgot"),c=$id("cloud-recovery-form");
    if(a)a.hidden=true;if(b)b.hidden=true;if(c)c.hidden=false;
  }
  function showLoginForm() {
    var a=$id("cloud-auth-form"),b=$id("cloud-forgot"),c=$id("cloud-recovery-form");
    if(a)a.hidden=false;if(b)b.hidden=false;if(c)c.hidden=true;
  }
  function setBusy(b) {
    ["cloud-login","cloud-forgot","cloud-recovery-submit","cloud-recovery-cancel"].forEach(function(id){
      var el=$id(id);if(el)el.disabled=!!b;
    });
  }
  function strongPassword(password) {
    return typeof password==="string" && password.length>=12 && password.length<=128 &&
      !["admin","123456789012","password1234","administrador","hotelunicornio"].some(function(v){return password.toLowerCase()===v;});
  }
  async function login(e) {
    e.preventDefault();message("");setBusy(true);
    try {
      var password=$id("cloud-password").value;
      var result=await CLIENT.auth.signInWithPassword({email:ADMIN_EMAIL,password:password});
      if(result.error)throw result.error;
      $id("cloud-password").value="";
      await boot();
    }catch(err){
      var code=String(err.code||"").toLowerCase(),txt=String(err.message||"");
      if(code==="invalid_credentials"||/invalid login credentials/i.test(txt)) {
        message("Correo o contraseña incorrectos. La cuenta de administrador está registrada. Escriba la clave actual manualmente o pulse «Recuperar acceso» para establecer una nueva.");
      } else message("No se pudo iniciar sesión: "+txt);
    }finally{setBusy(false);}
  }
  async function requestRecovery() {
    message("");setBusy(true);
    try {
      var result=await CLIENT.auth.resetPasswordForEmail(ADMIN_EMAIL,{redirectTo:ROOT});
      if(result.error)throw result.error;
      $id("cloud-password").value="";
      message("Solicitud enviada al correo del Hotel Unicornio. Revise la bandeja de entrada y correo no deseado; abra el enlace MÁS RECIENTE en el dispositivo donde quiera acceder. El enlace puede caducar y el servicio gratuito limita los envíos. No cree otra cuenta.",true);
    }catch(err){
      message("No se pudo solicitar la recuperación: "+(err.message||String(err))+". Si hay un límite de correos, espere antes de solicitar otro.");
    }finally{setBusy(false);}
  }
  async function finishRecovery(e) {
    e.preventDefault();message("");
    if(!recoveryValidated){
      message("El enlace no se ha validado. Ábralo directamente desde el correo del hotel. Si caducó, solicite uno nuevo.");return;
    }
    var password=$id("cloud-new-password").value,confirm=$id("cloud-confirm-password").value;
    if(!strongPassword(password)){
      message("Establezca una contraseña NUEVA de 12 a 128 caracteres. No utilice «admin» ni claves predecibles.");return;
    }
    if(password!==confirm){message("Las contraseñas no coinciden.");return;}
    setBusy(true);
    try {
      var session=await CLIENT.auth.getSession();
      if(session.error||!session.data?.session)throw new Error("El enlace de recuperación caducó. Solicite uno nuevo.");
      var result=await CLIENT.auth.updateUser({password:password});
      if(result.error)throw result.error;
      $id("cloud-new-password").value="";
      $id("cloud-confirm-password").value="";
      recoveryMode=false;recoveryValidated=false;
      if(window.history&&window.history.replaceState)window.history.replaceState(null,"",ROOT);
      showLoginForm();
      message("Contraseña actualizada. Validando el acceso de administrador...",true);
      await boot();
    }catch(err){
      message("No se pudo guardar la nueva contraseña: "+(err.message||String(err)));
    }finally{setBusy(false);}
  }
  function toLocalGuest(r) {
    return {
      id:r.id,documentType:r.document_type||"cedula",document:r.document||"",
      firstName:r.first_name||"",secondName:r.second_name||"",
      lastName:r.last_name||"",secondLastName:r.second_last_name||"",
      phone:r.phone||"",email:r.email||"",createdAt:r.created_at||"",
      provenance:r.provenance||""
    };
  }
  function toRemoteGuest(g) {
    return {
      id:g.id,document_type:g.documentType||"cedula",
      document:String(g.document||"").trim(),
      first_name:String(g.firstName||"").trim(),
      second_name:String(g.secondName||"").trim(),
      last_name:String(g.lastName||"").trim(),
      second_last_name:String(g.secondLastName||"").trim(),
      phone:String(g.phone||"").trim(),email:String(g.email||"").trim(),
      updated_at:new Date().toISOString()
    };
  }
  function guestSig(g) {
    return JSON.stringify([g.id,g.documentType||"cedula",g.document,g.firstName,g.secondName,g.lastName,g.secondLastName,g.phone,g.email]);
  }
  async function readGuests() {
    var records=[],page=0;
    for(;;){
      var res=await CLIENT.from("hotel_guests")
       .select("id,document_type,document,first_name,second_name,last_name,second_last_name,phone,email,provenance,created_at")
       .order("id",{ascending:true}).range(page*500,page*500+499);
      if(res.error)throw res.error;
      records=records.concat(res.data||[]);
      if(!res.data || res.data.length<500)break;
      page++;
      if(page>100)throw new Error("Exceso de páginas de huéspedes");
    }
    return records.map(toLocalGuest);
  }
  async function readState() {
    var res=await CLIENT.from("hotel_cloud_state")
      .select("revision,data,updated_at").eq("id","main").single();
    if(res.error)throw res.error;
    return res.data;
  }
  async function boot() {
    if(booting || ready || disabled)return;
    booting=true;
    try {
      message("Validando acceso...");
      var me=await CLIENT.auth.getUser();
      if(me.error||!me.data||!me.data.user){throw new Error("Debe iniciar sesión.");}
      if(String(me.data.user.email||"").toLowerCase()!==ADMIN_EMAIL ||
         !me.data.user.email_confirmed_at) {
        throw new Error("Correo administrador no verificado o no autorizado.");
      }
      var profile=await CLIENT.from("hotel_staff").select("role,active").eq("user_id",me.data.user.id).maybeSingle();
      if(profile.error)throw profile.error;
      if(!profile.data||!profile.data.active||profile.data.role!=="admin"){
        throw new Error("La cuenta no tiene autorización de administrador. Confirme primero su correo.");
      }
      var results=await Promise.all([readState(),readGuests()]);
      revision=Number(results[0].revision);
      var guests=results[1];
      baseGuests=new Map(guests.map(function(g){return [g.id,guestSig(g)];}));
      cloudApp.data=Object.assign({},results[0].data,{guests:guests});
      cloudApp.ready=true;ready=true;
      var g=$id("cloud-auth-gate");if(g)g.classList.add("hidden");
      document.documentElement.classList.add("hotel-authorized");
      var pill=document.querySelector(".demo-pill");if(pill)pill.textContent="SUPABASE · BETA";
      var notice=document.querySelector(".notice");
      if(notice)notice.innerHTML='<span class="notice-icon">!</span><span><strong>Pruebas con base central.</strong> Guardado y actualización compartidos. Evite operaciones reales hasta concluir las pruebas de sincronización, caja y reservas.</span>';
      var stat=document.querySelector(".sidebar-status");
      if(stat)stat.textContent="Base de datos central · Supabase";
      var foot=document.querySelector(".sidebar-footer p");
      if(foot)foot.textContent="Acceso exclusivo administrador";
      var actions=document.querySelector(".topbar-right");
      if(actions) {
        var badge=document.createElement("span");badge.id="cloud-status";
        badge.className="cloud-sync-indicator";badge.textContent="En línea";actions.prepend(badge);
        var exit=document.createElement("button");exit.type="button";exit.textContent="Salir";
        exit.className="btn btn-secondary";exit.style.padding="8px 10px";exit.style.fontSize="12px";
        exit.addEventListener("click",async function(){await CLIENT.auth.signOut();window.location.reload();});
        actions.appendChild(exit);
        var test=document.createElement("button");
        test.type="button";test.id="cloud-test";
        test.textContent="Probar nube";test.className="btn btn-secondary";
        test.style.padding="8px 10px";test.style.fontSize="12px";
        test.title="Comprueba lectura y escritura sin crear huéspedes, reservas ni cobros";
        test.addEventListener("click",runSyncDiagnostic);
        actions.appendChild(test);
      }
      if(!uiLoaded) {
        uiLoaded=true;
        var script=document.createElement("script");script.src="./app.js?v=0.16-buscador-reservas";
        script.onerror=function(){status("No se pudo cargar la aplicación",true);};
        document.body.appendChild(script);
      }
      window.addEventListener("focus",function(){refresh();});
      document.addEventListener("visibilitychange",function(){if(!document.hidden)refresh();});
      refreshTimer=setInterval(refresh,10000);
      status("Conectado · nube");
    }catch(err) {
      message("Acceso no disponible: "+(err.message||String(err)));
      if((await CLIENT.auth.getSession()).data.session) {
        await CLIENT.auth.signOut();
      }
    }finally{booting=false;}
  }
  // Round-trip diagnostic: writes only the same snapshot, increasing the version.
  // No customer profile, booking, stock movement or cash operation is created.
  async function runSyncDiagnostic() {
    var button=$id("cloud-test");
    if(!ready||disabled||writing||pending){
      window.alert("Todavía hay una sincronización pendiente. Vuelva a probar cuando diga Conectado.");
      return;
    }
    if(button)button.disabled=true;
    status("Probando nube...");
    try {
      var me=await CLIENT.auth.getUser();
      if(me.error||!me.data?.user)throw new Error("La sesión no está activa.");
      var current=await readState();
      var remoteRevision=Number(current.revision);
      if(remoteRevision!==revision) {
        status("Actualización pendiente",true);
        window.alert("Otro equipo actualizó los datos. Recargue esta página antes de realizar la prueba.");
        return;
      }
      var result=await CLIENT.rpc("hotel_save_cloud_state",{
        p_expected_revision:remoteRevision,
        p_data:current.data
      });
      if(result.error)throw result.error;
      var after=await readState();
      if(Number(after.revision)!==Number(result.data) || Number(result.data)!==remoteRevision+1) {
        throw new Error("La lectura de verificación no coincide con el guardado.");
      }
      revision=Number(result.data);
      status("Prueba de sincronización OK");
      window.alert("Prueba completada: lectura, escritura y relectura de Supabase correctas. Revisión "+remoteRevision+" → "+revision+". No se añadieron huéspedes, reservas ni movimientos económicos. En otro dispositivo abierto, la revisión se detectará al actualizar los datos.");
    } catch(err) {
      status("Error de sincronización",true);
      window.alert("La prueba no se completó. "+(err.message||String(err))+". Informe este mensaje para corregir la conexión.");
    } finally {
      if(button)button.disabled=false;
    }
  }
  function bindUI(callbacks){uiCallbacks=callbacks;}
  function plainState(data){
    var copy=Object.assign({},data);
    delete copy.guests;
    return copy;
  }
  function snapshot(data) {
    return JSON.parse(JSON.stringify({
      guests:data.guests||[],
      state:plainState(data)
    }));
  }
  function scheduleSave(db) {
    if(!ready||disabled){status("No hay sesión activa. No se guardó.",true);return Promise.reject(new Error("No autorizado"));}
    pending=snapshot(db);
    status("Sincronizando...");
    if(!writing)saveLoop();
    return Promise.resolve();
  }
  async function saveLoop() {
    writing=true;
    while(pending){
      var next=pending;pending=null;
      try {
        // Save guest records separately; never copy them to the shared JSON payload.
        var changed=next.guests.filter(function(g){return baseGuests.get(g.id)!==guestSig(g);});
        if(changed.length){
          var payload=changed.map(toRemoteGuest);
          var rr=await CLIENT.from("hotel_guests").upsert(payload,{onConflict:"id"}).select("id");
          if(rr.error)throw rr.error;
          changed.forEach(function(g){baseGuests.set(g.id,guestSig(g));});
        }
        var result=await CLIENT.rpc("hotel_save_cloud_state",{
          p_expected_revision:revision,p_data:next.state
        });
        if(result.error)throw result.error;
        revision=Number(result.data);
        lastSavedAt=new Date();
        status("Sincronizado "+lastSavedAt.toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"}));
      } catch(err) {
        disabled=true;pending=null;
        status("Error de sincronización",true);
        var reason=err.message||String(err);
        if(reason.includes("CONFLICTO_VERSION")) {
          alert("Hay cambios realizados desde otro dispositivo. Este cambio NO se guardó para evitar sobrescribir registros. La página se recargará para mostrar los datos de la nube.");
          window.location.reload();
        }else{
          alert("No se pudo guardar en Supabase: "+reason+". No continúe registrando operaciones. Revise la conexión y recargue la página.");
        }
        break;
      }
    }
    writing=false;
  }
  async function refresh() {
    if(!ready||writing||pending||disabled||!uiCallbacks||document.hidden)return;
    try{
      var state=await readState();
      if(Number(state.revision)===revision)return;
      var allGuests=await readGuests();
      revision=Number(state.revision);
      baseGuests=new Map(allGuests.map(function(g){return [g.id,guestSig(g)];}));
      uiCallbacks.replace(Object.assign({},state.data,{guests:allGuests}));
      status("Actualizado desde otro equipo");
    }catch(err){
      status("Sin conexión · reintentar",true);
    }
  }
  function init() {
    gate();
    if(!window.supabase || !window.supabase.createClient) {
      message("No fue posible cargar Supabase. Compruebe su conexión y actualice esta página.");
      return;
    }
    CLIENT=window.supabase.createClient(URL,KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    CLIENT.auth.onAuthStateChange(function(event) {
      if(event==="PASSWORD_RECOVERY"){
        recoveryMode=true;recoveryValidated=true;
        showRecoveryForm();
        message("El enlace se verificó correctamente. Escriba y confirme la contraseña nueva.",true);
        return;
      }
      if(event==="SIGNED_OUT" && !recoveryMode){ready=false;window.location.reload();return;}
      if(event==="SIGNED_IN" && !recoveryMode && !ready && !booting)setTimeout(boot,0);
    });
    CLIENT.auth.getSession().then(function(res){
      if(recoveryMode){
        if(!res.data?.session){
          recoveryMode=false;recoveryValidated=false;
          showLoginForm();
          message("El enlace de recuperación no es válido o ha caducado. Solicite uno nuevo desde «Recuperar acceso».");
        } else if(!recoveryValidated){
          message("Validando enlace de recuperación. Si no se activa el formulario, abra nuevamente el último correo.",true);
        }
        return;
      }
      if(res.data&&res.data.session)boot();
      else message("Inicie sesión con su contraseña actual. Si no la recuerda, use «Recuperar acceso».",true);
    }).catch(function(err){message(err.message||String(err));});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();