Auditoría INACONS — home.inacons.com.pe

Base: commit 9f9e67b, build local exit 0 (22 HTML), Lighthouse 13.4.1 contra producción el 17-sep-2026, cabeceras HTTP reales vía curl.

Dos huecos en el encargo: Cliente ideal: [perfil] y Competidores: [2-3 URLs] llegaron sin rellenar. El análisis competitivo de la Fase 3.4 no lo hice — no invento competidores. Todo lo demás va completo. La Fase 3 asume el cliente ideal implícito en el código (contratante público y privado, minería, inmobiliaria); si el perfil real es otro, esa sección se recalibra.

Lo que no puedo verificar y no voy a suponer: el índice real de Google, si service_role ya se rotó, si quedan .php huérfanos en el FTP, y si la prueba física del QR impreso se hizo.

FASE 0 — Deriva de documentación

Tu sospecha es correcta. La documentación es de una calidad muy por encima de la media —razones escritas, no descripciones— pero va por detrás del código en puntos que importan.

#	Doc afirma	Código real	Gravedad
1	arquitectura.md:47,70 — public/empresa/ existe y "sigue en pie a propósito"	Borrado en fb1cfc7. Solo queda _local/empresa/config.php, ignorado	Alta — tu propio encargo partía de esta premisa
2	arquitectura.md tabla de rutas (14 filas)	Falta /mineria — página indexada y en el sitemap	Alta
3	arquitectura.md:34 — "schemas Zod de las 3 colecciones"	Son 4: certificaciones existe con 4 entradas	Media
4	arquitectura.md — /recursos ❌ noindex	index, follow + en sitemap (21bc8c). Correcto hoy, doc desactualizado	Media
5	ESPECIFICACION.md:§14 — "robots.txt bloquea /recursos/"	Ya no lo bloquea	Media
6	performance.md — CLS 0.474 crítico, Perf 65, LCP 3.2 s	Medido hoy: CLS 0.002–0.01, Perf home móvil 97, LCP 2.1 s	Alta — la lista de pendientes apunta al problema equivocado
7	performance.md — "caché corregida, /_astro/ inmutable"	Producción manda dos Cache-Control en conflicto; /_astro/ sale con max-age=86400, no inmutable	Alta
8	performance.md — "11 de 49 imágenes sin width/height"	12 de 48	Baja
9	CLAUDE.md regla 3 — contenido dinámico desde src/content/	/documentos/ hardcodea las 4 ISO (documentos.astro:187-227) teniendo la colección certificaciones con esos mismos datos	Media
10	CLAUDE.md regla 2 — "si un color no viene de un token, es un bug"	.footer-bottom usa rgba(255,255,255,0.35) crudo (design-system.css:1498,1509) — 3.21:1, falla AA, en todas las páginas	Alta

