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