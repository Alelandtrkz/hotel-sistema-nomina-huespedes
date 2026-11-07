# HOTEL UNICORNIO — Sistema de nómina de huéspedes

Versión **0.1 (prototipo demostrativo, preparado para GitHub Pages)**. Aplicación web estática, en español, diseñada para la recepción del Hotel Unicornio, Puerto Francisco de Orellana (El Coca), Ecuador.

> **IMPORTANTE: NO INGRESE DATOS REALES DE HUÉSPEDES.** Este prototipo no tiene base de datos central, autenticación, permisos, cifrado de datos en reposo, copias de seguridad, controles de acceso ni facturación electrónica. Los registros se guardan mediante `localStorage`, exclusivamente en el navegador del dispositivo que los creó. No es apto para operar con cédulas y datos de clientes reales.

## Qué funciona en esta versión

- **Panel general:** ocupación, habitaciones disponibles, habitaciones pendientes de limpieza, reservas con llegada hoy y lista de alojados.
- **Habitaciones:** mapa en verde (disponible), rojo (ocupada) y amarillo (pendiente de limpieza). Permite marcar una habitación como pendiente de limpieza, limpiarla, seleccionarla y registrar un ingreso.
- **Huéspedes:** búsqueda por número de cédula dentro de los registros locales de demostración. Si no existe, muestra “Usuario no registrado”. Permite crear o actualizar ficha con primer nombre, segundo nombre, apellidos, cédula, teléfono y correo.
- **Ingresos:** selección de fechas, tipo y número de habitación, desayuno, importe, pago en efectivo o por transferencia (referencia bancaria obligatoria cuando se registra una transferencia), solicitudes de factura y observaciones. Calcula noches, anticipos y saldo.
- **Reservas:** llegada, salida, titular, contacto, tipo de habitación, desayuno, anticipo y asignación de habitación opcional. Detecta solapamientos por habitación asignada y permite convertir una reserva en ingreso.
- **Salidas y cobros:** consulta de cargos por hospedaje y productos, cobro de saldos, check-out e historial de salidas. Una habitación pasa a amarillo al registrar salida.
- **Varios:** catálogo editable de productos, consumos cargados a huéspedes alojados e historial de ventas.
- **Tarifas y ajustes:** precios editables por tipo de habitación, campos sin definir para niños/personas adicionales, precios de varios, alta, edición y eliminación controlada de habitaciones.
- **Nómina CSV:** exporta el listado local de reservas y hospedajes sin la cédula del huésped.
- **Persistencia local:** los datos ficticios permanecen en el navegador tras recargar la página (si `localStorage` está habilitado).

## Tarifas iniciales de referencia

Tarifas por **habitación y noche** con aire acondicionado:

| Habitación | Sin desayuno | Con desayuno |
|---|---:|---:|
| Individual | USD 20,00 | USD 25,00 |
| Matrimonial | USD 29,00 | USD 39,00 |
| Doble | USD 30,00 | USD 45,00 |
| Triple | USD 40,00 | USD 55,00 |

Las tarifas complementarias de **niños** y **personas adicionales** están sin definir y no se cobran automáticamente. El inventario inicial `101–112` es únicamente de ejemplo: **NO representa el número real de habitaciones del hotel**. Los precios de agua, colas, snacks y otros artículos comienzan sin valor definido; deben configurarse.

Tarifas especiales de empresas o grupos, lavado de ropa y alimentación negociada en proformas anteriores **no constituyen un tarifario general** y no se agregan automáticamente a las cuentas de huéspedes.

## Cómo probarlo en su computadora

1. Descargue y descomprima el proyecto.
2. Abra `index.html` en Chrome, Edge o Firefox; alternativamente sirva la carpeta con `python -m http.server 8000`.
3. Use solamente nombres, cédulas y teléfonos ficticios. Para probar la búsqueda, primero cree un huésped de demostración y luego búsquelo por la misma cédula.
4. Cree una reserva, registre su ingreso, agregue un producto configurado y registre su salida.
5. Use **Tarifas y ajustes → Restablecer demo** para borrar la información ficticia guardada en ese navegador.

## Cómo publicar en GitHub Pages

El repositorio solicitado se llama `hotel-sistema-nomina-huespedes` y debe crearse **público** en la cuenta `Alelandtrkz`.

La carpeta `.github/workflows/pages.yml` incluye el workflow oficial para desplegar el sitio con GitHub Actions en cada cambio de la rama `main`. La conexión de GitHub usada para preparar el proyecto **no permite crear repositorios nuevos ni configurar GitHub Pages**, por lo que el ZIP es un paquete listo para subir, **no un sitio ya publicado**.

Para activar desde un celular:

