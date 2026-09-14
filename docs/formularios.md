# Formularios y captura de leads

Los formularios del sitio guardan en Google Sheets a través de Google Apps Script. Los
backends viven en `src/appscripts/`, uno por formulario. **No se compilan ni se
despliegan con el sitio**: están en el repo para versionarlos, pero el código que corre
es el que está pegado en el editor de Apps Script.

| Archivo | Formulario |
|---|---|
| `amonestacion.js` | `/formulario/amonestaciones/` |
| `expomina.js` | `/expomina/` |
| `expomina-avisos.js` | Notificaciones del formulario de Expomina |

## Las tres trampas del despliegue

Costaron horas al montar el backend de Expomina (9 set 2026). Las tres fallan de forma
que *parece* que funciona.

**1. "Quién tiene acceso" debe ser `Cualquier usuario`**, no `Cualquier usuario con una
Cuenta de Google`. La segunda devuelve 403 a quien no tenga sesión iniciada — y como el
dueño sí la tiene, al probarlo desde su propio navegador todo se ve bien.

**2. Guardar (Ctrl+S) no actualiza la URL `/exec`.** Esa URL sirve la última *versión
publicada*, no el código guardado. Tras editar: Administrar implementaciones → lápiz →
Versión: **Nueva versión** → Implementar. Si no se hace, el síntoma es
`No se encontró la función de la secuencia de comandos: doGet`.

**3. Nunca crear una implementación nueva para actualizar.** Cambia la URL `/exec` y el
formulario ya publicado deja de guardar, sin error visible en ningún lado. Editar
siempre la implementación existente.

## Probar un backend

`doGet` y `doPost` no se pueden ejecutar desde el editor: esperan el objeto `e` de una
petición HTTP real y dan "error desconocido". Por eso cada backend lleva una función
`probar()` que sí corre a mano — y que además dispara la pantalla de autorización,
obligatoria porque el script corre como "Ejecutar como: Yo".

Verificar siempre desde fuera antes de dar el despliegue por bueno:

```bash
curl -sL "<url>/exec?action=count"
```

Debe devolver JSON. Si devuelve HTML, es la pantalla de login o de error de Google.

## Expomina 2026

Feria del 9 al 11 de setiembre de 2026 en Lima. La captura de leads en el stand se hacía
con un QR en una esquina del video que corría en la pantalla.

URL del QR: **`https://home.inacons.com.pe/expomina/`** (`src/pages/expomina.astro`).
Directa, sin pasar por el QR dinámico de `/empresa/`.

Se descartó la ruta corta `/r/e` para este caso porque metía dos redirecciones y hacía
que la URL congelada en el video dependiera de un registro en MySQL, del panel y de
`mod_rewrite`. **La capa dinámica sirve cuando el destino es de un tercero; si la página
es nuestra, se arregla la página en su propia URL.** Además `/expomina/` se puede leer y
teclear: es el plan B si el QR no escanea.

### QR para video ≠ QR impreso

El códec de video destruye los bordes finos. Las reglas cambian:

- **URL corta.** Menos módulos significa módulos más grandes, que sobreviven la
  compresión. Para eso existe la regla `/r/CODIGO` en `public/.htaccess`:
  `https://home.inacons.com.pe/r/e` son 31 caracteres → 25×25 módulos.
- **Negro puro**, no el azul corporativo.
- **ECC nivel M**, no H. H mete ~30% más módulos y en una pantalla no hay suciedad ni
  desgaste contra los que proteger.
- **Exportar a 1200 px.** El `admin.php` antiguo sacaba el PNG del preview de 220 px.
- Para quien edite el video: esquina fija, ≥ 8 s en pantalla, ≥ 10% del alto del frame,
  fondo blanco sólido con margen, sin animación ni movimiento detrás.

El panel `/empresa/admin.php` tiene un selector Pantalla/video vs. Impresión que aplica
color y ECC correctos según el destino.

## Pendiente: política de privacidad

**No existe la página.** El formulario de Expomina lleva casilla de consentimiento pero
sin enlace, porque no hay a dónde apuntar. Riesgo asumido por tiempo frente a la Ley
29733 de protección de datos personales. Es un pendiente real, no una nota.
