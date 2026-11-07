# Integración Supabase — Hotel Unicornio

**Estado:** diseño preparado, **sin conexión ni datos reales**. Esta rama `integracion-supabase` no se publica en GitHub Pages (el sitio usa `main`).

- `schema.sql`: definición de 13 tablas operativas, inventario inicial (33 habitaciones) y catálogo (71 productos), tarifas y reglas de acceso RLS.
- Los registros personales **no** están en GitHub: solo se incluyen habitaciones, precios y productos.
- Para crear la base de datos se necesita que el responsable indique en qué organización de Supabase crear el proyecto y confirme cualquier costo no nulo.
- Creación de usuarios por Supabase Auth. Primer administrador activado por el propietario a través de un procedimiento autenticado o SQL administrativo; **nunca** mediante registro libre.
- No publicar secretos, contraseñas ni claves `service_role` en el repositorio, HTML o JavaScript.
- Las funciones de ventas/stock, registro y reservas deben ser transaccionales antes de operar con varias recepciones simultáneas.
- Antes de tratar cédulas reales: aviso de privacidad, mínimo acceso, respaldos/restauración, auditoría y política de retención.
- Al contar con el proyecto: aplicar una migración revisada, probar políticas RLS, obtener URL/clave pública, implementar login y adaptar los módulos progresivamente.

**Nota:** No ejecutar este archivo en otro proyecto que ya contenga tablas con estos nombres. Validar con un entorno de prueba primero.