1. Abrir <https://github.com/new> desde el navegador del teléfono, iniciar sesión, escribir `hotel-sistema-nomina-huespedes`, elegir **Public** y pulsar **Create repository**. El usuario no necesita una computadora.
2. Subir el contenido de esta carpeta a la raíz de `main`. Si se dispone de una integración con permisos de escritura, se pueden cargar los archivos mediante la integración después de crear el repositorio vacío.
3. En **Settings → Pages**, elegir **Source: GitHub Actions**. Es un paso de administración indispensable que debe realizar el propietario o una integración con permisos de administración adecuados.
4. En **Actions**, ejecutar el workflow **Publicar demo del Hotel Unicornio** si no se activó automáticamente. Una vez terminado correctamente, estará disponible en <https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/>.

El workflow no puede activar Pages por sí solo con el token normal `GITHUB_TOKEN`: configurar Pages por primera vez requiere permisos adicionales. Si prefiere no usar Actions, también puede publicar mediante **Settings → Pages → Deploy from a branch → main → /(root)**; en ese caso el archivo de workflow es opcional.

No es necesario instalar Node.js, ejecutar `npm install` ni compilar nada. GitHub Pages solo entrega HTML, CSS y JavaScript: **no ejecuta una base de datos ni un servidor privado**. Nunca suba cédulas reales, claves, contraseñas, tokens ni datos privados al repositorio.

## Limitaciones importantes

1. El registro de cédula **solo revisa el formato de 10 dígitos**, no comprueba que una persona exista o que la cédula le pertenezca.
2. La búsqueda de huéspedes solo consulta los registros del navegador local, no el SRI ni el Registro Civil.
3. La consulta pública del SRI sirve principalmente para información de contribuyentes inscritos en el RUC; no permite presumir un acceso libre a nombres, celulares y correos privados de todas las personas por cédula. Cualquier integración debe contar con autorización y una base jurídica válida.
4. Una reserva sin habitación asignada **no bloquea inventario**. Esta versión gestiona **una habitación por reserva**, no cupos de grupos múltiples en una sola operación.
5. La factura se marca como **solicitada**; no se emite comprobante electrónico ni se comunica al SRI.
6. Los importes utilizan el tarifario registrado. No agrega ni desglosa impuestos automáticamente, dado que deben definirse las reglas tributarias vigentes y su tratamiento por tarifa.
7. Una salida con saldo pendiente es posible con confirmación explícita, y la deuda sigue visible en historial. Aún no hay cuenta corriente administrativa ni roles de auditoría.
8. Cerrar el navegador o borrar sus datos puede eliminar los registros locales. Ningún segundo dispositivo verá la información de este navegador.

## Segunda etapa: arquitectura recomendada para producción

Mantener este frontend estático o migrarlo a un framework, conectado a un **backend privado** con autenticación de recepcionistas, roles, sesiones seguras, registro de auditoría y API. Para almacenamiento central utilizar PostgreSQL o un servicio equivalente con respaldo, controles de acceso y cifrado.

Modelo de datos sugerido:

- `guests`: `id`, tipo y número de documento, nombres, apellidos, teléfono, correo, fechas de creación y actualización.
- `rooms`: `id`, número, tipo, estado y fecha de última limpieza.
- `reservations`: titular/huésped, llegada, salida, habitación opcional, estado, anticipo y observaciones.
- `stays`: huésped, habitación, fechas, tarifa congelada al ingreso, estado y check-out.
- `payments`: estadía/reserva, valor, método (efectivo/transferencia), referencia y momento del cobro.
- `products` y `consumption_items`: inventario de varios y ventas vinculadas a estadías.
- `invoice_requests`: datos de facturación; posterior integración con software de facturación autorizado.
- `users` y `audit_logs`: recepcionistas, permisos e historial de acciones.

Posibles endpoints (contrato futuro): `GET /api/guests?document=...`, `POST /api/guests`, `POST /api/reservations`, `POST /api/checkins`, `POST /api/payments`, `POST /api/consumptions`, `POST /api/checkouts`, `PATCH /api/rooms/:id/status`.

El backend debe verificar la legitimidad del tratamiento de datos, implementar autenticación y autorización, política de privacidad y retención de datos, protección contra acceso no autorizado, gestión de incidencias y cumplimiento de la **Ley Orgánica de Protección de Datos Personales (Ecuador)**.

## Información del hotel de referencia

- Dirección: Av. 9 de Octubre y Miguel Gamboa, Puerto Francisco de Orellana, El Coca, Ecuador.
- Check-in desde las 12:00; check-out hasta las 14:00.
- Reserva: anticipo del 50%; devolución con aviso de al menos 24 horas; no-show sin devolución del anticipo.
- Medios de pago registrados: efectivo y transferencia.
- Suite no ofertada al público por ahora.

**Versión:** `0.1.0-demo` — lista para revisión visual y funcional, no lista para operaciones reales.