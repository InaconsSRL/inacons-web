/*
  main.ts — comportamiento compartido por todas las páginas.
  ─────────────────────────────────────────────────────────────────
  BaseLayout lo importa en un <script> procesado: Astro lo empaqueta,
  lo minifica y le pone hash, y sale como módulo (diferido).

  Cada init* se ejecuta aislado: un error en uno no impide que corran
  los demás. Antes iban en serie y un fallo en el botón de pausa dejaba
  la página sin mapa, sin aviso.
*/

const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const comportamientoScroll: ScrollBehavior = reducirMovimiento ? 'auto' : 'smooth';

/* ─── Animaciones de entrada (data-aos) ─── */
function initScrollAnimations() {
  const elementos = document.querySelectorAll<HTMLElement>('[data-aos]');
  if (!elementos.length) return;

  const observer = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      const el = entrada.target as HTMLElement;
      const { aosDuration, aosDelay } = el.dataset;
      if (aosDuration) el.style.setProperty('--aos-duration', `${aosDuration}ms`);
      if (aosDelay) el.style.setProperty('--aos-delay', `${aosDelay}ms`);
      el.classList.add('aos-animate');
      observer.unobserve(el);
    }
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  elementos.forEach((el) => observer.observe(el));
}

/* ─── Typewriter del hero ─── */
function initTypewriter() {
  const palabras = [...document.querySelectorAll<HTMLElement>('.word.typewriter')];
  if (!palabras.length) return;

  const escribir = (palabra: HTMLElement, texto: string) => {
    const destino = palabra.querySelector('.tw-typed');
    if (!destino) return;
    if (reducirMovimiento) {
      destino.textContent = texto;
      return Promise.resolve();
    }
    return new Promise<void>((listo) => {
      palabra.classList.add('typing');
      let i = 0;
      const intervalo = setInterval(() => {
        destino.textContent = texto.slice(0, ++i);
        if (i < texto.length) return;
        clearInterval(intervalo);
        palabra.classList.remove('typing');
        setTimeout(listo, 300);
      }, 60);
    });
  };

  setTimeout(async () => {
    for (const palabra of palabras) await escribir(palabra, palabra.dataset.text ?? '');
  }, reducirMovimiento ? 0 : 800);
}

/*
  ─── Contadores ───
  El contrato es [data-counter] (más data-prefix y data-suffix opcionales).
  El HTML ya trae la cifra final: sin JS o con movimiento reducido se queda así.
*/
function initCounters() {
  const contadores = document.querySelectorAll<HTMLElement>('[data-counter]');
  if (!contadores.length || reducirMovimiento) return;

  const animar = (el: HTMLElement) => {
    const objetivo = Number.parseInt(el.dataset.counter ?? '', 10);
    if (!Number.isFinite(objetivo)) return;
    const { prefix = '', suffix = '' } = el.dataset;
    const duracion = 1800;
    let inicio = 0;

    const paso = (t: number) => {
      inicio ||= t;
      const progreso = Math.min((t - inicio) / duracion, 1);
      const valor = Math.floor((1 - (1 - progreso) ** 3) * objetivo);
      el.textContent = `${prefix}${progreso < 1 ? valor : objetivo}${suffix}`;
      if (progreso < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };

  const observer = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      animar(entrada.target as HTMLElement);
      observer.unobserve(entrada.target);
    }
  }, { threshold: 0.3 });

  contadores.forEach((c) => observer.observe(c));
}

/* ─── Menú móvil (acordeón + trampa de foco) ─── */
function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('mobileMenu');
  const cerrar = document.getElementById('mobileMenuClose');
  if (!toggle || !menu) return;

  const ENFOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let trampa: ((e: KeyboardEvent) => void) | null = null;

  const resetDesplegables = () => {
    menu.querySelectorAll('.mobile-dropdown').forEach((d) => {
      d.classList.remove('open');
      d.querySelector('.mobile-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  };

  const abrir = () => {
    menu.classList.add('active');
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    resetDesplegables();

    const enfocables = [...menu.querySelectorAll<HTMLElement>(ENFOCABLES)]
      .filter((el) => getComputedStyle(el).display !== 'none');
    const primero = enfocables[0];
    const ultimo = enfocables.at(-1);
    trampa = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero?.focus(); }
    };
    menu.addEventListener('keydown', trampa);
    cerrar?.focus();
  };

  const cerrarMenu = () => {
    menu.classList.remove('active');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    resetDesplegables();
    if (trampa) menu.removeEventListener('keydown', trampa);
    trampa = null;
    toggle.focus();
  };

  toggle.addEventListener('click', abrir);
  cerrar?.addEventListener('click', cerrarMenu);
  menu.querySelector('.mobile-menu-overlay')?.addEventListener('click', cerrarMenu);
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMenu));

  menu.querySelectorAll('.mobile-dropdown').forEach((desplegable) => {
    const boton = desplegable.querySelector('.mobile-dropdown-toggle');
    boton?.addEventListener('click', (e) => {
      e.preventDefault();
      boton.setAttribute('aria-expanded', String(desplegable.classList.toggle('open')));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) cerrarMenu();
  });
}

