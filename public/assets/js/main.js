/*
  main.js — INACONS v4.1
  ─────────────────────────────────────────────────────────────────
  · Sin Lucide UMD (iconos SVG inline en HTML)
  · Animaciones scroll: IntersectionObserver (data-aos)
  · Menú móvil + acordeón Operaciones + focus trap accesible
  · Cargado con defer
*/

document.addEventListener('DOMContentLoaded', function () {

  /* ─── 1. ANIMACIONES DE SCROLL (reemplaza AOS) ─── */
  function initScrollAnimations() {
    const elements = document.querySelectorAll('[data-aos]');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const duration = el.getAttribute('data-aos-duration');
            const delay    = el.getAttribute('data-aos-delay');
            if (duration) el.style.setProperty('--aos-duration', duration + 'ms');
            if (delay)    el.style.setProperty('--aos-delay',    delay    + 'ms');
            el.classList.add('aos-animate');
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* ─── 2. TYPEWRITER HERO ─── */
  function initTypewriter() {
    const words = document.querySelectorAll('.word.typewriter');
    if (!words.length) return;

    let idx = 0;

    function typeWord(word, text, cb) {
      word.classList.add('active', 'typing');
      const typed = word.querySelector('.tw-typed');
      let chars = '';
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          chars += text[i++];
          if (typed) typed.textContent = chars;
          else word.textContent = chars;
        } else {
          clearInterval(interval);
          word.classList.remove('typing');
          word.classList.add('completed');
          if (cb) setTimeout(cb, 300);
        }
      }, 60);
    }

    function next() {
      if (idx >= words.length) return;
      const word = words[idx];
      const text = word.getAttribute('data-text') || '';
      typeWord(word, text, () => { idx++; next(); });
    }

    setTimeout(next, 800);
  }

  /*
    ─── 3. CONTADORES ANIMADOS ───

    Un contador es cualquier elemento con [data-counter]. Ese es el
    contrato completo: no hace falta una clase concreta ni vivir dentro
    de un contenedor con un nombre determinado.

    Antes hacían falta las dos cosas. El selector aceptaba
    .indicator-number o [data-counter], pero después exigía además un
    envoltorio llamado .hero-indicators o .about-stat-row para poder
    observarlo. Un contador correcto fuera de esos dos envoltorios se
    quedaba en "0" sin un solo error en consola — y eso es exactamente
    lo que llevaba meses pasando con las tres cifras de Cobertura, que
    además usaban data-target, que este selector nunca miró.

    Ahora se observa cada contador por su cuenta.
  */
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    function animateCounter(el) {
      const target = parseInt(el.getAttribute('data-counter'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      if (!Number.isFinite(target)) return;
      const duration = 1800;
      let start = null;

      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target + suffix;
      }
      requestAnimationFrame(step);
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.3 });

    counters.forEach((c) => obs.observe(c));
  }

  /* ─── 4. MENÚ MÓVIL (+ acordeón Operaciones + focus trap) ─── */
  function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const menu   = document.getElementById('mobileMenu');
    const close  = document.getElementById('mobileMenuClose');
    if (!toggle || !menu) return;

    const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let trapHandler = null;

    function getFocusable() {
      return [...menu.querySelectorAll(FOCUSABLE)].filter(
        (el) => getComputedStyle(el).display !== 'none'
      );
    }

    function addTrap() {
      const els = getFocusable();
      if (!els.length) return;
      const first = els[0];
      const last  = els[els.length - 1];
      trapHandler = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      };
      menu.addEventListener('keydown', trapHandler);
      close?.focus();
    }

    function removeTrap() {
      if (trapHandler) {
        menu.removeEventListener('keydown', trapHandler);
        trapHandler = null;
      }
      toggle.focus();
    }

    function resetDropdowns() {
      menu.querySelectorAll('.mobile-dropdown').forEach((drop) => {
        drop.classList.remove('open');
        drop.querySelector('.mobile-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
      });
    }

    function open() {
      menu.classList.add('active');
      document.body.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      resetDropdowns();
      addTrap();
    }

    function shut() {
      menu.classList.remove('active');
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      resetDropdowns();
      removeTrap();
    }

    toggle.addEventListener('click', open);
    close?.addEventListener('click', shut);
    menu.querySelector('.mobile-menu-overlay')?.addEventListener('click', shut);
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', shut));

    menu.querySelectorAll('.mobile-dropdown').forEach((drop) => {
      const btn = drop.querySelector('.mobile-dropdown-toggle');
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = drop.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('active')) shut();
    });
  }

  /* ─── 5. HEADER SCROLL (hide/show + scrolled) ─── */
  function initHeaderScroll() {
    const header = document.getElementById('header');
    const topBar = document.querySelector('.top-bar');
    if (!header) return;

    let lastY = 0;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          if (topBar && window.innerWidth >= 768) {
            topBar.classList.toggle('hidden', y > 0);
          }
          if (y > 80) {
            header.classList.toggle('hidden', y > lastY);
            header.classList.add('scrolled');
          } else {
            header.classList.remove('hidden', 'scrolled');
          }
          lastY = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ─── 6. BACK TO TOP ─── */
  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─── 7. SMOOTH SCROLL para anclas #hash ─── */
  function initSmoothScroll() {
    const header = document.getElementById('header');
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const offset = (header?.offsetHeight ?? 80) + 20;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
      });
    });
  }

  /* ─── 8. AJUSTE RESPONSIVE topbar/main ─── */
  function initResponsive() {
    const header = document.getElementById('header');
    const main   = document.querySelector('.main');
    if (!header) return;

    function adjust() {
      const desktop = window.innerWidth >= 768;
      header.classList.toggle('with-topbar', desktop);
      main?.classList.toggle('with-topbar', desktop);
    }

    window.addEventListener('resize', adjust, { passive: true });
    adjust();
  }

  /* ─── 9. CLIENTES CAROUSEL (infinite CSS scroll) ─── */
  function initClientsCarousel() {
    const track = document.querySelector('.clients-track');
    if (!track) return;

    const btn = document.getElementById('clientsPauseBtn');

    /*  Detenido a propósito por el usuario vs. pausado al pasar el mouse.
        Son dos cosas distintas: si no se distingue, mover el mouse fuera
        de la banda reanuda una animación que la persona pidió detener.
        El estado del botón manda; el hover solo actúa si no está detenido. */
    let detenido = false;

    const aplicar = () => {
      track.style.animationPlayState = detenido ? 'paused' : '';
    };

    if (btn) {
      const iconPause = btn.querySelector('.icon-pause');
      const iconPlay  = btn.querySelector('.icon-play');
      const label     = btn.querySelector('.clients-pause-label');

      btn.addEventListener('click', () => {
        detenido = !detenido;
        track.classList.toggle('is-paused', detenido);
        btn.setAttribute('aria-pressed', String(detenido));
        if (iconPause) iconPause.style.display = detenido ? 'none' : 'block';
        if (iconPlay)  iconPlay.style.display  = detenido ? 'block' : 'none';
        if (label)     label.textContent       = detenido ? 'Reanudar' : 'Pausar';
        aplicar();
      });
    }

    track.addEventListener('mouseenter', () => { if (!detenido) track.style.animationPlayState = 'paused'; });
    track.addEventListener('mouseleave', aplicar);
    track.addEventListener('touchstart', () => { if (!detenido) track.style.animationPlayState = 'paused'; }, { passive: true });
    track.addEventListener('touchend',   () => setTimeout(aplicar, 500), { passive: true });
  }


  /* ─── 10. HERO VIDEO PAUSE ─── */
  function initHeroPause() {
    const btn   = document.getElementById('heroPauseBtn');
    const video = document.querySelector('.hero-video');
    if (!btn || !video) return;
    const iconPause = btn.querySelector('.icon-pause');
    const iconPlay  = btn.querySelector('.icon-play');
    iconPause.style.display = 'block';
    iconPlay.style.display  = 'none';
    btn.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        iconPause.style.display = 'block';
        iconPlay.style.display  = 'none';
        btn.setAttribute('aria-label', 'Pausar video');
      } else {
        video.pause();
        iconPause.style.display = 'none';
        iconPlay.style.display  = 'block';
        btn.setAttribute('aria-label', 'Reproducir video');
      }
    });
  }

  /* ─── 11. MAPA INTERACTIVO DE COBERTURA ─── */
  function initCoverageMap() {
    const container = document.getElementById('peruMapContainer');
    if (!container) return;

    const cities = [
      { id: 'Piura',              label: 'Piura',        dotR: 150, pulseR: 550,  delay: 0    },
      { id: 'La_x0020_Libertad', label: 'Trujillo',     dotR: 150, pulseR: 550,  delay: 0.45 },
      { id: 'Pasco',              label: 'Pasco',        dotR: 180, pulseR: 680,  delay: 0.90 },
      { id: 'path2641',           label: 'Lima',         dotR: 220, pulseR: 850,  delay: 1.35 },
      { id: 'Jun\xEDn',           label: 'Huancayo',     dotR: 290, pulseR: 1100, delay: 1.80 },
      { id: 'Huancavelica',       label: 'Huancavelica', dotR: 180, pulseR: 680,  delay: 2.25 },
      { id: 'Ica',                label: 'Ica',          dotR: 180, pulseR: 680,  delay: 2.70 },
    ];

    const NS = 'http://www.w3.org/2000/svg';

    function makePulse(cx, cy, maxR, delay, offset) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', '0');
      c.setAttribute('fill', '#d9822b');
      c.setAttribute('opacity', '0');

      const ar = document.createElementNS(NS, 'animate');
      ar.setAttribute('attributeName', 'r');
      ar.setAttribute('values', '0;' + maxR);
      ar.setAttribute('dur', '2.6s');
      ar.setAttribute('begin', (delay + offset) + 's');
      ar.setAttribute('repeatCount', 'indefinite');
      c.appendChild(ar);

      const ao = document.createElementNS(NS, 'animate');
      ao.setAttribute('attributeName', 'opacity');
      ao.setAttribute('values', '0.60;0');
      ao.setAttribute('dur', '2.6s');
      ao.setAttribute('begin', (delay + offset) + 's');
      ao.setAttribute('repeatCount', 'indefinite');
      c.appendChild(ao);

      return c;
    }

    /* Intensidad de relleno por volumen de proyectos */
    var activeFills = {
      'Piura':               'rgba(27,82,120,0.22)',
      'La_x0020_Libertad':   'rgba(27,82,120,0.22)',
      'Pasco':               'rgba(27,82,120,0.30)',
      'Huancavelica':        'rgba(27,82,120,0.30)',
      'Ica':                 'rgba(27,82,120,0.30)',
      'path2641':            'rgba(27,82,120,0.40)',
      'Jun\xEDn':            'rgba(27,82,120,0.52)',
    };

    fetch('/assets/imagenes/peru-depts.svg')
      .then(function(r) { return r.text(); })
      .then(function(text) {
        container.innerHTML = text;
        var svg = container.querySelector('svg');
        if (!svg) { console.warn('initCoverageMap: peru-depts.svg no trajo un <svg>.'); return; }

        /* El tamaño y la sombra van acá y no en el CSS de la página: Astro
           le pega data-astro-cid al selector de la página, y este SVG,
           inyectado en tiempo de ejecución, nunca lo lleva. */
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.filter = 'drop-shadow(0 8px 28px rgba(20,23,45,0.12))';

        /* Relleno base de todos los departamentos (inline style > clase CSS) */
        svg.querySelectorAll('.fil0').forEach(function(p) {
          p.style.fill   = 'rgba(20,40,80,0.10)';
          p.style.stroke = 'rgba(255,255,255,0.20)';
          p.style['stroke-width'] = '55';
        });
        svg.querySelectorAll('.str0,.str1,.str2').forEach(function(p) {
          p.style.stroke      = 'rgba(255,255,255,0.20)';
          p.style['stroke-width'] = '55';
        });

        /* Lago Titicaca */
        var titicaca = svg.querySelector('#Titicaca');
        if (titicaca) titicaca.style.fill = 'rgba(27,82,120,0.38)';

        /* Departamentos activos */
        Object.keys(activeFills).forEach(function(id) {
          var el = svg.querySelector('[id="' + id + '"]');
          if (el) el.style.fill = activeFills[id];
        });

        /* Grupo de pines */
        var pinsGroup = document.createElementNS(NS, 'g');
        pinsGroup.setAttribute('id', 'svgPins');
        svg.appendChild(pinsGroup);

        cities.forEach(function(city) {
          var el = svg.querySelector('[id="' + city.id + '"]');
          if (!el) return;

          var bbox;
          try { bbox = el.getBBox(); } catch(e) { return; }
          if (!bbox || !bbox.width) return;

          var cx = Math.round(bbox.x + bbox.width  / 2);
          var cy = Math.round(bbox.y + bbox.height / 2);

          var g = document.createElementNS(NS, 'g');

          /* Halo suave (se inserta primero, debajo de todo) */
          var halo = document.createElementNS(NS, 'circle');
          halo.setAttribute('cx', cx);
          halo.setAttribute('cy', cy);
          halo.setAttribute('r', Math.round(city.dotR * 2.2));
          halo.setAttribute('fill', '#d9822b');
          halo.setAttribute('opacity', '0.13');
          pinsGroup.appendChild(halo);

          /* Dos anillos de pulso SMIL */
          g.appendChild(makePulse(cx, cy, city.pulseR, city.delay, 0));
          g.appendChild(makePulse(cx, cy, city.pulseR, city.delay, 1.3));

          /* Punto central */
          var dot = document.createElementNS(NS, 'circle');
          dot.setAttribute('cx', cx);
          dot.setAttribute('cy', cy);
          dot.setAttribute('r', city.dotR);
          dot.setAttribute('fill', '#d9822b');
          dot.setAttribute('opacity', '0.92');
          g.appendChild(dot);

          pinsGroup.appendChild(g);
        });
      })
      /* Vacío no es lo mismo que silencioso: si el fetch del SVG falla o el
         parseo no encuentra un nodo esperado, el mapa se queda sin pines y
         nada más lo dice. Antes este catch no dejaba ni rastro en la consola;
         ahora al menos queda uno para quien esté mirando cuando pase. */
      .catch(function(err) { console.warn('initCoverageMap: no se pudo pintar el mapa.', err); });
  }

  /* ─── 12. SCROLL HINT ─── */
  function initScrollHint() {
    const hint = document.querySelector('.scroll-hint');
    if (!hint) return;
    hint.addEventListener('click', () => {
      window.scrollBy({ top: window.innerHeight * 0.88, behavior: 'smooth' });
    });
  }

  /* ─── INIT ─── */
  initScrollAnimations();
  initTypewriter();
  initCounters();
  initMobileMenu();
  initHeaderScroll();
  initBackToTop();
  initSmoothScroll();
  initResponsive();
  initClientsCarousel();
  initHeroPause();
  initScrollHint();
  initCoverageMap();

});
