# Códigos QR y formularios

## El sistema de QR

Tres piezas, cada una con un trabajo:

| Pieza | Dónde corre | Qué hace |
|---|---|---|
| **Módulo** | Navegador y build | Genera el símbolo: SVG, PNG, hoja de impresión |
| **Redirector** | PHP en cPanel | Resuelve `/r/CODIGO`, registra el escaneo y hace el 302 |
| **Panel** | Navegador, con sesión | Administra los códigos |

La razón de que exista la capa intermedia: **el destino se puede cambiar sin reimprimir
nada, y el código se puede conservar aunque cambie todo lo demás.** Un QR que apunta
directo a `/empleados/juan-perez` muere el día que hay que corregir ese slug; uno que
apunta a `/r/A7F3K` no.

### `src/lib/qr.ts` — única fuente

Ningún otro archivo del repositorio instancia una librería de QR. Se verifica con:

```bash
grep -rn "from 'qrcode'" src/ --include=*.ts --include=*.astro
```

Tiene que devolver solo `src/lib/qr.ts`.

La regla existe porque ya se rompió tres veces: `admin.php` razonó bien los parámetros y
se los quedó para sí, `/recursos/` no heredó nada y descargaba el preview de 220 px, y el
QR de Expomina se hizo con una herramienta externa que no dejó fuente — hoy nadie puede
regenerarlo igual.

#### Los dos perfiles

Portados de `admin.php` sin cambios:

| Perfil | Color | ECC | Para qué |
|---|---|---|---|
| `pantalla` | `#000000` | M | Video, proyección, diapositivas |
| `impresion` | `#1a3a5c` | H | Papel, credenciales, flyers |

El azul recorta margen de lectura respecto del negro puro, y por eso lleva ECC H, que
agrega ~30% de módulos redundantes. En pantalla no hay suciedad ni desgaste contra los que
proteger, así que negro puro con ECC M basta y da un símbolo menos denso.

Ese azul **no sale de un token del sistema de diseño**, y es a propósito: no es un color
de interfaz sino un parámetro de legibilidad mecánica. `--c-secondary` es más claro y
recorta todavía más el margen del escáner. Si alguna vez hay que tocarlo, se decide
midiendo lecturas, no mirando la paleta.

#### La URL se codifica en MAYÚSCULAS

El modo alfanumérico del estándar solo admite `0-9 A-Z espacio $ % * + - . / :`. Con una
sola minúscula el codificador cae a modo byte, que gasta 8 bits por carácter en vez de
5,5. Medido sobre `/r/A7F3K`:

| | minúsculas | MAYÚSCULAS |
|---|---|---|
| ECC M | 29×29 (v3) | **25×25** (v2) |
| ECC H | 37×37 (v5) | **29×29** (v3) |

En ECC H son 22% menos módulos por lado. A igual tamaño impreso cada módulo es más grande,
y el tamaño del módulo es lo que decide si un teléfono lo lee de lejos.

> **Esto tiene una consecuencia que ya rompió el sistema entero.** Si el QR codifica
> `/R/CODIGO`, la regla de `mod_rewrite` **tiene que llevar `[NC]`**. Sin eso, `^r/` no
> engancha con `/R/` y Apache devuelve 404 antes de que el PHP llegue a ejecutarse: el
> código existe, la base está bien, el redirector funciona, y solo falla lo que sale de un
> escaneo real. Todas las pruebas con minúsculas pasan.

**Se codifica en mayúsculas, se muestra en minúsculas.** `urlDeCodigo()` devuelve la forma
que va dentro del símbolo; `urlLegible()` la que se le enseña a una persona. En pantalla
las mayúsculas parecen un error, y en la hoja impresa son más incómodas de teclear justo
cuando alguien recurre a ellas porque el QR no escaneó.

#### Logo al centro

Opcional, y **solo con ECC H**. Pedirlo sobre el perfil de pantalla lanza un error en vez
de generar un código frágil que escanea en el monitor y falla sobre papel.

Funciona porque el estándar guarda información redundante para sobrevivir al desgaste.
Tapar el centro **consume** parte de ese margen; no lo crea. Medido pintando manchas de
2×2 módulos solo sobre datos —evitando los patrones de localización, que ninguna
corrección recupera— y decodificando hasta el punto de fallo:

| logo | aguanta |
|---|---|
| sin logo | 12 manchas |
| 0.20 (por defecto) | 6 manchas |
| 0.28 (tope) | 4 manchas |
| 0.40 | 4 manchas |

El logo se come **la mitad del margen** antes de que pase nada en el mundo real. El tope
no está donde deja de leerse —a 0.40 todavía se lee limpio— sino donde deja de quedar
margen para un doblez, un reflejo o tinta corrida. Un QR que solo escanea en condiciones
perfectas es un QR que falla en el stand.

La geometría del logo va escrita en el módulo y no se lee de `/favicon.svg`. Es
obligatorio: el PNG se rasteriza dibujando el SVG desde un `data:` URI, y ahí una
referencia externa no carga — el logo desaparecería **solo en el PNG**, justo en el
formato que va a la imprenta.

#### Exportación

- **SVG** es el formato primario: no tiene resolución propia, así que el mismo símbolo
  sirve para una miniatura y para un pliego A3.
- **El PNG se rasteriza desde el SVG**, nunca se escala un preview. Ese era el bug de
  `/recursos/`: descargaba la imagen de 220 px del modal estirada al tamaño final, y un QR
  interpolado pierde el borde neto entre módulos — que es justo lo que el lector usa para
  reconstruir la cuadrícula. Se veía bien en pantalla y fallaba sobre papel.
