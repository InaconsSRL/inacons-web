# Archivo

Código retirado de producción que se conserva por trazabilidad. **Astro no lo
compila**: todo lo que vive en `src/pages/` se publica, y por eso lo archivado sale
de ahí en lugar de quedarse con un flag.

Nada de esta carpeta debe volver a `src/` sin revisar por qué salió.

Hoy no hay nada archivado aquí — ver más abajo lo que se retiró y por qué.

## `formulario-amonestaciones/` — borrado, no archivado (set 2026)

Prueba descartada de un flujo de memorandos y amonestaciones. Se movió aquí en la
Fase 0 y se borró del todo en la limpieza posterior: exponía datos laborales sin
autenticación real —el PIN de acceso quedó en el JavaScript del cliente sin cambiar
del ejemplo (`1234`/`5678`/`9012`), y no protegía nada porque `doGet(?action=get)`
devolvía **todas** las filas —nombre del trabajador, tipo de sanción, descripciones,
faltas graves— sin comprobar sesión.

**Borrar el archivo del repositorio no cierra el endpoint.** El Web App vive en
Google, no aquí. Mientras su implementación siga activa, la URL `/exec` —que estuvo
en el código fuente de este archivo, y por lo tanto en el historial de git— sigue
respondiendo con los mismos datos. Cerrarlo es una acción manual en el editor de
Apps Script: **Implementar → Administrar implementaciones → archivar la
implementación.** Registro de si ya se hizo: `docs/ESPECIFICACION.md` §14.