/* ─── Header: se oculta al bajar, vuelve al subir ─── */
function initHeaderScroll() {
  const header = document.getElementById('header');
  const topBar = document.querySelector('.top-bar');
  if (!header) return;

  let ultimoY = 0;
  let pendiente = false;

  window.addEventListener('scroll', () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (topBar && window.innerWidth >= 768) topBar.classList.toggle('hidden', y > 0);
      if (y > 80) {
        header.classList.toggle('hidden', y > ultimoY);
        header.classList.add('scrolled');
      } else {
        header.classList.remove('hidden', 'scrolled');
      }
      ultimoY = y;
      pendiente = false;
    });
  }, { passive: true });
}

/* ─── Volver arriba ─── */
function initBackToTop() {
  const boton = document.getElementById('backToTop');
  if (!boton) return;
  window.addEventListener('scroll', () => boton.classList.toggle('visible', window.scrollY > 400), { passive: true });
  boton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: comportamientoScroll }));
}

/* ─── Anclas #hash con desplazamiento suave, descontando el header ─── */
function initSmoothScroll() {
  const header = document.getElementById('header');
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const destino = document.querySelector<HTMLElement>(a.getAttribute('href') ?? '');
      if (!destino) return;
      e.preventDefault();
      const margen = (header?.offsetHeight ?? 80) + 20;
      window.scrollTo({ top: destino.offsetTop - margen, behavior: comportamientoScroll });
      destino.focus({ preventScroll: true });
    });
  });
}

/* ─── El top-bar solo existe en escritorio ─── */
function initResponsive() {
  const header = document.getElementById('header');
  const main = document.querySelector('.main');
  if (!header) return;
  const ajustar = () => {
    const escritorio = window.innerWidth >= 768;
    header.classList.toggle('with-topbar', escritorio);
    main?.classList.toggle('with-topbar', escritorio);
  };
  window.addEventListener('resize', ajustar, { passive: true });
  ajustar();
}

/* Alterna los dos iconos de un botón de pausa/reproducir. */
function pintarPausa(boton: Element, pausado: boolean) {
  boton.querySelector<HTMLElement>('.icon-pause')?.style.setProperty('display', pausado ? 'none' : 'block');
  boton.querySelector<HTMLElement>('.icon-play')?.style.setProperty('display', pausado ? 'block' : 'none');
}

/*
  ─── Carrusel de clientes ───
  Detenido por el usuario y pausado por hover son dos estados distintos: si
  no se distinguen, sacar el mouse reanuda lo que la persona pidió detener.
*/
function initClientsCarousel() {
  const pista = document.querySelector<HTMLElement>('.clients-track');
  if (!pista) return;
  const boton = document.getElementById('clientsPauseBtn');
  let detenido = reducirMovimiento;

  const aplicar = () => { pista.style.animationPlayState = detenido ? 'paused' : ''; };
  const pausarTemporal = () => { if (!detenido) pista.style.animationPlayState = 'paused'; };

  if (boton) {
    const rotulo = boton.querySelector('.clients-pause-label');
    const pintar = () => {
      boton.setAttribute('aria-pressed', String(detenido));
      pintarPausa(boton, detenido);
      if (rotulo) rotulo.textContent = detenido ? 'Reanudar' : 'Pausar';
    };
    boton.addEventListener('click', () => { detenido = !detenido; pintar(); aplicar(); });
    pintar();
  }
  aplicar();

  pista.addEventListener('mouseenter', pausarTemporal);
  pista.addEventListener('mouseleave', aplicar);
  pista.addEventListener('touchstart', pausarTemporal, { passive: true });
  pista.addEventListener('touchend', () => setTimeout(aplicar, 500), { passive: true });
}

/*
  ─── Vídeo del hero ───
  El <video> llega sin src: el póster es la imagen LCP y basta en móvil, con
  ahorro de datos o con movimiento reducido. Solo en escritorio se carga el
  vídeo (4,7 MB) y se le da botón de pausa.
*/
function initHeroVideo() {
  const video = document.querySelector<HTMLVideoElement>('.hero-video');
  const boton = document.getElementById('heroPauseBtn');
  if (!video?.dataset.src) return;

  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const conVideo = matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)').matches
    && !conexion?.saveData;
  if (!conVideo) return;

  video.muted = true;
  video.autoplay = true;
  video.src = video.dataset.src;
  video.play().catch(() => {});

  if (!boton) return;
  // El botón refleja lo que hace el vídeo, no lo que se le pidió: si el
  // navegador rechaza el autoplay, el icono queda en "reproducir".
  const sincronizar = () => {
    pintarPausa(boton, video.paused);
    boton.setAttribute('aria-label', video.paused ? 'Reproducir video' : 'Pausar video');
  };
  video.addEventListener('play', sincronizar);
  video.addEventListener('pause', sincronizar);
  boton.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  boton.hidden = false;
  sincronizar();
}