- **El lado se ajusta al múltiplo exacto del número de módulos.** Pedir 1200 px sobre un
  lienzo de 41 módulos da 29,2683 px por módulo, así que el rasterizador reparte 29 a unos
  y 30 a otros. Medido sobre la salida real: a 1200 px conviven anchos de 29 y 30; a 1189
  (29 × 41) todos miden 29.
- **Píxeles por módulo mínimos:** 20 en impresión, 8 en pantalla. Es lo que decide la
  nitidez, y no cambia porque la imagen sea más grande: un PNG enorme con 3 px por módulo
  sigue siendo papilla. Impresión pide más porque tiene que sobrevivir a una reducción en
  maquetación que nadie avisa.
- **Zona de silencio de 4 módulos**, dentro del `viewBox`. Viaja con la imagen, así que
  nadie puede pegarle texto a ras aunque quiera.
- **Máscara:** selección automática, la del estándar. Cada código sale con la suya según su
  contenido y su ECC. Fijarla renunciaría a la optimización sin ganar nada.

### `public/r/index.php` — el redirector

Resuelve, registra y redirige. Nada más: no tiene lógica de negocio y no sabe qué es un
evento o un empleado.

**No guarda ningún secreto.** No consulta tablas: llama a `resolver_qr()`, que es
`SECURITY DEFINER` y solo responde por un código que ya conoces — lo que hace un escáner.
No hay forma de pedirle la lista. Por eso le alcanza con la clave publicable, la misma que
ya viaja en el JavaScript del sitio. Con un `SELECT` sobre `qr_codes` bastaría una
petición para llevarse el catálogo entero de destinos.

**Consulta en vivo, sin caché.** Medido desde el propio servidor: 69–87 ms contra
Supabase. Una sola fuente de verdad y ninguna ventana en la que un destino recién cambiado
siga mandando al sitio viejo.

**Propaga el origen solo a destinos propios.** `?o=CODIGO` sirve para conectar un escaneo
con lo que la persona hizo después: con tres QR llevando al mismo formulario, es lo único
que dice cuál trajo las inscripciones. Pero eso requiere que la página lo lea, y un sitio
de terceros no sabe qué es. Añadirlo ahí solo modifica la URL de otro sin motivo.

**La página de error es el mismo diseño que `/404`**, y es autónoma: no depende de ninguna
hoja de estilos externa. Quien llega ahí acaba de escanear algo impreso que le dieron en
la mano, y un fallo de red le sumaría un segundo problema al que ya tiene.

### Reglas del ciclo de vida

- **Nunca se borra un código, solo se desactiva.** Un código borrado cuyo QR está impreso
  deja papel que nadie puede arreglar. El panel no tiene botón de borrar.
- **Nunca se imprime un QR que codifique la URL final.** Ni para empleados. Todo lo
  impreso pasa por `/r/`. Las URLs bonitas son para compartir por chat o correo, donde no
  hay nada físico que actualizar.
- **Cada código marca si está en material impreso.** Antes de reasignar, hay que saber si
  eso afecta papel circulando o solo un enlace en un correo.
- **Resolución tolerante:** insensible a mayúsculas y al tipo de guión. `canal_etico`,
  `CANAL-ETICO` y `Canal_Etico` son el mismo código. El guión bajo se apoya en la línea
  base, desaparece bajo un subrayado y a tamaño chico es indistinguible del medio; un
  índice único sobre la forma normalizada impide crear dos que solo se diferencien en eso.
- **Allowlist de destinos.** Vive en `configuracion.hosts_permitidos`, no en PHP. Con la
  lista en dos sitios, el día que alguien agregue un dominio desde el panel el redirector
  seguiría rechazándolo, con el síntoma "guardé el destino y no funciona" y ningún error
  que lo explique.

## Formularios

### Apps Script — retirado del repositorio (set 2026)

Los formularios guardaban en Google Sheets a través de Google Apps Script. El código —
`src/appscripts/expomina.js` y `expomina-avisos.js` — se borró del repositorio en la
limpieza posterior a la Fase 0: ya no se guarda como histórico, se retiró entero.

**Borrar el código del repositorio no cierra el Web App.** Vive en Google, no aquí. La
implementación de `expomina.js` tenía `CAPTURA_ABIERTA = false` y su `doPost` respondía
`{ok:false}` — pero mientras la implementación siga publicada, la URL `/exec` sigue
respondiendo. Cerrarla es una acción manual: Apps Script → Implementar → Administrar
implementaciones → archivar. Ver `docs/ESPECIFICACION.md` §14 para el registro de si ya
se hizo, tanto para Expomina como para el endpoint de amonestaciones (más grave: ese
devolvía datos sin autenticación — ver `_archivo/README.md`).

Si algún día se vuelve a necesitar un Web App, la trampa que más cuesta es esta:
**guardar con Ctrl+S no actualiza la URL `/exec`**, que sirve la última *versión
publicada*. Hay que ir a Administrar implementaciones → lápiz → Nueva versión. Y **nunca
crear una implementación nueva para actualizar**: cambia la URL y el formulario deja de
guardar sin error visible.

La Fase 4 reemplaza todo esto por un formulario único contra Supabase, con notificación
por trigger.

### El formulario de contacto no registra nada

`contacto.astro` arma un `mailto:`. Si el visitante no tiene cliente de correo
configurado, **el lead se pierde en silencio**. Es un pendiente real.

## Pendiente: política de privacidad

**No existe la página.** Expomina llevaba casilla de consentimiento sin enlace, porque no
hay a dónde apuntar.

Tiene que existir **antes** de publicar el primer formulario activo de la Fase 4, y cada
inscripción guarda la versión del texto que aceptó — es lo único que permite demostrar
después a qué dijo que sí una persona. Ley 29733.
