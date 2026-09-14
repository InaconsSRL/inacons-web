# Performance

Checklist vivo de Core Web Vitals. Estado verificado contra el código el 14 set 2026.

**Cómo usarlo:** al implementar un fix, marcar el checkbox y anotar la fecha. Después de
desplegar, correr Lighthouse y actualizar la tabla. Una vez verificado en producción,
mover el ítem al Historial del final y borrarlo de pendientes. Si aparece un problema
nuevo, agregarlo como sección numerada antes del Historial.

Medir en incógnito, throttling "Mobile - Slow 4G", tras purgar caché de cPanel.

## Estado Lighthouse

| Métrica | Mayo 2026 | Objetivo | Después (fecha: ___) | Estado |
|---|---|---|---|---|
| Performance | 65 | ≥ 80 | — | ❌ |
| LCP | 3.2 s | < 2.5 s | — | ❌ |
| CLS | 0.474 | < 0.1 | — | ❌ crítico |
| FCP | 3.0 s | < 1.8 s | — | ❌ |
| Speed Index | 3.3 s | < 3.4 s | — | ⚠️ |
| TBT | 130 ms | < 200 ms | — | ✅ |
| Accessibility | 90 | — | — | ✅ |
| Best Practices | 100 | — | — | ✅ |
| SEO | 100 | — | — | ✅ |

La medición es de mayo 2026 y desde entonces se aplicaron fixes que no se han vuelto a
medir. **Re-medir antes de trabajar en esta lista** — algunos pendientes pueden estar
resueltos y otros números ya no ser reales.

## 1. CLS — 0.474 (crítico)

- [x] **Typewriter del H1** — resuelto con la técnica del ghost: cada palabra lleva un
      `.tw-ghost` invisible que reserva el ancho final, y `.tw-typed` se llena encima en
      `position:absolute`. No hay reflow.
- [ ] **Contadores animados** — `.stat-num` no tiene `min-width`. Al pasar de "0" a "96+"
      el número cambia de ancho y arrastra el layout. Fijar `min-width: 4ch`.
- [ ] **Video del hero sin dimensiones** — el `<video class="hero-video">` de
      `index.astro` no declara `width` ni `height`. Agregar `width="1920" height="1080"`.
      El contenedor `.home-hero` sí tiene `height: 100vh; min-height: 620px`, así que el
      impacto es menor de lo que parece, pero el elemento sigue sin ratio intrínseco.

## 2. LCP — 3.2 s

El elemento LCP es `image_heroprincipal.webp` (poster del video).

- [ ] Comprimir `image_heroprincipal.webp` — hoy 321 KB, objetivo < 150 KB (squoosh,
      calidad 75, method 4).
- [x] Preload con `fetchpriority="high"` en el head de `index.astro` — presente.
- [ ] Habilitar HTTP/2 en cPanel (Apache SpeedyON / MultiPHP Manager). Estimado:
      −300 a −400 ms en FCP y LCP.

## 3. Imágenes pesadas

| Imagen | Peso actual | Objetivo | Hecho |
|---|---|---|---|
| `image_nosotros.webp` | 636 KB | < 200 KB | [ ] |
| `image_mineria.webp` | 590 KB | < 200 KB | [ ] |
| `image_paisajismo.webp` | 519 KB | < 200 KB | [ ] |
| `image_obra_civiles.webp` | 346 KB | < 150 KB | [ ] |
| `image_infraestructura.webp` | 339 KB | < 200 KB | [ ] |
| `image_heroprincipal.webp` | 321 KB | < 150 KB | [ ] |
| `about_team.webp` | 299 KB | < 200 KB | [ ] |
| `image_electromecanica.webp` | 268 KB | < 200 KB | [ ] |

Receta: squoosh, WebP calidad 82 (75 para la del hero), redimensionar al ancho real de
uso antes de comprimir. Ver [contenido.md](contenido.md).

## 4. Caché de assets

- [x] **Hecho.** `public/.htaccess` ya tiene el bloque `mod_expires` completo: imágenes,
      CSS, JS y fuentes a 1 año; PDF a 6 meses; mp4 a 1 mes; HTML a 0 segundos. También
      hay compresión Deflate. Detalle en [deploy.md](deploy.md).

## 5. SVG del mapa

- [x] `peru-depts.svg` ya declara `width="166.806mm" height="241.381mm"` además del
      `viewBox`, así que tiene tamaño intrínseco.