/*
  ─── Mapa de cobertura ───
  Las ciudades llegan en data-ciudades desde src/data/empresa.ts: el mismo
  dato que pinta la lista de al lado, sin una segunda copia aquí.

  El contenedor NUNCA puede estar en display:none: getBBox() sobre un
  elemento sin caja devuelve ceros y los pines desaparecen sin error.
*/
interface Ciudad { idMapa: string; peso: number }

function initCoverageMap() {
  const contenedor = document.getElementById('peruMapContainer');
  if (!contenedor?.dataset.ciudades) return;
  const ciudades: Ciudad[] = JSON.parse(contenedor.dataset.ciudades);

  const NS = 'http://www.w3.org/2000/svg';
  const NARANJA = '#d9822b';
  const RELLENO = ['', 'rgba(27,82,120,0.22)', 'rgba(27,82,120,0.30)', 'rgba(27,82,120,0.40)', 'rgba(27,82,120,0.52)'];
  const RADIO = ['', 150, 180, 220, 290];

  const circulo = (cx: number, cy: number, r: number, opacidad: number) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', NARANJA);
    c.setAttribute('opacity', String(opacidad));
    return c;
  };

  const pulso = (cx: number, cy: number, radioMax: number, inicio: number) => {
    const c = circulo(cx, cy, 0, 0);
    for (const [atributo, valores] of [['r', `0;${radioMax}`], ['opacity', '0.60;0']]) {
      const a = document.createElementNS(NS, 'animate');
      a.setAttribute('attributeName', atributo);
      a.setAttribute('values', valores);
      a.setAttribute('dur', '2.6s');
      a.setAttribute('begin', `${inicio}s`);
      a.setAttribute('repeatCount', 'indefinite');
      c.appendChild(a);
    }
    return c;
  };

  fetch('/assets/imagenes/peru-depts.svg')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((texto) => {
      contenedor.innerHTML = texto;
      const svg = contenedor.querySelector('svg');
      if (!svg) throw new Error('peru-depts.svg no trajo un <svg>');

      // Estilo inline y no en el CSS de la página: Astro le pega
      // data-astro-cid al selector, y este SVG inyectado nunca lo lleva.
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', contenedor.dataset.etiqueta ?? '');
      Object.assign(svg.style, { width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 8px 28px rgba(20,23,45,0.12))' });

      svg.querySelectorAll<SVGElement>('.fil0, .str0, .str1, .str2').forEach((p) => {
        if (p.classList.contains('fil0')) p.style.fill = 'rgba(20,40,80,0.10)';
        p.style.stroke = 'rgba(255,255,255,0.20)';
        p.style.strokeWidth = '55';
      });
      const titicaca = svg.querySelector<SVGElement>('#Titicaca');
      if (titicaca) titicaca.style.fill = 'rgba(27,82,120,0.38)';

      const pines = document.createElementNS(NS, 'g');
      svg.appendChild(pines);

      ciudades.forEach((ciudad, i) => {
        const depto = svg.querySelector<SVGGraphicsElement>(`[id="${ciudad.idMapa}"]`);
        if (!depto) return;
        depto.style.fill = RELLENO[ciudad.peso];

        const caja = depto.getBBox();
        if (!caja.width) return;
        const cx = Math.round(caja.x + caja.width / 2);
        const cy = Math.round(caja.y + caja.height / 2);
        const r = Number(RADIO[ciudad.peso]);

        pines.appendChild(circulo(cx, cy, Math.round(r * 2.2), 0.13));
        if (!reducirMovimiento) {
          const retraso = i * 0.45;
          pines.appendChild(pulso(cx, cy, r * 3.8, retraso));
          pines.appendChild(pulso(cx, cy, r * 3.8, retraso + 1.3));
        }
        pines.appendChild(circulo(cx, cy, r, 0.92));
      });
    })
    .catch((err) => console.warn('initCoverageMap: no se pudo pintar el mapa.', err));
}

/* ─── Indicador de scroll del hero ─── */
function initScrollHint() {
  document.querySelector('.scroll-hint')?.addEventListener('click', () => {
    window.scrollBy({ top: window.innerHeight * 0.88, behavior: comportamientoScroll });
  });
}

for (const init of [
  initScrollAnimations,
  initTypewriter,
  initCounters,
  initMobileMenu,
  initHeaderScroll,
  initBackToTop,
  initSmoothScroll,
  initResponsive,
  initClientsCarousel,
  initHeroVideo,
  initScrollHint,
  initCoverageMap,
]) {
  try {
    init();
  } catch (err) {
    console.warn(`${init.name} falló:`, err);
  }
}