Lo que sí resistió la verificación: regla 1 (scoping CSS) — grep '\[data-astro-cid-[^]]*\] > \[data-astro-cid' dist/_astro/*.css devuelve cero. Regla 4 — #peruMapContainer no tiene ningún display:none (index.astro:462,608). Regla 7 — un solo import de qrcode. Regla 6 — RLS activo en las 12 tablas.

Inventario real

Páginas (22 HTML). Indexables 18 · noindex 4 (/panel/, /sistema/, /expomina/, /404).
Colecciones: servicios 6 · proyectos 2 · recursos 3 · certificaciones 4 (0 renderizadas).

Subsistema	Estado real
/panel/ Supabase	Vivo. Fase 3 a mitad: falta generación masiva, auditoría visible, tablero
/empresa/ PHP + MySQL	Muerto en el repo. Solo sobreviven 3 reglas de .htaccess que sostienen papel impreso
Redirector /r/	Vivo y correcto. Allowlist en BD, [NC], 302 real
Apps Script	Cerrados en el repo, pero ESPECIFICACION.md:§14 dice que el endpoint de amonestaciones sigue respondiendo — requiere acción en Google
Supabase	Vivo, plan gratuito + latido cada 3 días. Sin respaldos
FASE 1 — Técnico e indexación
Metadatos (leídos de dist/)

Los 22 títulos son únicos, las 22 descripciones son únicas, hay exactamente un <h1> por página y la jerarquía de encabezados no tiene saltos en ninguna. Eso está bien y es raro verlo. Los problemas son otros:

Problema	Evidencia
/mineria/ es una landing de EXPOMINA 2026 viva e indexada. H1: "INACONS presente en EXPOMINA 2026". La feria terminó el 11-sep; hoy es 17-sep. Cero enlaces internos la apuntan → huérfana en el sitemap	mineria.astro:391, sitemap-0.xml
Canibalización: /mineria/ y /servicios/mineria/ compiten por la misma intención, ambas indexadas	ambas en sitemap
/servicios/ se llama "Operaciones" en title, breadcrumb y H2, pero "Servicios" en el nav y en la URL. El title apunta a una palabra que nadie busca	servicios/index.astro:14,24,37
og:image idéntica en las 22 páginas, incluidas las fichas de proyecto que tienen foto propia	BaseLayout.astro:24
og:image declara 1200×630; el archivo real es 1920×1079 (ratio 1.78 vs 1.90). Además es WebP, formato que LinkedIn no rasca — y LinkedIn es tu canal B2B	image_heroprincipal.webp
404 canonicaliza al home (canonical=https://home.inacons.com.pe/). Es noindex así que el daño es bajo, pero es una señal equivocada	404.astro:12
/panel/ emite como H1 "Escanea el código o escribe la dirección…" — texto de la hoja de impresión filtrado al H1	dist/panel/index.html

Indexación: coherente. El filtro del sitemap, robots.txt y los meta robots dicen lo mismo. Ninguna página indexable está bloqueada y ninguna bloqueada está en el sitemap. /recursos/ está correctamente abierta ahora (solo el doc quedó atrás). Sin hreflang, correcto: un solo idioma.

Datos estructurados: un solo LocalBusiness en el layout (BaseLayout.astro:96-140), correcto y completo. Falta BreadcrumbList (hay breadcrumbs visuales sin marcar), Service en las 6 fichas y Organization con sameAs ampliado. hasCredential usa EducationalOccupationalCredential para normas ISO — semánticamente flojo pero inocuo.

Enlaces internos — 301 en cada clic
curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://home.inacons.com.pe/nosotros
# 301 -> https://home.inacons.com.pe/nosotros/

Los 55 enlaces internos del repo van sin barra final. Los 22 canonical la llevan. Cada navegación paga un 301, y cada enlace interno transmite autoridad a una URL que redirige. CLAUDE.md ya documenta la regla ("con barra final en lo nuevo… hoy ningún enlace del repo la lleva") — sigue sin aplicarse. No detecté enlaces rotos ni cadenas de más de un salto.

Rendimiento — medido hoy, no heredado
Página	Perf móvil	Perf esc.	LCP móvil	CLS	Peso
/	97	92	2.1 s	0.002	4 301 KiB
/servicios/	74	79	7.2 s	0.004	2 366 KiB
/proyectos/	90	93	3.3 s	0.009	—
/contacto/	77	86	5.8 s	0.007	864 KiB

TBT 0 ms en las ocho corridas. Best Practices 100 y SEO 100 en las ocho.

El CLS está resuelto (0.474 → ~0.005): la técnica del ghost funcionó. performance.md sigue tratándolo como crítico.

El problema real se mudó al interior del sitio. /servicios/ carga las seis imágenes de servicio sin comprimir: 636+590+519+346+339+268 KB ≈ 2,7 MB, y es la página que recibe el tráfico comercial. El home está bien porque tiene preload de LCP; las interiores no.

Compresión rota para JavaScript — causa raíz identificada:

curl -sSI -H 'Accept-Encoding: gzip' https://home.inacons.com.pe/assets/js/main.js
# Content-Length: 18029   (sin Content-Encoding)

El .htaccess declara AddOutputFilterByType DEFLATE application/javascript, pero el servidor entrega los .js como text/javascript. El filtro nunca engancha. CSS, HTML y SVG sí se comprimen (69 KB → 17 KB). Afecta también a ExpiresByType application/javascript y a /_astro/*.js (28 183 B crudos). Arreglo: añadir text/javascript a los dos bloques.

Caché: el fix documentado no llegó entero.

Cache-Control: no-cache, must-revalidate      ← .htaccess
Cache-Control: max-age=3600, public           ← el hosting, después

El unset corre y el hosting vuelve a añadir la suya. En cachés conformes no-cache gana, así que el problema de despliegues invisibles está probablemente mitigado — pero la respuesta sigue saliendo contradictoria. Peor: /_astro/ sale con public, max-age=31536000, immutable y max-age=86400, public. Los activos con hash, que son los únicos que pueden cachearse para siempre, no lo están.

Accesibilidad

Lighthouse: 91–100. Los fallos son sistemáticos, no anecdóticos.

Fallo	Detalle	Alcance
aria-prohibited-attr	Las 3 palabras del H1 del home llevan aria-label sobre un <span> sin rol — ARIA lo prohíbe y no se expone. Los dos hijos son aria-hidden. El H1 accesible queda como "CONSTRUIMOS · ESPACIOS · TRASCENDEMOS"	home
Sin JS, el H1 se ve roto	.tw-ghost { visibility: hidden } y .tw-typed vacío en el HTML → tres huecos en blanco	home
Contraste .btn-accent	Blanco sobre #d9822b = 2.92:1. Es el botón "Canal Ético" del pie	todas
Contraste pie	rgba(255,255,255,0.35) sobre #101224 = 3.21:1	todas
Contraste .process-num	#e3e6eb sobre #f0f3f7 = 1.12:1	/servicios/
Sin enlace de salto al contenido	WCAG 2.4.1	todas
12 de 48 <img> sin width/height	y 4 no son WebP (seguridad.PNG 395 KB, 3 .jpg)	6 páginas
#peruMapContainer	aria-label sobre <div> sin rol — ignorado	home

El contraste del pie merece un comentario aparte: arquitectura.md cuenta que se eliminaron los alias --c-text-white-45 precisamente por dar 4.45:1 y no pasar AA, y dice "no inventar alfas nuevas". El pie tiene un alfa inventado que da 3.21:1, peor que el que se eliminó, en todas las páginas. Es exactamente el bug que el sistema de tokens se creó para impedir.

Positivo verificado: :focus-visible global, alt en las 48 imágenes, labels correctos en el formulario, #peruMapContainer sin display:none en ningún breakpoint, iframe de YouTube con loading="lazy" y youtube-nocookie.

FASE 2 — Seguridad y datos

Esta es la parte mejor hecha del proyecto. Lo digo antes de las pegas porque es infrecuente.

Lo que está bien, verificado
RLS activo en las 12 tablas (0002_rls.sql:35-45, 0010:35). Modelo denegar-todo: el rol anon no tiene ni una política.
Doble cerrojo: revoke all … from anon sobre tablas, secuencias y funciones, más alter default privileges para que lo futuro nazca cerrado. Y el detalle que casi todos fallan: revocar a PUBLIC, no solo a anon, porque las funciones heredan EXECUTE de ahí.
Las 7 funciones SECURITY DEFINER fijan search_path = public, pg_temp. Ese es el vector clásico de escalada y está cerrado en todas.
administradores sin políticas a propósito, razonado.
Secrets limpios. git log --all sobre .env, _local/ y *config.php: cero commits. Solo .env.example, sin valores. Ninguna service_role ni PUBLIC_* sospechosa.
Open redirect cubierto — la allowlist vive en configuracion.hosts_permitidos y la extracción de host descarta usuario@ (0007:73-79), que es la trampa real (https://inacons.com.pe@evil.com/).
Cabeceras HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy confirmadas en producción.
Lo que falta
#	Hallazgo	Detalle
S1	/r/ permite escritura ilimitada en escaneos sin autenticación	resolver_qr() hace un INSERT por llamada y está concedida a anon. Un bucle de curl contra https://home.inacons.com.pe/r/X infla la tabla sin límite: contamina el tablero y puede agotar los 500 MB del plan gratuito. No hay rate limiting en ninguna capa
S2	Rotación de service_role pendiente y con fecha vencida	ESPECIFICACION.md:§14: "quedó expuesta durante la puesta en marcha… tiene que estar rotada antes de la Fase 4". No puedo verificar si se hizo
S3	Sin respaldos	El plan gratuito no tiene ninguno. §10 lo marca como requisito, no opcional. El latido evita la pausa; no devuelve una tabla borrada
S4	Sin Content-Security-Policy	El JWT del admin vive en localStorage (persistSession: true). Sin CSP, cualquier script inyectado lo exfiltra. Riesgo bajo hoy (no hay contenido de terceros en /panel/), barato de cerrar
S5	6 enlaces externos sin rel="noopener"	Los 6 canales Bitrix24 de canal-etico.astro:197-237. Los navegadores modernos lo implican, pero el resto del sitio sí lo pone: es una inconsistencia en la página de denuncias
S6	codigo_existe() es un oráculo de enumeración	El comentario de 0008 dice "no permite recorrer el catálogo". Con 5 caracteres y alfabeto reducido sí permite recorrerlo por fuerza bruta. No expone datos, sí la existencia. Severidad baja; la afirmación del comentario es optimista
S7	Endpoint de Apps Script de amonestaciones sigue vivo	Según §14. Devolvía todos los registros disciplinarios sin autenticación. Requiere archivar la implementación en Google — mover el código a _archivo/ no cierra nada
S8	Verificar residuos en el FTP	SamKirkland/FTP-Deploy-Action sin dangerous-clean-slate. /empresa/admin.php está protegido por el 301, pero /empresa/index.php?c=X no lo cubre ninguna regla: si el archivo sobrevivió en el servidor, se ejecuta. No puedo comprobarlo desde aquí

Los dos paneles ya no conviven — la premisa de tu encargo quedó atrás en fb1cfc7. La deuda técnica de esa convivencia está saldada; lo que queda es el 301 de /empresa/admin.php → /panel/, correctamente aplazado hasta cerrar la Fase 3.

FASE 3 — Estratégico
3.1 UX/UI — 7/10

Sistema de diseño real, con /sistema/ como referencia viva pintada con el CSS de producción. Nav coherente, menú móvil con focus trap, aria-current, alternancia claro/oscuro deliberada. Eso es sólido.

Lo que falla:

"Operaciones" vs "Servicios" — tres nombres para lo mismo en la misma página.
/contacto no está en el nav principal. Solo en una píldora del top-bar (que se oculta al bajar) y en el pie. La página de conversión no está en la navegación.
/mineria/ usa minimalChrome: sin nav, sin pie. Quien llegue desde Google queda en una página sin salida al sitio, salvo un enlace de texto "inacons.com.pe".
/contacto conserva su juego duplicado de estilos de formulario — 8 reglas (contacto.astro). arquitectura.md lo admite; es el último duplicado.
3.2 SEO on-page — 4/10

El H1 del home no contiene ni una palabra clave. "CONSTRUIMOS CONFIANZA / INNOVAMOS ESPACIOS / TRASCENDEMOS JUNTOS" es el eslogan. Ni "construcción", ni "ingeniería", ni "Perú". La propuesta de valor real está degradada a un <p> pequeño debajo. El activo on-page más valioso del sitio está gastado en un lema.

Contenido por debajo del umbral útil (palabras únicas, descontando nav y pie ~250):

Página	Únicas
/proyectos/	~77
/servicios/infraestructura/	~105
/servicios/obras-civiles/	~114
/servicios/consultoria/	~114
/	~344

Obras Civiles es el servicio nº1 por orden, es la categoría de los dos únicos proyectos, y es la ficha más delgada del sitio (57 palabras de Markdown, sin especialidades). Lo mismo Infraestructura y Consultoría. Con ese volumen no hay nada que posicionar.

Autoridad percibida: el activo más fuerte está apagado. Cuatro certificaciones ISO (9001/14001/45001/37001) y SellosCertificacion no emite nada — los cuatro .md tienen sello y vigencia comentados a la espera de los archivos del organismo. Verificado: grep 'sello\|certificacion' dist/nosotros/index.html → 0. Además hay 273 KB de logos ISO en public/assets/imagenes/logos/ que no referencia nadie. El bloqueo es una gestión con ACS International, no código.

Sin equipo directivo, sin prensa, sin casos de estudio, sin RUC ni datos registrales visibles.

3.3 Conversión — 3/10

El formulario de contacto no envía nada a ningún sitio.

contacto.astro:404-449: el submit construye un mailto: y hace clic en un <a> oculto. No hay action, no hay fetch, no hay backend. Y a continuación:

form.style.display = 'none';
successMsg.style.display = 'block';

Se oculta el formulario y se muestra "¡Listo!" sin comprobar que el cliente de correo abriera ni que la persona enviara nada. En un escritorio sin handler de mailto registrado —webmail, que es la mayoría— no ocurre absolutamente nada y el usuario ve un check verde. Además, si el mensaje pasa de 1800 caracteres, un alert() lo aborta.

Consecuencias: cero leads capturados, cero trazabilidad, cero remarketing, y un mensaje de éxito que no es cierto. Es la mayor fuga del sitio, y es especialmente frustrante porque la empresa ya tiene proveedor de formularios funcionando: los 6 canales de /canal-etico usan Bitrix24. El embudo comercial es lo único que no lo usa.

Lo demás:

Ningún CTA de contacto sobre el pliegue. El hero ofrece "Ver Proyectos" y "Descargar Brochure" (index.astro:524-525). La acción que genera negocio no aparece en la pantalla más valiosa.
Ruta de proveedores: no existe. Tu objetivo la nombra explícitamente. La palabra "proveedores" aparece una vez en todo el sitio, dentro de una frase del canal ético. No hay registro, ni requisitos, ni contacto de compras.
Sin política de privacidad. No existe /privacidad ni se menciona. El formulario pide nombre, correo y teléfono sin aviso. ESPECIFICACION.md:§7 la exige antes de cualquier formulario activo, y la Ley 29733 pide aviso previo.
El honeypot company_url no protege nada: no hay servidor que lo evalúe.
3.4 Contenidos — 4/10

Las cifras se contradicen entre páginas.

Cifra	Home	Nosotros	Minería	/proyectos/
Profesionales	100+	200+	200+	—
Proyectos	96+	150+	—	"Más de 150"

index.astro:665 vs nosotros.astro:41 y mineria.astro:421. Un contratante que compara dos páginas del mismo sitio encuentra el doble de plantilla en una que en otra. arquitectura.md cuenta que ya se corrigió una duplicación de cifras entre las secciones ② y ④ del home; la contradicción se mudó de nivel, de secciones a páginas.

"150+ km² construidos" (index.astro:657): 150 km² son 15 000 hectáreas, más que el distrito de San Isidro entero. Es casi seguro un error de unidad (m²). El público de esta web son ingenieros: lo van a notar, y desacredita las cifras que sí son ciertas.

La prueba no acompaña al alegato. /proyectos/ afirma "Más de 150 proyectos ejecutados" y muestra dos, ambos "Obras Civiles", y ambos con la misma galería de tres fotos genéricas (about_section.webp, about_team.webp, home_about.webp — las mismas imágenes de relleno del home, en los dos proyectos). El mapa de cobertura promete Huancayo 50+, Lima 25+, Pasco 6+. La cartera enseña dos. Para una empresa cuyo objetivo declarado es posicionarse como empresa con experiencia, la relación entre lo afirmado y lo demostrado es 150:2.

Contenido caducado y vivo: /mineria/ anuncia en presente una feria que terminó hace seis días, indexada y en el sitemap. /expomina/ sí está en noindex y con el texto en pasado — la página correcta está oculta y la caducada está expuesta.

FASE 4 — Entregable
Puntuación
Categoría	Nota	Justificación en una línea
Seguridad y datos	8/10	RLS ejemplar, secrets limpios, search_path fijado; falta CSP, rate limiting y respaldos
Arquitectura y mantenibilidad	7/10	Disciplina documental excepcional, pero la doc va por detrás en 10 puntos
UX/UI	7/10	Sistema de diseño real y coherente; nomenclatura inconsistente y /contacto fuera del nav
Rendimiento	6/10	CLS resuelto y home en 97; /servicios/ en 74 con LCP 7,2 s y JS sin comprimir
SEO técnico	6/10	Canonical/sitemap/robots coherentes y encabezados limpios; 301 en cada enlace y una huérfana indexada
Accesibilidad	6/10	91–100, pero dos fallos de contraste en todas las páginas y el H1 del home roto para lectores
Contenidos	4/10	Cifras contradictorias, "150 km²", 2 proyectos frente a 150 afirmados
SEO on-page	4/10	H1 sin una sola palabra clave, páginas comerciales de ~110 palabras
Conversión	3/10	El formulario no envía nada y miente al decir que sí

Global: 5.7/10. Una base técnica y de seguridad muy por encima de lo normal, sosteniendo una capa comercial que no convierte y un contenido que no demuestra lo que afirma.

Las 5 urgentes
Conectar el formulario de contacto a un backend real y no declarar éxito sin confirmación. Bitrix24 ya está en uso en /canal-etico: reutilizarlo cuesta horas, no semanas. Hoy la web no captura ni un lead.
Decidir qué es /mineria/. Si la campaña terminó: noindex + fuera del sitemap, como /expomina/. Si se reconvierte en landing comercial de minería: reescribir el H1, enlazarla desde el nav y resolver la canibalización con /servicios/mineria/.
Unificar las cifras y corregir "150+ km²". Una sola fuente para plantilla, proyectos y años. Es media hora y es lo que sostiene toda la credibilidad del resto.
Comprimir las imágenes de /servicios/ y /proyectos/ (2,7 MB en seis archivos) y añadir text/javascript a DEFLATE y ExpiresByType. LCP móvil de 7,2 s → objetivo < 2,5 s en la página comercial principal.
Barra final en los 55 enlaces internos. Un sed y un build. Elimina un 301 por cada clic y por cada señal de autoridad interna.
Plan priorizado

Bloque técnico

#	Acción	Impacto	Esfuerzo
T1	text/javascript en DEFLATE y ExpiresByType	Alto	Trivial
T2	Barra final en los 55 enlaces internos	Alto	Bajo
T3	Comprimir 8 imágenes > 260 KB (squoosh q82)	Alto	Bajo
T4	width/height en las 12 <img> que faltan; seguridad.PNG → WebP	Medio	Bajo
T5	noindex + fuera del sitemap en /mineria/, o reconversión completa	Alto	Bajo
T6	Contraste: token nuevo para el pie; .btn-accent a --c-accent-ink o texto oscuro	Alto	Bajo
T7	aria-label al <h1> en vez de a los <span>; sembrar .tw-typed en el servidor	Medio	Bajo
T8	Enlace de salto al contenido	Medio	Trivial
T9	og:image propia por página; versión JPEG 1200×630	Medio	Medio
T10	BreadcrumbList + Service JSON-LD	Medio	Bajo
T11	Resolver el doble Cache-Control con el hosting (/_astro/ no es inmutable)	Medio	Medio
T12	/documentos/ desde la colección certificaciones (regla 3)	Bajo	Medio
T13	Actualizar los 10 puntos de deriva documental	Bajo	Bajo

Bloque seguridad

#	Acción	Impacto	Esfuerzo
S-1	Rotar service_role si no se hizo — vencía antes de la Fase 4	Crítico	Trivial
S-2	Cerrar el endpoint de amonestaciones en Google	Crítico	Bajo
S-3	Respaldos de Supabase + una restauración probada	Crítico	Medio
S-4	Rate limiting en /r/ (por IP, en PHP o en la función)	Alto	Medio
S-5	Content-Security-Policy	Medio	Medio
S-6	rel="noopener" en los 6 enlaces Bitrix24	Bajo	Trivial
S-7	Verificar por FTP si quedan .php en /empresa/	Medio	Trivial
S-8	Plan de pago antes de imprimir el primer lote de QR (§13)	Alto	—

Bloque marketing y contenido

#	Acción	Impacto	Esfuerzo
M1	Backend real del formulario + éxito solo tras confirmación	Crítico	Medio
M2	Unificar cifras; corregir "150+ km²"	Crítico	Bajo
M3	CTA de contacto sobre el pliegue del home	Alto	Bajo
M4	Ruta de proveedores (registro, requisitos, contacto de compras)	Alto	Medio
M5	Política de privacidad versionada, enlazada desde todo formulario	Alto	Bajo
M6	8–10 proyectos reales con fotos propias — hoy hay 2 con galería de relleno	Alto	Alto
M7	Reescribir el H1 del home con la propuesta de valor; el eslogan baja a subtítulo	Alto	Bajo
M8	Ampliar Obras Civiles, Infraestructura y Consultoría a 400–600 palabras con especialidades	Alto	Medio
M9	Activar los sellos ISO — pedir archivos y vigencias a ACS International	Alto	Bajo (gestión)
M10	Unificar "Operaciones" → "Servicios"	Medio	Trivial
M11	/contacto en el nav principal	Medio	Trivial
M12	Equipo directivo y datos registrales (RUC) para autoridad	Medio	Medio

Qué queda fuera y por qué: el análisis competitivo (Fase 3.4) no se hizo — el encargo llegó con Competidores: [2-3 URLs] sin rellenar. Pásame dos o tres URLs y el perfil de cliente ideal y completo esa sección, que es además la que mejor calibraría las prioridades M6–M9.

Ejecutado un comando

Este lote reescribió los JSON. Confirmo que las cifras que reporté siguen siendo las de los archivos actuales.

Re-verified Lighthouse scores after rerun

Dos corridas completas, y hay varianza entre ellas. Corrijo las cifras que di como puntuales:

Página (móvil)	Corrida 1	Corrida 2	LCP
/	97	97	2.1 s / 2.1 s
/proyectos/	90	92	3.3 s / 3.2 s
/contacto/	77	76	5.8 s / 6.1 s
/servicios/	74	76	7.2 s / 5.9 s

En escritorio, /servicios/ pasó de 79 a 86 y /contacto/ se mantuvo en 86.

El "LCP 7,2 s" que destaqué era el pico de una sola corrida, no un valor estable. El rango real de /servicios/ en móvil es 5,9–7,2 s. Lo mismo /contacto/: 5,8–6,1 s. Son medidas contra un servidor en producción, así que la red entra en el número; para una cifra defendible harían falta 3–5 corridas y la mediana.

Nada de esto cambia el diagnóstico ni el orden de prioridades: /servicios/ y /contacto/ siguen siendo las dos peores en móvil, ambas muy por encima del umbral de 2,5 s, y la causa medida sigue siendo la misma —2,7 MB de imágenes sin comprimir en /servicios/ y el JS servido sin gzip—. El home sigue en 97 y el CLS sigue resuelto (0,001–0,01) en las dieciséis mediciones.

Con esa salvedad, el punto 4 de las urgentes queda: comprimir las imágenes y arreglar text/javascript en DEFLATE, con objetivo < 2,5 s y re-medir varias veces para fijar la línea base, que es justo lo que docs/performance.md pide y nadie hizo desde mayo.