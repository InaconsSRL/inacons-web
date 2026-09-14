# Archivo

Código retirado de producción que se conserva por trazabilidad. **Astro no lo
compila**: todo lo que vive en `src/pages/` se publica, y por eso lo archivado sale
de ahí en lugar de quedarse con un flag.

Nada de esta carpeta debe volver a `src/` sin revisar por qué salió.

## `formulario-amonestaciones/`

Prueba descartada de un flujo de memorandos y amonestaciones. Retirada en la Fase 0
(set 2026). Dos archivos: la página Astro y el backend de Google Apps Script.

**Se retiró porque exponía datos laborales sin autenticación real.** Tres cosas a la vez:

1. Los PIN de acceso eran los de ejemplo (`1234`, `5678`, `9012`), en JavaScript del
   cliente, visibles en el código fuente de la página publicada. El propio comentario
   decía "cambiar antes de publicar" y nunca se cambió.
2. El PIN no protegía nada, porque los datos no pasaban por él: `doGet(?action=get)`
   devolvía **todas** las filas —nombre del trabajador, tipo de sanción, descripciones,
   faltas graves— sin comprobar sesión. El PIN solo vivía en el navegador.
3. La URL `/exec` del backend estaba en el código fuente de la página pública.

Cualquiera que abriera el HTML obtenía la URL y con un `GET` se llevaba el historial
disciplinario completo.

### Mover estos archivos NO cerró el endpoint

El Web App vive en Google, no en este repositorio. Mientras su implementación siga
activa, la URL `/exec` responde aunque aquí no quede rastro.

Cerrarlo es una acción manual en el editor de Apps Script:
**Implementar → Administrar implementaciones → archivar la implementación.**

Comparar con `src/appscripts/expomina.js`, donde el mismo patrón se resolvió bien: su
`doGet` devuelve solo un conteo, nunca las filas.
