# Hotel Unicornio v0.31 — Corte de caja de prueba a las 23:00 y cargos a habitaciones arrendadas

**Horario experimental para pruebas (zona horaria America/Guayaquil):** turno **Día: 08:00 a 23:00** y **Noche: 23:00 a 08:00** del día siguiente. Entre 00:00 y 07:59, la jornada nocturna corresponde a la fecha del día anterior. La misma regla se utiliza en el identificador automático del turno de recepción, apertura de caja en Supabase y pantalla de arqueo. Las sesiones ya abiertas y los cierres anteriores no se modifican.

**Habitaciones arrendadas:** las habitaciones con tipo y estado \`arrendada\` ahora tienen una **cuenta de consumos pendientes** al pulsar su tarjeta en Habitaciones. Desde ahí se puede buscar o escanear un producto, indicar unidades, registrar un agua u otro artículo con precio, o agregar cargos manuales de lavandería y otros servicios. También aparecen como destino \`Arrendada · Hab. XX (a cuenta)\` en **Varios / ventas**. Cada cargo se registra en el historial de ventas con \`rentalRoomId\`, \`stayId\` vacío y método \`pendiente\`; se vincula al identificador de la habitación aunque cambie su numeración. **No se recibe efectivo al anotarlo** ni se agrega a caja hasta un cobro real.

Los cargos se incluyen en el saldo de la habitación arrendada y en el filtro de habitaciones por cobrar. Su tipo arrendado permanece fuera del inventario disponible y de las estadías de hospedaje. El inventario del producto se descuenta del stock conocido de Nevera usando las reglas existentes (sin inventar cantidades cuando no existe conteo). No se puede cambiar a otro tipo de habitación mientras queden cargos del arrendatario pendientes de conciliación.

**Limitación:** esta fase registra cargos pendientes de arrendatarios, pero **no implementa aún un proceso de cobro/abono específico para estas cuentas**. No marque como pagados consumos sin haber implementado la conciliación. Las habitaciones hoteleras con estadía activa y la venta directa conservan sus operaciones previas.

**Migración:** \`supabase/migrations/20261110_caja_hasta_2300_v031.sql\` (solo cambia la función \`hotel_cash_open\`). **Pruebas:** \`tests/cargos-habitaciones-arrendadas-v031.test.cjs\` y regresiones de turnos de caja.

---

# Hotel Unicornio v0.30 — Horarios de caja 08:00–20:00

**Horario vigente desde v0.30 (America/Guayaquil / El Coca):**
- **Día:** 08:00 inclusive hasta 20:00 exclusive.
- **Noche:** 20:00 inclusive hasta las 08:00 del día siguiente (exclusive). Entre 00:00 y 07:59 la jornada nocturna corresponde a la fecha del día anterior.
- El cálculo automático de turno en **recepción**, **cuentas**, **cobros** y **apertura/cierre de caja** utiliza los mismos límites horarios.
- En Supabase, la RPC `hotel_cash_open` asigna el mismo turno y fecha de jornada; la migración solo sustituye esa función, **sin cambiar sesiones activas, saldos ni cierres históricos**.
- **Sin cambios en la contabilidad del fondo de vuelto:** `efectivo esperado = fondo inicial + cobros en efectivo − vueltos entregados − gastos y retiros`. El fondo no es una venta.
- Cerrar caja sigue requiriendo el arqueo manual y la confirmación del fondo entregado. Una caja abierta que atraviesa las 20:00 deberá cerrarse antes de iniciar la nueva apertura nocturna.

Migración: `supabase/migrations/20261109_cash_shifts_0800_2000_v030.sql`. Pruebas de límites: `tests/cuenta-compacta-v019.test.cjs`, `tests/cuenta-persona-v020.test.cjs` y `tests/caja-apertura-handover-v029.test.cjs`.

---

# Hotel Unicornio v0.29 — Apertura, arqueo y cierre de caja con fondo de cambio

El módulo **Cierre de caja** pasa a administrar **una sesión de caja por turno**. Al no haber sesión activa, presenta **Abrir caja**: el encargado cuenta físicamente los **sueltos destinados a dar vuelto**, registra el importe y observaciones. El turno se asigna automáticamente según **America/Guayaquil**, de 07:30 a 19:30 (día) y de 19:30 a 07:30 (noche). Las horas posteriores a medianoche antes de las 07:30 pertenecen a la jornada nocturna del día anterior.

**Cierre:** el arqueo se realiza en modal. La fórmula correcta es:
`efectivo esperado = fondo inicial de cambio + efectivo recibido - vueltos entregados - gastos/retiros efectivos`.
Las transferencias no se suman al efectivo físico. Ejemplo: fondo $30 + efectivo $40 - vueltos $20 = **$50 esperado**. Si se cuentan $50 y quedan $25 para el siguiente turno, los $25 restantes son dinero a entregar a administración (no otra venta). El siguiente recepcionista deberá contar el fondo realmente recibido; una diferencia exige observación.

**Sin doble conteo:** los importes de apertura y traspaso no son ventas, ingresos del período ni gastos. El nuevo historial de sesiones se guarda por separado en `hotel_cash_sessions`, sin modificar los registros antiguos de `closures` dentro del estado compartido. Cada apertura/cierre queda inmutable para clientes: solo se puede abrir/cerrar mediante RPC transaccionales de Supabase. Un índice parcial impide cajas simultáneas y una restricción única impide abrir más de una vez el mismo turno. Las RPC validan al administrador, importes monetarios, estado y **revisión del estado compartido** para prevenir confirmaciones con datos obsoletos. La apertura y el cierre incrementan la revisión para forzar recarga en otros dispositivos.

**Cobros dentro de caja:** mientras no haya sesión de turno abierta se bloquean nuevas recepciones de dinero por reservas, check-in con abono, ventas directas, abonos de hospedaje, liquidaciones con pago y retiros/gastos de caja. Los cargos pendientes sin cobro siguen disponibles. También se bloquea recibir dinero tras el cambio de horario si no se cerró el turno anterior. Los movimientos se asignan por **timestamp absoluto** `createdAt` entre apertura y cierre para incluir la madrugada en su turno correcto.

**Compatibilidad:** el módulo anterior de cierre sigue en código para pruebas antiguas, pero en la interfaz con Supabase se utiliza el nuevo control. El CSV se descarga para cada sesión, y los cierres antiguos se presentan en historial únicamente de consulta. Para garantizar la integridad se requiere abrir caja antes de registrar cobros nuevos después de desplegar v0.29.

**Limitaciones de esta beta:** el registro de responsable de caja es manual hasta habilitar cuentas individuales de trabajadores. Los movimientos no reemplazan documentos contables y no se hace conciliación bancaria automática. Si se intenta cerrar mientras otro dispositivo ha actualizado cobros, el cierre se rechaza y debe actualizarse la página. No hay manipulación ni migración de pagos históricos.

**Migraciones:** `supabase/migrations/20261109_cash_shift_open_handover_v029.sql` y `20261109_cash_session_version_sync_v029.sql`. **Pruebas:** `tests/caja-apertura-handover-v029.test.cjs`, junto con todas las anteriores.

---

# Hotel Unicornio v0.28 — Administración gerencial

**Secciones nuevas:** Resumen gerencial, Estadísticas, Finanzas y costos, Colaboradores, Nómina y roles de pago, Accesos y auditoría. Publicadas bajo la misma sesión de administrador de Supabase. El resto de recepción se mantiene operativo.

**Seguridad:** los sueldos, documentos laborales, costos, gastos, roles y eventos de auditoría residen en nuevas tablas de Supabase y **no** en el objeto `hotel_cloud_state` que se comparte entre los módulos de recepción. Las tablas tienen RLS con comprobación de `hotel_staff.role='admin'` y `active=true`; ninguna de ellas concede acceso de lectura a recepcionistas. Las operaciones de escritura quedan auditadas por triggers de la base. Los roles pagados son inmutables. SQL reproducible en `supabase/migrations/20261109_admin_finanzas_nomina_v028.sql` y su corrección `20261109_admin_auditoria_fix_v028.sql`.

**Estadísticas:** contabiliza el importe operativo de estancias registradas en el periodo, ventas de varios una sola vez (incluidas las cargadas a habitaciones), cobros/anticipos netos aplicados, facturas externas registradas y ocupación de habitaciones. Los ingresos no se confunden con los cobros. La fecha de alta de la estancia no es devengo fiscal; las cifras son gerenciales y requieren conciliación contable, especialmente las ampliaciones de estancia y los movimientos históricos de caja.

**Costos y márgenes:** el administrador registra costos unitarios por producto en tabla protegida. Si una venta carece de costo reconocido, no se muestra un margen global inventado. No es todavía un libro contable ni lleva valorización por lotes.

**Finanzas:** formularios de gastos por concepto, fecha, forma de pago y estado pendiente/pagado, con historial filtrado por mes. **No se incorporan automáticamente los egresos históricos de Cierre de caja** para evitar duplicarlos inadvertidamente: requieren conciliación.

**Colaboradores:** expedientes con cargo, sueldo, forma de contrato, fecha de ingreso, día de pago y correo de referencia. No se almacenan contraseñas en la aplicación. **Crear y activar nuevas credenciales de empleados no está automatizado todavía**: queda preparada la relación `auth_user_id` para vincular cuentas de Supabase Auth después de habilitar y verificar permisos individuales.

**Nómina:** generación de borradores por colaborador y mes, edición manual de adicionales, descuentos y costo patronal; transición de revisión a pagado con referencia y fecha. **No realiza cálculos legales automáticos** de IESS, décimos, vacaciones, fondos de reserva o liquidaciones; los valores requieren revisión profesional. Los registros marcados como pagados son inmutables por trigger.

**Limitaciones conocidas:** los indicadores de flujo no equivalen a utilidad neta; no hay emisión de roles legales en PDF, control de asistencia, cálculo de salario por horas ni acceso de empleados habilitado. El sistema sigue siendo beta. La aplicación requiere revisión tributaria, laboral y de seguridad antes de usarse para pagos reales.

**Tests:** `tests/admin-gerencial-v028.test.cjs` comprueba el módulo, los cálculos, menús, controles y RLS en SQL. Se ejecuta en CI y antes de publicar GitHub Pages.

---

# Hotel Unicornio v0.27 — Catálogo de Varios por zonas, sin espacio vacío

La página **Varios y productos** muestra el **Catálogo de precios** con encabezado compacto, búsqueda por nombre o código de barras, filtro de categoría y pestañas **Todos, Vitrina, Nevera, Nevera helados y Bodega**. Las tarjetas pasan a estar **debajo de los controles** y ocupan todo el ancho disponible. La cuadrícula es adaptable a escritorio, tablet y celular.

### Cómo se asignan las zonas

Los productos antiguos no tienen ubicación confirmada. Hasta que recepción la indique, la interfaz muestra una **zona sugerida por categoría**, claramente marcada como «sugerida»: bebidas → Nevera; helados → Nevera helados; otras categorías → Vitrina. Esta sugerencia es **solo visual** y no modifica la información guardada.

En **Tarifas y ajustes → Catálogo de productos** se añadió un selector de zona por producto. Tras elegir una zona y pulsar **Guardar precios, códigos y zonas**, la ubicación queda almacenada en el estado central a través de la sincronización existente de Supabase. Los nuevos productos pueden nacer con una zona asignada. El botón **Asignar zonas** en Varios dirige a la misma configuración.

Bodega muestra productos asignados explícitamente a Bodega y también aquellos que ya tengan un conteo físico en Bodega. No se presume stock donde todavía no exista conteo.

### Seguridad y compatibilidad

Esta actualización **no altera el modelo de stock vigente**: las existencias físicas siguen registrándose por separado como `stockNevera` y `stockBodega`. La asignación visual a Vitrina o Nevera helados **no crea un nuevo depósito físico ni traslada unidades**. Las ventas mantienen las comprobaciones de disponibilidad existentes en Nevera. Para disponer de conteos independientes de Vitrina o Nevera helados hará falta ampliar el esquema de inventario en una etapa posterior.

Los productos sin precio continúan sin poder venderse; los productos con Nevera contada en cero permanecen bloqueados para la venta. La búsqueda, selección de producto, ventas a habitaciones y venta directa conservan el comportamiento actual. No se ejecuta ninguna migración ni se cambia stock, pagos o datos de huéspedes.

### Verificación

Se añaden pruebas en `tests/varios-zonas-v027.test.cjs` para disposición visual, filtros, búsqueda, asignación persistida, sugerencias no confirmadas, compatibilidad con inventario existente y productos con precio pendiente. La suite completa se ejecuta en Actions y como requisito del despliegue a Pages.

---

# Hotel Unicornio v0.26 — Valor a cobrar igual al saldo pendiente, sin campo de valor del abono

A solicitud de recepción, se elimina el campo **Valor del abono (USD)** en **Salidas y cobros → Abono a la cuenta pendiente**. Ahora **Valor a cobrar** es el importe exacto pendiente de la habitación, calculado con `dueOf(stay)` y nunca editable desde el formulario.

**Efectivo:** el recepcionista indica únicamente cuánto dinero entregó físicamente el huésped. El sistema registra automáticamente el menor entre efectivo recibido y saldo pendiente como pago a la cuenta. Si el huésped entrega menos, es un **abono parcial** sin vuelto y el resto queda por cobrar. Si entrega más, registra la deuda completa como cobrada y exige indicar qué ocurrió con el **vuelto**. El saldo restante se muestra en tiempo real. No se marca salida al registrar el pago.

**Transferencia:** al seleccionar transferencia se muestra **Monto transferido (USD)** y **Código de transferencia**. Se registra exactamente lo transferido hasta la deuda pendiente; se permiten transferencias parciales, sin vuelto, y se rechazan transferencias mayores que el saldo (se requiere conciliación).

**Ejemplo:** saldo pendiente **$3,25**; efectivo entregado **$20,00**; valor a cobrar **$3,25**; vuelto **$16,75**; saldo después del pago **$0,00**. Si entrega **$2,00**, se registra un pago de $2,00, sin vuelto, y quedan $1,25 pendientes.

No se modifica la lógica del **Cierre de cuenta y registrar salida**, la base de datos de Supabase, los pagos anteriores ni las tarifas. Se mantienen las validaciones de efectivo y las decisiones de vuelto dado/pendiente. Se adaptan las suites v0.24 y v0.25 a la interfaz renovada y se añade la suite `tests/saldo-fijo-abono-v026.test.cjs` con el caso concreto del recepcionista. Se ejecutan todas antes de desplegar Pages.

---

# Hotel Unicornio v0.25 — Abono superior a deuda y cálculo de vuelto

## Situación resuelta

Cuando el huésped debía **$10,07** y recepción introducía **$20,00** tanto en «Valor del abono» como en «Efectivo entregado», la interfaz mostraba «Valor a cobrar $20,00» y «Vuelto $0,00» aunque el saldo real era de $10,07. El guardado impedía sobreabonos, pero la previsualización era confusa.

La interfaz de **Salidas y cobros → Abono a la cuenta pendiente** ahora mantiene estas reglas:

- «Saldo pendiente» indica toda la deuda de la habitación.
- «Valor del abono» indica **solo lo que se aplicará a la cuenta**. Si se introduce un valor superior al saldo, el campo se ajusta automáticamente al máximo adeudado y aparece un aviso explicativo. No se guarda un sobreabono.
- «Valor a cobrar» muestra el abono válido, no el efectivo que llegó a caja.
- «Efectivo entregado» indica el dinero físico recibido, que puede superar el valor aplicado.
- «Vuelto calculado» es efectivo recibido menos abono aplicado; aparece «—» si falta introducir el efectivo (no presupone que el huésped entregó el valor exacto).
- «Saldo que quedará después del abono» se recalcula inmediatamente; **el abono no cierra la estadía**.
- Si hay vuelto, el sistema sigue exigiendo la decisión «Vuelto dado» o «Vuelto pendiente». La salida de la habitación sigue siendo otra operación independiente.

**Ejemplo:** saldo $10,07, abono escrito $20,00, efectivo entregado $20,00 → se ajusta el abono a $10,07, «Valor a cobrar» $10,07, vuelto $9,93 y saldo restante $0,00. Si se abonan $5,00, el saldo restante es $5,07.

La validación de `processPayment` sigue rechazando abonos mayores al saldo si alguien intenta omitir la interfaz; no se modifican datos reales ni el esquema de Supabase. Suite `tests/abono-vuelto-maximo-v025.test.cjs` incorporada a validación y al paso previo a la publicación en Pages.

---

# Hotel Unicornio v0.24 — Abonos y cierre de cuenta por separado

En **Salidas y cobros**, después de seleccionar una habitación, aparecen dos secciones plegables independientes:

1. **Abono a la cuenta pendiente**: permite registrar un abono parcial por efectivo o transferencia. Introduzca el **valor del abono** y, si es efectivo, cuánto dinero entregó el huésped. La pantalla muestra **Valor a cobrar**, **Efectivo entregado** y **Vuelto calculado**. Se guarda un movimiento de pago y se descuenta del saldo por cobrar, sin cerrar la estadía ni liberar la habitación.
2. **Cierre de cuenta y registrar salida**: cobra automáticamente el **saldo restante**, incluyendo cualquier abono anterior. El cuadro de efectivo también identifica claramente el **Valor a cobrar** y el **Vuelto calculado**. Tras confirmar, deja la cuenta saldada, registra la salida y pasa la habitación a **pendiente de limpieza**. Si el saldo está en cero, permite cerrar sin cobrar nuevamente.

Se eliminó el campo genérico **«Importe a aplicar a la cuenta»** que venía precargado con el total, y se eliminó el botón suelto **«Registrar check-out»** de la sección de Salidas para evitar dos caminos diferentes de salida. El abono inicia en blanco y no puede exceder el saldo pendiente; para pagos en efectivo es obligatorio indicar cuánto recibió recepción. Se mantienen las confirmaciones actuales para dinero recibido, vuelto pendiente y salida definitiva.

Las sumas ya existentes `totalOf`, `paidOf` y `dueOf` continúan siendo la fuente de los saldos. Los pagos se siguen guardando en `stay.payments` y se sincronizan mediante el flujo Supabase actual, sin migraciones ni cambios directos sobre registros existentes.

**Pruebas:** `tests/salidas-abonos-cierre-v024.test.cjs` verifica la separación del formulario, indicadores del valor a cobrar, abonos de centavos, métodos de pago, restricciones, conservación de la ocupación durante el abono y cierre con cobro del saldo residual. Ejecutar todos los tests antes de publicar GitHub Pages.

---

# Hotel Unicornio v0.23 — Facturación con datos del huésped y nómina de facturas

## Registro de ingreso

En **04 · Facturación y observaciones**, si selecciona **Sí, solicita factura** aparece la casilla **Factura a los mismos datos del huésped**. Al marcarla se copian del registro del huésped el nombre completo, cédula/RUC personal, dirección y correo. La dirección del huésped ahora es un campo opcional de su ficha; si no se conoce, se deja el campo de facturación editable para completarlo. Si no se dispone de correo, también se completa manualmente. No se inventan datos de facturación.

Con la casilla desmarcada, los cuatro campos se editan libremente para facturar a otro titular o empresa. Los campos del huésped y sus datos facturables se validan al guardar. La preferencia de mismos datos queda asociada a la estadía. Una reserva que se convierte en ingreso también utiliza esta sección.

## Menú Facturas

Se añade **Facturas** al menú lateral izquierdo. Es una **nómina de solicitudes asociadas a estadías** creadas con **Sí, solicita factura**. Cada habitación del mismo cliente tiene una fila independiente.

- **Pendientes** (predeterminado), **Facturadas** y **Todas**.
- Nombre del huésped, nombre de facturación, cédula/RUC, dirección, correo, número de habitación, fechas de estadía y estado del alojamiento.
- Total de la cuenta de habitación, total ya facturado, total pendiente de facturar y cobros recibidos. **El saldo de facturación no equivale al saldo por cobrar**. Se muestran los cargos de hospedaje y varios realmente registrados.
- El recepcionista emite la factura en su **aplicación de facturación externa**. Después escribe la referencia del documento efectivamente emitido y pulsa **Marcar emitida** con confirmación.
- El estado y la referencia se conservan en el JSONB central de Supabase, dentro de la estadía. El flujo no emite, autoriza ni transmite facturas al SRI.
- Si se agregan nuevos consumos a una habitación ya facturada, la diferencia se vuelve a mostrar como **Pendiente** y puede registrar otro comprobante externo complementario. Se verifica que no se reutilice el mismo número.

**Precaución contable:** el valor presentado es el total operativo de la cuenta registrado por el sistema; NO reemplaza la revisión del IVA, impuestos, facturas anteriores o detalles tributarios en la aplicación de facturación. El registro manual requiere comprobante externo ya emitido.

**Integridad:** no se modifican los documentos electrónicos, pagos ni reservas históricas ni el esquema de tablas de Supabase. La nueva suite `tests/facturas-nomina-v023.test.cjs` verifica autocompletado, facturación de ingreso, filtros, montos, registros de comprobantes y control de duplicados. GitHub Actions ejecuta la suite antes de publicar Pages.

---

# Hotel Unicornio v0.22 — Segunda tanda de 10 fotografías

**Fecha de registro:** 8 de noviembre de 2026.

El archivo `catalogo/segunda-tanda-fotos-2026-11-08.json` contiene **10 nuevas presentaciones** con EAN-13 leídos de las fotos `164517.jpg` a `164528.jpg` (10 archivos; no hay fotos 164520 ni 164523).

Los diez EAN-13 fueron comprobados mediante su dígito verificador y contrastados con fichas comerciales de Ecuador; cada producto conserva el URL que fundamenta la presentación (tamaño y sabor). Se registran Imperial Limonada 550 ml, Imperial Toronja 550 ml, Saviloé Uva 320 ml, Gatorade Manzana sin azúcar 500 ml, Forestea Horchata 400 ml, Vive 100 Mango 475 ml, Sprite 300 ml, Coca-Cola Original 300 ml, Gatorade Tropical 1 litro y Gatorade Manzana 1 litro.

Se **mantienen sin asignar** los cuatro campos de precio y cantidad `price`, `stock`, `stockNevera` y `stockBodega`: su valor es `null`, no cero. **No copiar precios de venta de tiendas ajenas al Hotel Unicornio.** No se modifican los 71 productos preexistentes, las diez fichas de la primera tanda, huéspedes, reservas ni cargos de caja.

El lector de la versión v0.21 reconoce los nuevos códigos desde **Inventario → Escanear código**, así como en la búsqueda/escáner de Varios, pero el sistema bloquea su venta mientras no se establezca su precio. Para activar las alertas de disponibilidad, registrar por separado el conteo físico de Nevera y Bodega.

La nueva prueba `tests/catalogo-tanda2-v022.test.cjs` verifica 10 códigos nuevos, ausencia de duplicados entre las 20 fotos y ausencia de valores inventados. Se ejecuta en Actions y como requisito previo al despliegue en Pages.

---

# Hotel Unicornio v0.21 — Inventario por código de barras (Nevera y Bodega)

Esta versión permite **contar productos por separado en Nevera y Bodega**, con lectura de código de barras desde celular, sin registrar unidades inventadas ni confundirse entre una venta y una reposición.

## Flujo de conteo nocturno

1. Acceda a **Inventario de productos** desde el menú principal o **Varios → Inventario de productos**.
2. Pulse **Escanear código de barras**. Autorice la cámara o escriba el EAN/UPC completo.
3. El artículo asociado queda seleccionado automáticamente. Si no está identificado, vincule primero el código en el catálogo de **Tarifas y ajustes**.
4. Seleccione **Nevera** o **Bodega**, elija **Conteo físico**, introduzca la cantidad real (puede ser cero) e identifique al encargado.
5. Pulse **Confirmar y guardar movimiento**. Solo entonces se guarda la cantidad y se sincroniza con Supabase, conservando un movimiento auditable.
6. Repita con otra ubicación. La cantidad total aparece solo cuando ambas ubicaciones tengan conteos. **Sin conteo no es equivalente a cero**.

Las opciones **Entrada**, **Merma** y **Trasladar** requieren un conteo inicial de la ubicación afectada; el traslado exige que también se haya contado el destino. Un traslado bodega→nevera mueve unidades sin crear ventas ni modificar el total.

## Varios y cargos a habitación

- Las tarjetas de producto muestran **blanco** para disponibilidad normal / sin conteo, **amarillo** para 1–5 unidades en nevera, **rojo** para nevera agotada sin stock disponible en bodega y **verde azulado** para nevera vacía con unidades en bodega que deben reponerse.
- Si la nevera se contó en cero, **no se permite vender** aunque existan unidades en bodega: primero debe hacerse un traslado. Al vender, se descuentan solo las unidades de nevera.
- La búsqueda de productos reconoce **también los que tienen precio pendiente**: aparecen en resultados con esa advertencia y no se pueden facturar hasta que recepción configure su precio.

## Primera tanda de 10 fotografías (08-11-2026)

El archivo `catalogo/primera-tanda-fotos-2026-11-08.json` registra **10 presentaciones** sin cantidades ni precios supuestos. Se transcribieron **8 códigos completos válidos** según los dígitos verificadores EAN/UPC. Las fotos 164507 (Coca-Cola 500 ml) y 164514 (Powerade Mora Azul 350 ml) muestran códigos parciales; se incluyen con código vacío para que no se asocie una identificación errónea. Las fotos 164505 y 164506 requieren confirmar marca/presentación con una imagen frontal, y la del agua grande requiere confirmar volumen.

Se identifican las presentaciones de Powerade por **sabor y tamaño**, sin fusionarlas con productos genéricos existentes de precio conocido. Todos los nuevos productos quedan con `price:null`, `stock:null`, `stockNevera:null` y `stockBodega:null`. Debe revisarse su precio antes de vender. Se conservan las 71 fichas anteriores y sus tarifas, sin eliminar ni editar fichas de huéspedes ni movimientos de caja.

**Seguridad:** el código de cámara no envía imagen de video a la base de datos. La cámara es voluntaria y requiere HTTPS; el código se procesa en el navegador. Supabase solo recibe los cambios confirmados por el usuario autenticado. Los movimientos se guardan en el estado central existente, sin cambios a la estructura de tablas.

**Pruebas:** `tests/inventario-escaner-v021.test.cjs` comprueba selección por código, identificación de pendientes, conteos por ubicación, traslados, venta solo desde nevera y que stock desconocido no sea interpretado como cero. Todas las pruebas anteriores se mantienen y Pages no despliega si falla alguna.

---

# Hotel Unicornio v0.20 — Persona adicional sin nombres y fecha en turno automático

En **Cuenta por habitación → Agregar persona adicional** se retira por completo el campo de nombre y apellido de la persona adicional. La operación se registra con **categoría**, **noches a cobrar**, **encargado** y **turno automático**; el cargo sigue utilizando la tarifa configurada para adulto o niño por noche.

- Los cargos nuevos quedan con nombre vacío y se muestran como **Acompañante** en el historial. Los registros anteriores con nombre se siguen mostrando sin alterar su información. El formulario antiguo y las pruebas sintéticas que suministraban un nombre siguen siendo compatibles.
- La distribución en escritorio utiliza una sola fila compacta: categoría, contador de noches con iconos Lucide, campo **Encargado** más angosto y tarjeta de turno con más espacio. En teléfonos se adapta a dos columnas y a una tarjeta de turno de ancho completo.
- La tarjeta de **Turno automático** muestra ahora **Día/Noche, fecha local actual y horario**. Calcula la fecha usando `America/Guayaquil` (El Coca), aunque el móvil esté configurado en otra zona horaria. El horario es Día: 07:30–19:29; Noche: 19:30–07:29.
- La fecha se actualiza al renderizar el formulario; el turno real se vuelve a calcular **cuando se confirma y registra** la operación.
- La mejora visual del turno y la fecha aplica también a las operaciones de desayunos adicionales y extensión de estadía, que comparten la misma tarjeta.
- No se alteran las tarifas, saldos, abonos, extensiones ni el esquema de Supabase.

**Pruebas:** `tests/cuenta-persona-v020.test.cjs` cubre eliminación del campo, cargos de adulto y niño sin nombre, compatibilidad con movimientos anteriores y cambios de fecha/turno alrededor de medianoche en Ecuador. Se actualiza el test visual de v0.19 y se mantienen todas las baterías anteriores; GitHub Pages se publica únicamente si pasan.

---

# Hotel Unicornio v0.19 — Controles compactos y turno automático en cuentas de habitación

En **Cuenta por habitación**, tres operaciones se presentan de forma más compacta:

- **Agregar desayunos**: sustituye el campo ancho de cantidad por un control compacto de número con botones **− y +**. Los iconos son SVG de **Lucide Minus / Plus**, sin dependencia de red; se puede introducir directamente una cantidad y el máximo sigue siendo 100. Se conserva la tarifa adicional de **USD 5 por desayuno** y el cargo pendiente.
- **Agregar persona adicional**: el nombre se introduce directamente por su *placeholder* y mantiene un nombre accesible para lectores de pantalla. Las **noches a cobrar** se eligen con los mismos botones −/+ (máximo de noches de la estadía). Categoría, encargado y cálculo del cargo se conservan.
- **Extender estadía**: recupera el recuadro visible con **Salida actual, Nueva salida e Importe**. Debajo aparece **Noches a extender**, con botones −/+ para elegir entre 1 y 90 noches, el encargado y el turno automático. La vista previa de la nueva fecha y el precio se actualiza sin reemplazar el recuadro ni plegar el formulario. Se mantiene la comprobación de reservas superpuestas para **todo** el período.

### Turno de recepción automático

Los tres registros (**desayunos, persona adicional y extensión**) ya no requieren escoger turno manualmente. Se calcula **al guardar** con la zona horaria `America/Guayaquil`, independientemente de la zona horaria configurada en el móvil.

- **Día**: desde **07:30** inclusive hasta **19:30** exclusive.
- **Noche**: desde **19:30** hasta **07:29** del día siguiente.

La operación muestra un indicador informativo **Turno automático** en lugar de un selector y se guarda el turno real calculado al confirmar (no se acepta un turno alterado del formulario). Otros módulos, como cobros o caja, mantienen su flujo actual sin cambios.

**Seguridad e integridad:** no se cambian tarifas previas, validaciones de número de noches, balances, reservas, huéspedes ni esquemas de Supabase. Las pruebas automatizadas en `tests/cuenta-compacta-v019.test.cjs` cubren la frontera de las 07:30 y 19:30, la elección ±, el diseño accesible y las cantidades/turnos registrados. Las suites anteriores continúan ejecutándose antes del despliegue a GitHub Pages.

---

# Hotel Unicornio v0.18 — Cuenta compacta, desayunos y escaneo de productos

La ventana **Cuenta por habitación** se presenta ahora más compacta. Los paneles **Datos del huésped**, **Desglose de la cuenta**, **Resumen de importes** y **Registrar abono parcial o total** se pliegan individualmente con elementos HTML accesibles `details/summary`; se conserva el saldo siempre visible y no se modifica el cálculo ni los pagos previos.

## Varios: búsqueda y código de barras

- **Agregar varios a la habitación** tiene dos botones: **Buscar producto** (por nombre, categoría o código) y **Escanear código**. La selección rellena el campo Producto sin cobrar todavía; el recepcionista ajusta cantidad y confirma el cargo.
- **Escanear código** abre un diálogo con botón **Activar cámara**. Solo al pulsarlo se solicita permiso al navegador. Se utiliza `html5-qrcode@2.3.8` fijado a esa versión y cargado a demanda desde jsDelivr; permite leer EAN/UPC/Code128 desde cámaras móviles compatibles. La imagen se procesa en el navegador y no se envía a Supabase. La cámara se detiene al cerrar, seleccionar o navegar.
- Existe campo **Código de barras manual** para navegadores sin cámara o sin permisos. **No se inventa ninguna asociación:** en **Tarifas y ajustes → Catálogo de productos**, cada producto dispone de un código opcional único, editable junto con su precio. Se puede asociar también al crear un producto nuevo.
- Al escanear un código sin producto vinculado o sin precio, se informa al recepcionista; no se genera cargo ni venta por error.
- La cámara requiere HTTPS, permiso del usuario, un navegador compatible y acceso a la biblioteca externa al activarla. Se recomienda probar Android/iOS en equipos reales; el formulario manual funciona como alternativa.

## Desayunos adicionales

- Nuevo panel **Agregar desayunos** en cada habitación activa. La tarifa adicional es **USD 5,00 por unidad**, de 1 a 100 unidades por operación.
- Por ejemplo, 3 desayunos generan **USD 15,00** en la cuenta. Se registra como un `extra` con estado pendiente y aparece en el desglose, historial, saldos y reportes de caja; **no es cobro** hasta que se registre el abono.
- No altera tarifas ya contratadas **con desayuno**. Si la estancia lo incluye, aparece una advertencia para evitar cargos duplicados.
- No consume inventario de bebidas o alimentos ni añade productos falsos al catálogo.

## Extender varias noches

- **Extender estadía** permite ingresar de **1 a 90 noches** por operación, sin superar 365 noches totales por estadía.
- Se conserva la **tarifa histórica por noche** de la habitación: por ejemplo, 3 noches a USD 20 suman **USD 60**. Se calcula la nueva fecha de salida, se revisa que **ninguna** noche nueva coincida con otra reserva o estadía de la habitación y se muestra el monto para confirmar.
- El cambio se registra como **un único movimiento** con `addedNights`, tarifa, total y fechas; compatible con las extensiones históricas de una noche.
- Cambiar la cantidad actualiza el resumen antes de guardar; si hay conflicto, no se actualizan fechas ni importes.

**Pruebas:** `tests/cuenta-habitacion-v018.test.cjs` cubre interfaz plegable, producto por búsqueda/código, validaciones, desayunos y extensiones. Se conserva la suite de fases 1 y 2, reservas, multi-habitación, fechas, camarería y autenticación. GitHub Actions bloquea Pages si falla alguna. No hay migraciones SQL ni se realizaron escrituras en los huéspedes existentes durante el desarrollo.

---

# Hotel Unicornio v0.17 — Crear reserva plegable

En **Reservas y próximas llegadas**, el formulario **Crear reserva** se presenta contraído inicialmente para mostrar la **Nómina de reservas** mucho más arriba y reducir el desplazamiento vertical de recepción. La barra «Crear reserva» es totalmente pulsable y accesible con el teclado; el texto alterna entre **Mostrar formulario** y **Ocultar formulario**.

- Al desplegar se muestran el formulario de reserva, el botón de búsqueda de huéspedes y el panel de condiciones, igual que en v0.16.
- Plegar y desplegar no elimina ni guarda por sí solo los datos del formulario; se conserva el borrador si el componente vuelve a dibujarse.
- La sección recuerda el estado plegado/abierto durante la navegación de la sesión; tras **Guardar reserva** vuelve a plegarse y deja la nómina a la vista.
- La nómina, los botones Ingresar/Cancelar, los importes, las tarifas y la conexión a Supabase permanecen intactos. No hay migración ni modificación de datos existentes.
- Pruebas sintéticas adicionales dentro de `tests/reservas-buscador.test.cjs`: estado inicial plegado, estructura del formulario, eventos del desplegable y preservación del borrador durante la búsqueda.

---

# Hotel Unicornio v0.16 — Buscar huéspedes al crear reservas

En **Reservas → Crear reserva**, el campo **Cédula o RUC personal (opcional)** incluye un botón **Buscar**. Se abre una ventana flotante que permite buscar por cédula/RUC, nombre completo o teléfono. Tras escribir dos caracteres o más, seleccione un huésped para completar **nombre, teléfono y documento** en el formulario; las fechas, habitación, desayuno y anticipos permanecen intactos.

- Busca únicamente en los huéspedes ya cargados de Supabase después de autenticarse. No modifica fichas de huéspedes ni tablas.
- Muestra hasta 15 coincidencias; la búsqueda ignora mayúsculas y tildes.
- Los resultados se escapan como HTML y solo son visibles en la sesión autenticada.
- Se cierra con el botón X, pulsando fuera de la ventana o con Escape. Mantiene los datos escritos en la reserva.
- Si no existe coincidencia, permite seguir completando la reserva manualmente. La validación de cédula/RUC al guardar permanece igual.
- Se adapta a pantallas móviles y no ocupa espacio fijo adicional en el formulario.

**Prueba de regresión:** `tests/reservas-buscador.test.cjs` valida búsquedas, autocompletado, conservación del borrador y ausencia de modificaciones en fichas o datos reales. GitHub Actions la ejecuta antes de publicar.

---

# Hotel Unicornio v0.15 — Consulta de ocupación por fecha y reporte de camarería

En **Habitaciones**, la barra que contiene los filtros **Todos los estados** y **Todos los tipos** ahora incluye, alineados a la derecha en computadora y en la misma sección, dos botones: **Ver por fecha** y **Imprimir reporte camarería**. En pantallas pequeñas ambos botones quedan juntos en una fila horizontal debajo de los filtros.

## Ver por fecha

- Pulse **Ver por fecha** para desplegar el calendario y botones rápidos **Hoy**, **Mañana** y **Estado actual**. Seleccione una fecha desde hoy en adelante.
- El mapa y los cuatro contadores se recalculan para la fecha consultada. Una estadía activa ocupa las noches desde la entrada **inclusive** hasta la salida **exclusiva**. Una reserva pendiente o confirmada se muestra cuando la fecha está entre su llegada y su salida, con sus fechas visibles en cada tarjeta. Así se puede anticipar cuáles estarán ocupadas, reservadas o libres.
- **Libres previstas** significa sin estancia ni reserva asignada para esa fecha; **no certifica limpieza ni disponibilidad de última hora**. Las habitaciones arrendadas siguen fuera de operación. Las marcadas como pendientes de limpieza **se mantienen pendientes hasta que recepción confirme la limpieza**.
- Los filtros de estado y tipo, los indicadores interactivos, la leyenda y el mapa original se conservan. «Estado actual» vuelve a la vista operativa sin alterar los datos.
- Al pulsar una habitación de una fecha planificada, se muestra un resumen de su reserva/estadía prevista. Las cuentas que pueden aparecer debajo se refieren al estado **actual** de la habitación.
- Las reservas sin habitación asignada no aparecen en el mapa. Las salidas y limpiezas futuras están sujetas a cambios. La aplicación no asigna habitaciones ni confirma reservas automáticamente al consultar.

## Imprimir reporte de camarería

- El botón imprime **todas las habitaciones**, independientemente de qué filtro esté seleccionado.
- Sin el calendario abierto, utiliza los **estados físicos actuales**; con el calendario abierto, utiliza la **previsión de la fecha seleccionada**.
- Incluye número y tipo de habitación, estado, fecha de llegada y salida, una columna para marcar limpieza, espacio para novedades, resumen de ocupación y firmas de recepción y camarería.
- Es un reporte operativo **sin nombres, cédulas, teléfonos, precios ni saldos de los huéspedes**. Se abre en una ventana de impresión con formato A4 horizontal. Si el navegador bloquea ventanas emergentes, hay que permitirlas para el sitio.

**Pruebas:** `tests/room-date-housekeeping.test.cjs` verifica fechas válidas, llegada/salida, reservas futuras, filtros, indicadores, el reporte imprimible y ausencia de datos privados. No se necesitan migraciones ni cambios de RLS. La consulta no modifica datos de Supabase.

---

# Hotel Unicornio v0.14 — Indicadores de Habitaciones interactivos

Las cuatro tarjetas del resumen de Habitaciones ahora son **botones de filtro** vinculados al mapa y totalmente utilizables con ratón, teclado y pantalla táctil:

- **Ocupadas:** muestra únicamente habitaciones cuyo estado físico es ocupado.
- **Limpias:** muestra las habitaciones disponibles.
- **X/C:** muestra habitaciones ocupadas que tienen cuentas activas con saldo por cobrar.
- **Reservadas:** muestra las habitaciones asignadas a reservas pendientes o confirmadas, vigentes o futuras, sin duplicar habitaciones con varias reservas y sin incluir reservas vencidas, canceladas, arrendadas o sin asignación.

Pulsar una tarjeta cambia el filtro de **Todos los estados** y lleva el foco visual hacia el mapa. Pulsar **la misma tarjeta otra vez** restablece «Todos los estados». Se marca visualmente el indicador activo y tiene `aria-pressed` para lectores de pantalla. El filtro «Reservadas» se añadió también al selector de estados. Los filtros por tipo siguen respetándose y se conserva la apertura de la cuenta de cada habitación desde su tarjeta del mapa.

**Importante:** una habitación con una reserva futura puede estar disponible actualmente. «Reservadas» es una clasificación de reservas, no un nuevo estado físico; la reserva no modifica el estado real de esa habitación. Las cuatro cifras no se suman necesariamente.

No se alteran datos ni tablas de Supabase. Las nuevas pruebas verifican clics de los indicadores, mapa filtrado, reservas, selección repetida y coexistencia con el filtro de tipo; se ejecutan antes de publicar con GitHub Actions.

---

# Hotel Unicornio v0.13 — Resumen numérico en Habitaciones

En la vista **Habitaciones** se muestran cuatro tarjetas de resumen **encima** del mapa, con el diseño del Panel general:

- **Ocupadas:** habitaciones cuyo estado actual es `ocupada`.
- **Limpias:** habitaciones cuyo estado es `disponible`, listas para recibir huéspedes.
- **X/C:** habitaciones ocupadas con al menos una cuenta activa con saldo pendiente; incluye el valor total de esas cuentas.
- **Reservadas:** cantidad de **habitaciones distintas** del inventario operativo asignadas a reservas `pendiente` o `confirmada` vigentes/futuras, cuya salida es posterior a hoy. No se duplican habitaciones con varias reservas en fechas diferentes, ni se incluyen reservas vencidas, canceladas, sin habitación asignada, arrendadas o ya convertidas en ingreso.

Los indicadores se calculan desde el estado actualizado de Supabase al renderizar la vista, no son contadores fijos ni reemplazan registros históricos. **X/C es un subconjunto de Ocupadas**, y una habitación actualmente ocupada puede tener también una reserva futura, así que las cuatro cifras no deben sumarse.

**Se conserva íntegro el Mapa de habitaciones**, incluidos los estados disponible, ocupada pagada, ocupada por cobrar, pendiente de limpieza y arrendada; también se preservan los filtros **Todos los estados** y **Todos los tipos**, además de la apertura de la cuenta al tocar una habitación. Los cuadros numéricos muestran el total general independientemente del filtro aplicado al mapa.

Las pruebas automáticas `tests/rooms-overview.test.cjs` cubren los conteos, la desduplicación de reservas, las deudas, los estados y la permanencia del mapa con sus filtros. No se cambian tablas ni datos en Supabase.

---

# Hotel Unicornio v0.12 — Forma de pago compacta

La sección **03 · Forma de pago y tarifa** del formulario de ingreso fue reorganizada para ocupar menos altura en computadora y celular, sin cambiar el cálculo ni las obligaciones de confirmación.

- Menos margen entre campos, pago en efectivo, vuelto, casilla de confirmación y la siguiente sección de facturación.
- El importe no editable conserva su visibilidad, pero se elimina la nota redundante que aparecía debajo.
- Los mensajes de ayuda se presentan más breves, sin un bloque de color adicional para el pago ordinario.
- En pantallas pequeñas, el medio de pago ocupa una línea completa y el turno y el importe comparten la fila siguiente.
- **Sin cambios funcionales:** monto calculado, abonos, transferencias, vuelto dado/pendiente, doble confirmación por cobrar y validaciones de caja siguen intactos.

El cambio afecta exclusivamente el diseño de pago dentro de **Registro / ingreso**. No se modifican los datos de Supabase ni los componentes de otras operaciones de caja. Se añadieron pruebas de regresión y la publicación en Pages está condicionada a que pasen todas las pruebas.

---

# Hotel Unicornio v0.11 — Panel de Varios plegable

En **Registro / ingreso → 02 · Detalles de alojamiento**, la sección **«Varios para este mismo huésped»** aparece **cerrada por defecto**, con una cabecera compacta que muestra el nombre de la sección, cantidad de productos seleccionados y total de Varios. Toque la cabecera (o la flecha) para abrir o cerrar.

Al abrir se muestran el buscador, la lista de productos, cantidades, habitación destino, subtotal y descripción. Al cerrar, los artículos **no se eliminan**: permanecen en la cuenta y en el total de hospedaje + consumos. El panel conserva su estado abierto al añadir o quitar productos; usa el elemento accesible HTML `details/summary`, admite teclado y no añade datos nuevos a Supabase.

Los campos de cantidad y habitación destino siguen siendo validados por el cálculo y por el guardado, incluso cuando el panel está plegado. Esto evita que un campo oculto inválido bloquee el formulario de manera silenciosa. Se incluyen pruebas del estado inicial plegado, la expansión con artículos y la conservación de cálculos al plegar.

---

# Hotel Unicornio v0.10 — Pago verificado y cédula/RUC correctamente validados

En **Registro / ingreso**, el método predeterminado pasa a ser **Efectivo**. El recepcionista no puede registrar el huésped sin confirmar que realmente recibió dinero o verificó la transferencia. Para efectivo debe escribir la cantidad físicamente entregada; el vuelto se calcula como antes. En transferencia, debe registrar la referencia bancaria y confirmar el abono acreditado. Un anticipo previo que cubra por completo la cuenta también se considera pagado.

**Excepción «Por cobrar»:** al seleccionarla aparece una advertencia específica. Se exige una **primera confirmación** mediante casilla de verificación. Al presionar «Solicitar ingreso por cobrar» se presenta una **segunda confirmación** con los números de habitación y el importe total pendiente. Si se cancela, **no se registra** ninguna habitación, pago, consumo ni huésped nuevo. Al autorizar se guarda `creditApproval` (fecha, turno, importe, modo `doble_confirmacion`) por habitación y queda un evento en su historial; el importe sigue pendiente y no se registra efectivo ni transferencia. Cambiar el método de pago desmarca las verificaciones anteriores.

**Identificaciones personales ecuatorianas:**
- Se admiten **cédulas de 10 dígitos** o **RUC de persona natural de 13 dígitos que terminan en `001`**.
- La cédula base debe superar el control de provincia, tercer dígito y **dígito verificador módulo 10**. También se reconoce la serie `30` con tercer dígito `4` o `5` de inscripciones consulares.
- El buscador, las fichas de huéspedes, las reservas y el registro de ingreso usan los mismos controles. Un RUC personal terminado en `001` y su cédula base coinciden en **una sola ficha**, sin duplicar al huésped ni alterar el documento que ya estaba registrado.
- Un **RUC societario** no es una cédula de una persona natural: se maneja en los campos de facturación, sin tratarlo como identificación personal. El SRI advierte que ciertos RUC societarios válidos no deben ser rechazados por algoritmos tradicionales de verificación; la validación personal aquí no equivale a un cotejo oficial con SRI/Registro Civil.
- No se cambian retroactivamente identificaciones cargadas anteriormente. Al volver a ingresar un huésped con documento de estructura inválida, recepción deberá comprobar/corregir el dato antes del ingreso.

La versión sigue siendo una **beta** con guardado de estado en Supabase y políticas de acceso. Una casilla de confirmación es un control operativo: todavía se requiere un backend transaccional y permisos/auditoría de caja para utilizarla en producción. Todas las pruebas son sintéticas y no escriben datos de huéspedes reales.

---

# Hotel Unicornio v0.9 — Varios al ingreso y descuento solo por transferencia

**Cambios de recepción:** el precio especial **solo se habilita con la modalidad «Transferencia · precio con descuento»**. Las demás opciones disponibles son «Por cobrar», «Efectivo» y «Transferencia» con tarifa normal. Se rechazan las antiguas modalidades de descuento en efectivo o por cobrar, incluso si un navegador intenta enviarlas manualmente.

**Varios en el check-in:** debajo de «Más habitaciones para este mismo cliente», en la sección «Varios para este mismo huésped», el recepcionista puede buscar por nombre o categoría (búsqueda sin distinción de mayúsculas/acentos), pulsar «Agregar», configurar cantidad y seleccionar la habitación a la que se carga cada producto. Muestra precios, subtotales, inventario disponible y total de consumos. Se permite agregar varios artículos y destinar cada uno a una habitación distinta del mismo titular.

**Cuentas y caja:** el resumen de ingreso muestra hospedaje + Varios. Si elige «Por cobrar», no se registra ingreso de dinero y todo queda como saldo pendiente de cada habitación. Si paga en efectivo o transferencia, se cobra el total junto y se distribuye entre las cuentas, incluido cada consumo; el vuelto en efectivo se registra una sola vez. El descuento de transferencia solo afecta al precio del hospedaje y jamás a Varios ni personas adicionales. Cada consumo queda registrado en el historial de la habitación y reduce el stock si previamente hubo conteo. Se verifican en conjunto las existencias solicitadas, incluso cuando se agrega el mismo producto en varios renglones.

**Límites:** los productos sin precio definido no se pueden agregar desde el buscador hasta configurar su importe; los stock sin conteo se identifican como tal. Los consumos no se cobran dos veces en caja, ya que son cargos contra las cuentas de alojamiento. Los datos históricos de huéspedes y estadías no se alteran. Las mismas condiciones de alojamiento sin desayuno, sin solicitud de factura y sin reservas con tarifa confirmada se mantienen para la modalidad especial. Las obligaciones tributarias aplicables al hotel no se modifican.

**Pruebas y seguridad:** se ejecutan pruebas automáticas de caja, habitaciones, autenticación, validaciones de descuento, búsqueda, Varios y stock antes de publicar. El sistema continúa siendo beta, con acceso autenticado y control de revisión en Supabase; los cobros e inventarios aún requieren transacciones atómicas y auditoría antes de su uso comercial.

---

# Hotel Unicornio v0.8 — Cobro automático, por cobrar y tarifas con descuento

En **Registro / ingreso → 03 · Forma de pago y tarifa** ya no existe un campo donde se pueda escribir manualmente el importe del hospedaje. El valor se calcula con **tarifa por habitación × noches**, descontando anticipos vinculados. No se ha alterado el importe histórico de ninguna estadía.

## Opciones de pago y precio
- **Por cobrar (tarifa normal):** guarda la estadía y deja el precio como saldo pendiente, **sin registrar entradas de caja**.
- **Efectivo (tarifa normal):** cobra automáticamente el total pendiente del ingreso. Solo se escribe el **efectivo realmente entregado**, para calcular vuelto.
- **Transferencia (tarifa normal):** cobra automáticamente el total pendiente; exige referencia bancaria.
- Las mismas tres opciones existen con **precio con descuento**, aplicando exclusivamente la tabla fija indicada por recepción para hospedaje **sin desayuno y sin solicitud de factura**.

| Habitación | Tarifa especial por noche (USD) |
|---|---:|
| Individual con ventilador | 15,00 |
| Matrimonial con ventilador | 20,00 |
| Individual con aire acondicionado | 17,00 |
| Matrimonial con aire acondicionado | 27,00 |
| Doble con aire acondicionado | 27,00 |
| Triple con aire acondicionado | 37,00 |

El recepcionista no puede escribir un precio personalizado, alterar el monto automático mediante un campo HTML ni obtener una tarifa **menor** que el límite configurado para ese tipo. La aplicación también bloquea descuentos con desayuno, solicitudes de factura o reservas con tarifa previamente confirmada. La condición comercial de descuento no exime al hotel de sus obligaciones tributarias y de emisión de comprobantes cuando corresponda.

**Sin descuentos para adicionales:** personas adultas, niños, varios y otros servicios mantienen sus importes normales. Las nuevas tarifas se aplican al **hospedaje**, no a esos conceptos.

Con varias habitaciones, el precio especial de cada categoría se calcula por separado y se muestra el total conjunto. En ingreso, el pago es **completo o por cobrar**; los abonos parciales, cuando sean necesarios, se registran más tarde desde la cuenta de cada habitación. El vuelto se registra una sola vez al distribuir un pago grupal.

**Seguridad operativa:** el sistema sigue en beta con documento JSONB compartido, RLS, administrador verificado y control de versiones. Para cobros reales simultáneos todavía son necesarias transacciones independientes y auditoría. Las nuevas pruebas automáticas solo usan datos ficticios.

---

# Hotel Unicornio v0.7 — un cliente con varias habitaciones

La ficha de **Registro / ingreso** permite contratar varias habitaciones a nombre de un solo cliente, por ejemplo habitación 02 y habitación 03 para una familia. El titular se guarda **una sola vez** en `hotel_guests`, y cada habitación recibe una estadía independiente dentro del estado compartido de Supabase. Cada habitación ocupada solo puede tener **una estadía/titular activo** a la vez.

### Funcionamiento
- En el apartado **02 · Detalles de alojamiento**, elija la habitación principal y pulse **Agregar otra habitación** para añadir una o varias. Cada fila permite elegir categoría, desayuno y número de habitación disponible. Puede quitar cualquier habitación adicional antes de guardar.
- Se aplica **un mismo rango de fechas** a las habitaciones del grupo; cada fila puede tener un precio por noche diferente. El resumen muestra subtotales y el **total de todas las habitaciones**.
- El cliente puede abonar a varias habitaciones de una sola vez durante el ingreso. El importe se distribuye en el orden mostrado, sin cobrar dos veces el efectivo, la transferencia ni el vuelto. La **reserva y su anticipo**, si existen, corresponden a la habitación principal.
- En el mapa de habitaciones, cada habitación conserva **su propia cuenta, consumos, saldo, pagos y salida**. Dentro de la cuenta se muestran enlaces a las otras habitaciones activas del mismo titular y el saldo conjunto.
- Los controles rechazan habitaciones ocupadas, arrendadas, en limpieza, incompatibles, con otra reserva superpuesta o seleccionadas dos veces. La verificación se repite antes de guardar los ingresos.
- Las habitaciones que comparten un titular se vinculan por `guestId` y por el identificador de grupo `groupId` cuando nacen de un mismo ingreso. **No se migraron ni duplicaron fichas personales**; la base de datos sigue usando RLS e inicio de sesión.

### Límites actuales
- La cuenta y el cierre final se mantienen **por habitación**, aunque exista un saldo conjunto informativo. Aún no hay un botón de liquidación final de todas las habitaciones en una única operación.
- El estado compartido se almacena en un documento JSONB con **control de revisiones**. También se instaló en Supabase un **trigger PostgreSQL** que rechaza cualquier documento con dos estadías activas en la misma habitación, incluso si se intentara grabar directamente. Se probó con una duplicación artificial dentro de una transacción que se revirtió. Aun así, los cobros e inventarios siguen sin ser operaciones transaccionales por separado.
- Trigger de unicidad: [supabase/multiroom-unique-active-room.sql](supabase/multiroom-unique-active-room.sql). Está aplicado al proyecto de Supabase y no exige volver a cargar datos.
- Versión beta: valide las operaciones con información de prueba antes de usarla con cobros reales.
- Prueba local: `node tests/multihabitacion.test.cjs`. Las pruebas automatizadas se ejecutan antes de cada despliegue en GitHub Actions.

---

# Hotel Unicornio — Sistema de Recepción v0.5 (Fase 2)

**Sitio de pruebas:** https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/

La fase 2 amplía la cuenta viva de habitación en la misma aplicación autenticada con Supabase. No hace falta crear nuevas tablas: los cambios se guardan dentro del estado compartido en `hotel_cloud_state`, conservando las estadías anteriores y la importación de 1.448 huéspedes. La operación sigue siendo **BETA** y no sustituye un sistema contable con transacciones atómicas.

## Novedades de la fase 2

1. **Varios desde habitación:** abra una habitación ocupada → "Agregar varios a la habitación". Seleccione producto, cantidad y turno. El cargo incrementa el saldo y descuenta inventario si se registró conteo. No entra en caja hasta recibir el pago. El enlace al catálogo completo mantiene la opción de cargos manuales.
2. **Persona adicional:** en la misma cuenta se registra un acompañante identificado por nombre, categoría (adulto mayor de 12 años o niño de 6 a 12 años), **número explícito de noches a cobrar** y turno. Tarifa tomada de Ajustes: adulto **$10** y niño **$5** por persona y noche seleccionada. El usuario debe confirmar el cargo. No se inventa una regla para menores de 6 años.
3. **Extender un día:** agrega exactamente una noche desde la fecha de salida prevista, con la **tarifa de la estadía**, sin aplicar un precio nuevo. Antes de hacerlo comprueba conflictos con reservas/estadías asignadas para esa habitación.
4. **Cerrar cuenta final:** incluye hospedaje, personas adicionales, varios, anticipos y pagos. Puede cobrar **todo el saldo pendiente en una sola operación** por efectivo o transferencia, calculando el vuelto entregado o pendiente, y registrar la salida al mismo tiempo. La habitación pasa a pendiente de limpieza. Si el saldo está pagado, permite cerrar sin un nuevo cargo. Un vuelto no entregado queda como obligación del hotel y requiere confirmación especial.
5. **Historial:** muestra cronológicamente ingreso, hospedaje, ampliaciones, acompañantes, consumos, anticipos, abonos, vueltos y salida. Está disponible en la cuenta activa y en el apartado Salidas para estadías cerradas. Permite exportar CSV.

El cierre de caja incluye cargos de acompañantes en el total informativo de "Cargos a habitaciones" y contabiliza el efectivo únicamente cuando se registra el pago. **No duplica ingresos**.

## Pruebas y limitaciones

- Pruebas sin datos reales: `node tests/fase1.test.cjs` y `node tests/fase2.test.cjs`.
- Los flujos anteriores siguen vigentes; `additionalPeople` y `extensions` son arreglos opcionales retrocompatibles.
- Las operaciones continúan guardándose como un documento JSONB con versión en Supabase. Se detecta un conflicto entre equipos y se obliga a recargar en lugar de sobrescribir, pero **no se garantiza atomicidad de pagos, stock y ocupación** para una recepción en producción.
- No hay anulación ni devolución de operaciones erróneas en esta fase; revisar importes y confirmar antes de cada registro.
- El cierre no genera comprobantes SRI ni elimina de caja los vueltos pendientes; los mantiene localizables.
- No introduzca operaciones reales hasta completar pruebas integrales, auditoría, transacciones de caja e inventario y respaldo de base de datos.

---

# Hotel Unicornio — Beta conectada a Supabase

**Estado actual:** la aplicación en GitHub Pages exige acceso del administrador con correo verificado. Los 1.448 registros de clientes reales están en Supabase bajo políticas RLS. Habitaciones, reservas, estadías, pagos, consumos, inventario y cierres de caja comparten un estado con control optimista de versión. **No usar para contabilidad real ni operaciones simultáneas críticas**: es un entorno de pruebas; las transacciones de módulos aún deben normalizarse.

**URL:** https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/

El propietario debe crear el acceso mediante la pantalla de inicio de sesión, usar contraseña nueva de al menos 12 caracteres y confirmar desde el correo del hotel. Ninguna contraseña debe registrarse aquí ni en GitHub. En Supabase configurar [Authentication → URL Configuration](https://supabase.com/dashboard/project/ttkhklboogpqvgsyjtwz/auth/url-configuration) para permitir la URL de Pages.

**Detalles técnicos y advertencias:** [supabase/CONNECTED-BETA.md](supabase/CONNECTED-BETA.md)

---

## Fase 1 — Vuelto y cuentas por habitación (v0.4)

- **Tarjetas:** las habitaciones ocupadas con deuda muestran dos colores, rojo superior y azul inferior, con etiqueta `Por cobrar` y monto; también presentan la tarifa por noche. Un botón de habitación abre una cuenta emergente.
- **Cuenta emergente:** datos del cliente, fecha de ingreso y salida, noches, cargos por hospedaje, consumos, abonos, saldo, y un formulario para cobrar directamente. Desde ahí se puede abrir la pantalla de varios con el destino de esa habitación preseleccionado.
- **Vuelto en efectivo:** la cantidad a aplicar a la cuenta se distingue del efectivo recibido. El sistema calcula en centavos y exige seleccionar **Vuelto dado** o **Vuelto no dado** cuando el efectivo supera el importe a cobrar. Transferencias no generan vuelto.
- **Vuelto pendiente:** queda vinculado al cobro de la habitación, al anticipo o a la venta directa y puede marcarse posteriormente como entregado. No se considera ingreso definitivo.
- **Cierre de caja:** registra como entrada todo el efectivo recibido y como salida el vuelto realmente entregado, en el turno de entrega; muestra además vueltos pendientes. Exportación CSV y arqueo incluyen estos datos. Ejemplo: cargo $39, se reciben $40 y se devuelve $1 → efectivo neto $39.
- **Compatibilidad:** los registros de pagos anteriores que no tienen campos de vuelto se tratan como cobros exactos; no se altera su historial.
- **Alcance:** los botones de agregar persona adicional y extender una noche quedan para la fase 2. **Solo pruebas**; la sincronización actual sigue siendo un JSON compartido con control de conflictos, sin transacciones monetarias atómicas.
- **Pruebas:** se ejecutaron verificaciones unitarias con datos ficticios para efectivo exacto, insuficiente, vuelto pendiente/entregado, caja, saldo de habitación, tarjeta bicolor y cuenta de habitación.

## Archivo de referencia de la versión 0.2

### Sistema de Recepción — documentación histórica v0.2

**Hotel Unicornio · Puerto Francisco de Orellana (El Coca), Ecuador**

Sitio de demostración publicado con GitHub Pages:

**https://alelandtrkz.github.io/hotel-sistema-nomina-huespedes/**

> **PROTOTIPO SIN BASE DE DATOS NI CONTROL DE ACCESO.** No se deben introducir cédulas, teléfonos, nombres, datos bancarios, facturas o registros de clientes reales. Los datos que se escriban se almacenan en `localStorage` del propio navegador y **no** se sincronizan entre computadoras ni teléfonos. No es un sistema contable certificado ni genera comprobantes electrónicos.

## Módulos

1. **Panel general:** habitaciones, ocupación, próximas llegadas.
2. **Habitaciones:** 33 unidades únicas según inventario fotografiado; 25 operativas y 8 arrendadas fuera de servicio de recepción. Estados: disponible (verde), ocupada (rojo), pendiente de limpieza (amarillo), arrendada/no operativa (gris).
3. **Registro de huéspedes:** búsqueda exclusivamente local por cédula, ficha de cliente, asignación, reserva vinculada, pagos en efectivo o transferencia, referencia bancaria, solicitud de factura y observaciones.
4. **Reservas:** fechas, tipo, habitación opcional, anticipo y su forma de pago; se requiere 50% para estado «confirmada». Las tarifas sin desayuno de ventilador provienen del tarifario fotografiado.
5. **Salidas y cobros:** liquidación, abonos, adicionales de habitación y limpieza posterior al checkout.
6. **Varios / ventas:** catálogo de 71 productos y servicios; venta de caja (efectivo/transferencia), cargo a habitación, cobros manuales (helados sin precio impreso, lavandería u otros). Las ventas reducen stock **si ya existe conteo**.
7. **Inventario de varios:** conteo físico, reposición, merma, historial de unidades por trabajador y turno. El stock inicial no se inventa ni se copia de una foto fechada.
8. **Cierre de caja:** fecha y turno día/noche; anticipos, cobros de alojamiento, varios, helados, adicionales, transferencias, gastos/retiros, fondo, efectivo esperado, conteo y diferencia. Registro del encargado, notas e informe CSV. Cargos a habitaciones aún no cobrados aparecen informativamente, fuera del efectivo.
9. **Tarifas y ajustes:** valores editables, inventario físico y catálogo de productos. Los registros históricos conservan el importe guardado.

## Tarifas verificadas contra fotografía

| Habitación | Sin desayuno | Con desayuno (referencia previa del hotel) |
|---|---:|---:|
| Individual con aire acondicionado | $20 | $25 |
| Matrimonial con aire acondicionado | $29 | $39 |
| Individual con ventilador | $17 | **Sin definir** |
| Matrimonial con ventilador | $23 | **Sin definir** |
| Doble con aire acondicionado | $30 | $45 |
| Triple con aire acondicionado | $40 | $55 |

Según el cartel entregado: **adicional por persona mayor de 12 años: $10; por niño mayor de 5 años: $5; entrada antes del check-in: $10**. El cartel indica que sus precios incluyen IVA. Como no se precisan todas las reglas sobre noches, edades y aplicaciones, estos cargos se muestran configurables y no se suman automáticamente. Los cargos concretos pueden anotarse con «Varios / ventas» y cargar a la cuenta correspondiente. La política de ingreso/salida conocida es check-in desde las 12:00 y check-out hasta las 14:00.

Las variantes «con desayuno» con A/C vienen del proyecto previo, no del último cartel fotografiado. Los precios de helados/lavandería no aparecen en el cartel de productos, por lo que siguen sin definir.

## Inventario físico identificado

- Individual/matrimonial con A/C (una habitación física, dos posibilidades de venta): **01, 02, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29** (19).
- Individual/matrimonial con ventilador: **07, 08** (2).
- Doble A/C: **03, 12** (2).
- Triple A/C: **04, 38** (2).
- Arrendadas: **05, 06, 09, 13, 23, 30, 101, 102** (8 únicas).

**Inconsistencia documental:** el inventario de arrendadas imprime el número `101` dos veces. Se almacena una sola vez hasta que recepción confirme si falta otra habitación. La triple señalada se interpretó como `38` tras ampliar la imagen; se recomienda verificarlo en sitio.

## Catálogo y cierre de caja

Los precios de **28 bebidas**, **20 productos de confitería** y **9 productos de aseo** se transcribieron del letrero del hotel. Se añadieron **13 sabores de helados** mencionados en el cuaderno de cierre, sin asignarles precio, y **Lavandería** sin precio fijo. Algunos nombres con caligrafía / impresión dudosa están rotulados como «por confirmar». Se pueden editar los importes sin cambiar el código.

**Flujo sugerido:**

1. Configurar el catálogo y realizar el primer **conteo físico** de los productos.
2. Registrar cada consumo como **venta directa** o **cargo a habitación**. Indicar turno y trabajador.
3. Registrar reposiciones, mermas y nuevos conteos.
4. Registrar anticipos y cobros por habitación con forma de pago y turno.
5. En «Cierre de caja», elegir día y turno, ingresar fondo inicial y efectivo contado, revisar la diferencia y guardar el arqueo. Exportar CSV como respaldo de pruebas.

**Criterio de caja:** los consumos cargados a una habitación **no son entrada de efectivo** por sí solos. Se reconoce el cobro cuando recepción registra el abono en «Salidas y cobros». Las transferencias se registran en su propia columna y no se agregan al efectivo esperado.

## Publicación

La carpeta `.github/workflows/pages.yml` publica automáticamente el contenido de `main` mediante GitHub Actions. El repo debe tener GitHub Pages configurado con origen **GitHub Actions**.

## Limitaciones y seguridad antes de producción

- Implementar autenticación y roles de trabajador, respaldos, base de datos central, HTTPS, bitácora/auditoría y protección de datos personales conforme al contexto normativo ecuatoriano.
- Validar disponibilidad simultánea con transacciones en servidor. `localStorage` solo evita conflictos dentro del mismo navegador.
- Integración de datos personales con fuentes gubernamentales solo mediante accesos legítimos, consentimiento y verificaciones aplicables. El SRI no proporciona, en general, números privados de teléfono o correo de una persona usando solamente su cédula.
- Integración de facturación SRI y reportes contables reales requerirá backend y validaciones fiscales; este prototipo no genera facturas.
- Confirmar con recepción reglas de cobros adicionales, listado de habitaciones y precios de productos que están pendientes.
- El cambio de clave `localStorage` de v0.1 a v0.2 reinicia **solo** los datos de demostración de v0.2; los datos de prueba previos de v0.1 no se eliminan automáticamente, pero no se utilizan en esta versión.

## Archivos

- `index.html`: estructura y navegación.
- `styles.css`: diseño adaptable a móvil y computadora.
- `app.js`: lógica de demostración, tarifas, catálogo, inventario y arqueo.
- `.nojekyll`: entrega estática en Pages.
- `.github/workflows/pages.yml`: despliegue automatizado.