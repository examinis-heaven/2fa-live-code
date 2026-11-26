/**
 * Smooth Scroll (Lenis) + Scroll Stagger Reveals (GSAP ScrollTrigger)
 * + Spring Card & Hover Micro-Interactions (Motion)
 *
 * Loads via fast ESM CDN with graceful offline fallback so content is never hidden.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let motionAnimate = null;
let motionSpring = null;
let lenisInstance = null;

// Expose lightweight hooks for app.js (tab switches, dynamic cards, modals)
export function moveLiquidTabPill(activeBtn, immediate = false) {
  const pill = document.getElementById('tabLiquidPill');
  if (!pill || !activeBtn) return;

  const x = activeBtn.offsetLeft;
  const width = activeBtn.offsetWidth;
  const height = activeBtn.offsetHeight;
  const top = activeBtn.offsetTop;

  pill.style.top = `${top}px`;
  pill.style.height = `${height}px`;

  if (immediate || REDUCED_MOTION || !motionAnimate || !motionSpring) {
    pill.style.opacity = '1';
    pill.style.width = `${width}px`;
    pill.style.transform = `translateX(${x}px)`;
    return;
  }

  motionAnimate(
    pill,
    {
      x,
      width: `${width}px`,
      opacity: 1,
      scaleX: [1, 1.07, 1],
      scaleY: [1, 0.94, 1],
    },
    { easing: motionSpring({ stiffness: 340, damping: 26, mass: 0.75 }) }
  );
}

export function animatePanelIn(panelEl) {
  if (REDUCED_MOTION || !panelEl || !motionAnimate || !motionSpring) return;
  motionAnimate(
    panelEl,
    { opacity: [0, 1], y: [14, 0], scale: [0.992, 1] },
    { duration: 0.42, easing: motionSpring({ stiffness: 280, damping: 26, mass: 0.8 }) }
  );
}

export function animateDynamicCards(containerEl, selector) {
  if (REDUCED_MOTION || !containerEl) return;
  const items = Array.from(containerEl.querySelectorAll(selector));
  if (items.length === 0) return;

  if (motionAnimate && motionSpring) {
    items.forEach((el, i) => {
      motionAnimate(
        el,
        { opacity: [0, 1], y: [16, 0], scale: [0.97, 1] },
        {
          delay: Math.min(i * 0.055, 0.35),
          easing: motionSpring({ stiffness: 320, damping: 26, mass: 0.75 }),
        }
      );
      bindMotionCardHover(el, { lift: -3, scale: 1.015 });
    });
  }
}

export function animateModalIn(modalBackdropEl) {
  if (lenisInstance) lenisInstance.stop();
  if (REDUCED_MOTION || !modalBackdropEl || !motionAnimate || !motionSpring) return;
  const box = modalBackdropEl.querySelector('.modal-box');
  if (!box) return;
  motionAnimate(
    box,
    { opacity: [0, 1], y: [18, 0], scale: [0.95, 1] },
    { easing: motionSpring({ stiffness: 340, damping: 28, mass: 0.75 }) }
  );
}

export function onModalClose() {
  if (lenisInstance) lenisInstance.start();
}

function bindMotionCardHover(el, { lift = -5, scale = 1.015 } = {}) {
  if (!el || el.dataset.motionBound || REDUCED_MOTION || !motionAnimate || !motionSpring) return;
  el.dataset.motionBound = '1';

  const hoverSpring = motionSpring({ stiffness: 380, damping: 24, mass: 0.7 });
  const pressSpring = motionSpring({ stiffness: 500, damping: 28, mass: 0.6 });

  el.addEventListener('pointerenter', () => {
    motionAnimate(el, { y: lift, scale }, { easing: hoverSpring });
  });

  el.addEventListener('pointerleave', () => {
    motionAnimate(el, { y: 0, scale: 1 }, { easing: hoverSpring });
  });

  el.addEventListener('pointerdown', () => {
    motionAnimate(el, { y: lift + 2, scale: 0.985 }, { easing: pressSpring });
  });

  el.addEventListener('pointerup', () => {
    motionAnimate(el, { y: lift, scale }, { easing: hoverSpring });
  });

  // Subtle holographic cursor spotlight
  el.addEventListener('pointermove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
}

function bindSpotlightOnly(el) {
  if (!el || el.dataset.spotlightBound) return;
  el.dataset.spotlightBound = '1';
  el.addEventListener('pointermove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
}

export async function initAnimations() {
  if (REDUCED_MOTION) return;

  try {
    const [gsapMod, stMod, lenisMod, motionMod] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/gsap@3.12.7/+esm'),
      import('https://cdn.jsdelivr.net/npm/gsap@3.12.7/ScrollTrigger/+esm'),
      import('https://cdn.jsdelivr.net/npm/lenis@1.1.20/+esm'),
      import('https://cdn.jsdelivr.net/npm/motion@11.15.0/+esm'),
    ]);

    const gsap = gsapMod.gsap || gsapMod.default;
    const ScrollTrigger = stMod.ScrollTrigger || stMod.default;
    const Lenis = lenisMod.default || lenisMod.Lenis;

    motionAnimate = motionMod.animate;
    motionSpring = motionMod.spring;

    gsap.registerPlugin(ScrollTrigger);

    // 1. Lenis Smooth Scroll synced to GSAP Ticker + ScrollTrigger
    lenisInstance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
    });

    lenisInstance.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenisInstance.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Smooth anchor links via Lenis
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (!href) return;
        if (href === '#') {
          e.preventDefault();
          lenisInstance.scrollTo(0);
          return;
        }
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenisInstance.scrollTo(target, { offset: -86 });
        }
      });
    });

    // 2. Above-the-fold Intro Stagger (GSAP)
    const introTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    introTl
      .from('.site-header .brand, .site-header .nav-link, .site-header .header-actions > *', {
        y: -14,
        opacity: 0,
        duration: 0.55,
        stagger: 0.055,
        clearProps: 'transform,opacity',
      })
      .from(
        '.tool-card',
        {
          y: 26,
          opacity: 0,
          scale: 0.985,
          duration: 0.7,
          clearProps: 'transform,opacity',
        },
        '-=0.3'
      )
      .from(
        '.tool-card .tool-col > *',
        {
          y: 16,
          opacity: 0,
          duration: 0.5,
          stagger: 0.055,
          clearProps: 'transform,opacity',
        },
        '-=0.45'
      );

    // 3. GSAP ScrollTrigger — One-by-One Staggered Section Reveals
    const revealGroup = (triggerSel, itemsSel, { stagger = 0.11, y = 32, scale = 0.97 } = {}) => {
      const trigger = document.querySelector(triggerSel);
      const items = document.querySelectorAll(itemsSel);
      if (!trigger || items.length === 0) return;

      gsap.from(items, {
        y,
        opacity: 0,
        scale,
        duration: 0.72,
        stagger,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger,
          start: 'top 86%',
          once: true,
        },
      });
    };

    // Hero intro elements one by one
    revealGroup('.hero-intro', '.hero-intro > *', { stagger: 0.12, y: 28, scale: 1 });

    // Features heading + 3 feature cards one by one
    revealGroup('#features', '#features .section-title, #features .feature-card', {
      stagger: 0.13,
      y: 36,
      scale: 0.96,
    });

    // How it works card: title -> 5-step flow steps & arrows one by one -> prose paragraphs
    revealGroup(
      '#how-it-works',
      '#how-it-works .section-title, #how-it-works .flow-step, #how-it-works .flow-arrow, #how-it-works .prose p',
      { stagger: 0.085, y: 26, scale: 0.97 }
    );

    // Two-column Guide & Universal Compatibility one by one
    revealGroup(
      '.two-col-sections',
      '.two-col-sections .content-card, .two-col-sections .step-list li, .two-col-sections .compat-grid li',
      { stagger: 0.08, y: 26, scale: 0.97 }
    );

    // FAQ heading + accordion items one by one
    revealGroup('#faq', '#faq .section-title, #faq .faq-item', {
      stagger: 0.09,
      y: 24,
      scale: 0.985,
    });

    // Footer reveal
    revealGroup('.site-footer', '.site-footer .copyright, .site-footer .footer-link', {
      stagger: 0.06,
      y: 16,
      scale: 1,
    });

    // Subtle scroll-linked parallax on ambient glow
    gsap.to('.bg-ambient', {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
      },
    });

    // 4. Motion — Silky Spring Card & Hover Layout Interactions
    document.querySelectorAll('.feature-card').forEach((el) =>
      bindMotionCardHover(el, { lift: -6, scale: 1.018 })
    );
    document.querySelectorAll('.flow-step').forEach((el) =>
      bindMotionCardHover(el, { lift: -5, scale: 1.025 })
    );
    document.querySelectorAll('.compat-grid li').forEach((el) =>
      bindMotionCardHover(el, { lift: -3, scale: 1.02 })
    );
    document.querySelectorAll('.faq-item').forEach((el) =>
      bindMotionCardHover(el, { lift: -2, scale: 1.006 })
    );
    document.querySelectorAll('.btn-primary, .btn-secondary, .token-display-box').forEach((el) =>
      bindMotionCardHover(el, { lift: -2, scale: 1.012 })
    );
    document.querySelectorAll('.tool-card, .content-card').forEach(bindSpotlightOnly);

    // Refresh ScrollTrigger once fonts finish loading
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  } catch (err) {
    // Graceful offline fallback — site remains 100% visible and usable
    console.info('Animations skipped (offline or CDN unavailable):', err?.message || err);
  }
}
