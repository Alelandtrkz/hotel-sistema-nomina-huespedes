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