- [x] `peru2.svg` estaba huérfano y **se borró** (set 2026), junto con otros cinco archivos
      que no referenciaba nadie.

Nota: el SVG se inyecta por JS dentro de `#peruMapContainer`, así que el CLS real
depende de que ese contenedor tenga altura reservada antes del fetch, no de los
atributos del archivo.

## 6. Accesibilidad

### Contraste

- [x] **`.sh-desc` resuelto.** Usa `--c-text-muted`, que el bloque de tokens llevó de
      `#6b7494` a `#5a6280`: 6.01:1 sobre blanco y 5.40:1 sobre muted. Sobre oscuro usa
      `--c-on-dark-2` (9.52:1). Falta solo confirmarlo con Lighthouse.
- [ ] **Texto sobre el video del hero.** `.stat-label` (`index.astro:98`) y `.scroll-hint`
      (`:320-329`) usan `--c-on-dark-3`, cuyo 7.37:1 está calculado contra `--c-primary`
      sólido. El fondo real ahí no es plano: `.hero-overlay` (`:56-63`) solo aporta 30% de
      opacidad en la zona alta y el velo diagonal se va a `transparent`, así que debajo de
      las cifras está el frame del video. El ratio depende del contenido y no está
      garantizado. `.scroll-hint` además baja a `opacity: 0.55` en reposo.

### Targets táctiles bajo 44 px

`.btn` no declara `min-height` y ninguna media query lo corrige en móvil.

| Elemento | Alto real | Visible en móvil |
|---|---|---|
| `.btn` base (`design-system.css`) | 37 px | sí |
| `.btn-sm` | 28 px | sí |
| `.mobile-menu-close` | 40 px | solo móvil |
| `.footer-social a` | 36 px | sí |
| `.mobile-menu-socials a` | 30 px | solo móvil |
| `.clients-pause-btn` (`index.astro:274`) | 32 px | sí |

`.btn-lg` (46 px) y `.menu-toggle` (44×44) cumplen. `.top-bar-social a` (28 px) y
`.hero-pause-btn` (36 px) están ocultos en móvil, así que no cuentan.

### Imágenes sin `width`/`height` — 11 de 49

Generan layout shift: `nosotros.astro:54,107`; `sostenibilidad.astro:95,106`;
`servicios/index.astro:47,107,117`; `proyectos/index.astro:45`;
`proyectos/[slug].astro:63,69,110`.

Las dos de `sostenibilidad.astro` tampoco tienen `loading="lazy"`, y `seguridad.PNG` es el
único PNG que nunca se migró a WebP. `MediaCard` está bien: `width` y `height` son props
obligatorias.

## Historial

| Fecha | Optimización |
|---|---|
| Set 2026 | Limpieza: seis imágenes huérfanas (684 KB), nueve clases y dos tokens sin uso, y los dos alias heredados de texto sobre oscuro |
| Set 2026 | Bloque de tokens en `design-system.css`: de 65 tamaños de fuente, 106 paddings y 122 `rgba()` sueltos a una sola fuente de verdad, con contrastes verificados |
| Set 2026 | Caché y compresión en `.htaccess` (`mod_expires` + `mod_deflate`) |
| Set 2026 | Cabeceras de seguridad en `.htaccess` (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) |
| Set 2026 | Swiper eliminado por completo — ya no se carga ni CSS ni JS del carrusel |
| Set 2026 | Typewriter sin CLS mediante ghost que reserva el ancho |
| Jun 2026 | Menú móvil rediseñado: iconos SVG, botones CTA, brochure, RRSS |
| Jun 2026 | Fix móvil: hero 100 vh, título sin corte, CTA en columna |
| Jun 2026 | Video del hero comprimido 10.6 MB → 4.6 MB (HandBrake, H.264, RF 32) |
| May 2026 | PNG → WebP en todas las imágenes (~90% de reducción) |
| May 2026 | AOS eliminado, reemplazado por IntersectionObserver + `scroll-animations.css` |
| May 2026 | Lucide UMD y Font Awesome eliminados, reemplazados por SVG inline |
| May 2026 | Preload de la imagen LCP en `index.astro` |
| May 2026 | Google Fonts con carga asíncrona (no bloqueante) |
| May 2026 | Sitemap excluye `/recursos`, `/formulario` y `/expomina` |
