# Hotel Unicornio — Integración Supabase (beta)

## Sitio
https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/

## Infraestructura
- Frontend HTML/CSS/JS en GitHub Pages.
- Supabase **hotel-unicornio**: `ttkhklboogpqvgsyjtwz`, PostgreSQL 17, plan gratuito.
- Los 1.448 huéspedes importados permanecen en `public.hotel_guests`, protegidos por RLS.
- Estado común de reservas, habitaciones, consumos, stock y caja almacenado en `public.hotel_cloud_state` (`data jsonb`), SIN duplicar datos maestros de huéspedes.
- `hotel_staff` indica quién puede operar. Solo el correo administrador verificado `hotelunicornio@hotmail.com` recibe acceso automático por trigger restringido.
- `hotel_save_cloud_state` es una función `SECURITY INVOKER` con comparación de revisiones (control de conflictos). No debe utilizarse este esquema como contabilidad de producción.

## Cómo activar el administrador (sin compartir contraseñas)
1. En el proyecto de Supabase, comprobar que **Confirm Email** está activo.
2. En Authentication → URL Configuration, agregar a la lista de redirección **https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/**. Si es posible, configurar también Site URL.
3. Abrir la aplicación. Pulsar **Crear acceso de administrador** y elegir una contraseña NUEVA, única, con al menos 12 caracteres. La contraseña débil mencionada por el usuario en el chat no se utiliza.
4. Confirmar la cuenta desde el correo del hotel y volver a iniciar sesión. Solo cuando la cuenta se verifica el trigger registra la membresía activa en `hotel_staff`.
5. Abrir otra ventana o dispositivo con la misma cuenta, realizar un cambio de demostración y comprobar que se sincroniza; se consulta el servidor cada 10 segundos o al volver a la pestaña.

## Advertencias
- Ningún visitante no autorizado puede consultar los registros, incluso aunque conozca la URL y la clave pública.
- **Nunca** publicar en GitHub claves secretas (`service_role`), contraseñas o dumps de clientes.
- La arquitectura usa un documento JSONB para coordinar los módulos mientras se prototipa. Evita sobrescrituras silenciosas mediante revisión, pero no ofrece todavía las transacciones atómicas de inventario, cobros y reservas requeridas para producción.
- Un conflicto de versión **no se resuelve automáticamente**: se alerta y recarga para evitar un doble cobro o pérdida silenciosa.
- El navegador puede mostrar provisionalmente un éxito visual antes de finalizar la escritura; el indicador `Sincronizado` es la confirmación real. No usar para cobros reales.
- El almacenamiento `localStorage` de datos empresariales fue sustituido por acceso a Supabase dentro de la versión autenticada; el cliente Supabase conserva solo su sesión.
- Los antiguos registros de prueba guardados localmente en versiones anteriores no se suben a la nube automáticamente.
- Para producción: validación de reservas simultáneas y stock transaccional, auditoría de modificaciones, MFA para administrador, copias de seguridad automáticas y política de retención conforme a Ecuador.
- El servicio de correo de confirmación gratuito de Supabase puede imponer límites de envío; configurar SMTP propio antes de producción.

## Pruebas técnicas realizadas
- Verificadas 33 habitaciones, 71 productos y 1.448 huéspedes en Supabase.
- RLS activo y acceso de rol autenticado sin membresía denegado.
- El sitio está protegido antes de ejecutar `app.js`.
- Código JS compilado sintácticamente.
- Las pruebas completas de login, edición concurrente y actualización entre dos dispositivos requieren que el administrador real complete la confirmación por correo y realice una prueba en su navegador.

## Próxima iteración
Migrar los flujos de habitaciones, reservas, ventas y cobros desde JSONB a tablas relacionales con operaciones transaccionales y bitácora por recepcionista, sin mantener una clave de administrador compartida.
