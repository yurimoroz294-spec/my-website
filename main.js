// ── Mobile nav ──────────────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');
hamburger?.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks?.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => navLinks.classList.remove('open'))
);

// ── Active nav link on scroll ────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a[href^="#"]');
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navItems.forEach(a => a.style.color = '');
      const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (active) active.style.color = '#f59e0b';
    }
  });
}, { threshold: 0.35 });
sections.forEach(s => navObserver.observe(s));

// ── Scroll reveal ────────────────────────────────────────────
function addReveal(el, cls = '', delay = '') {
  if (!el) return;
  el.classList.add('reveal');
  if (cls)   el.classList.add(cls);
  if (delay) el.classList.add(delay);
}

// Hero
addReveal(document.querySelector('.hero-badge'));
addReveal(document.querySelector('.hero-title'), '', 'reveal-delay-1');
addReveal(document.querySelector('.hero-sub'),   '', 'reveal-delay-2');
addReveal(document.querySelector('.hero-actions'), '', 'reveal-delay-3');
addReveal(document.querySelector('.hero-stats'),   '', 'reveal-delay-4');

// Section headers
document.querySelectorAll('.section-header, .ai-header').forEach(el => addReveal(el));

// Compare strip
document.querySelectorAll('.strip-item').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${Math.min(i + 1, 6)}`)
);

// Module cards
document.querySelectorAll('.module-card').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i % 3 + 1}`)
);

// AI layout
addReveal(document.querySelector('.ai-phone-wrap'), 'from-left');
document.querySelectorAll('.ai-feature').forEach((el, i) =>
  addReveal(el, 'from-right', `reveal-delay-${Math.min(i + 1, 6)}`)
);

// Accounting
document.querySelectorAll('.acc-card').forEach((el, i) =>
  addReveal(el, '', `reveal-delay-${Math.min(i + 1, 4)}`)
);
document.querySelectorAll('.acc-benefit').forEach((el, i) =>
  addReveal(el, 'from-right', `reveal-delay-${Math.min(i + 1, 3)}`)
);

// Steps
document.querySelectorAll('.step').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i + 1}`)
);

// Compare table
addReveal(document.querySelector('.compare-table-wrap'), 'scale-in');

// Benefits
document.querySelectorAll('.benefit-card').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i % 3 + 1}`)
);

// Testimonials
document.querySelectorAll('.testi-card').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i + 1}`)
);

// Contact
addReveal(document.querySelector('.contact-text'), 'from-left');
addReveal(document.querySelector('.contact-form'), 'from-right', 'reveal-delay-1');

// ── Intersection observer ────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('visible'));
document.querySelectorAll('.reveal:not(.hero .reveal)').forEach(el =>
  revealObserver.observe(el)
);

// ── Animated stock bars on scroll ────────────────────────────
const warehouseCard = document.querySelector('.mod-warehouse');
if (warehouseCard) {
  const barObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.stock-bar, .warn-bar, .danger-bar').forEach(bar => {
          const targetWidth = bar.style.width;
          bar.style.width = '0%';
          setTimeout(() => { bar.style.transition = 'width 0.9s cubic-bezier(0.22,1,0.36,1)'; bar.style.width = targetWidth; }, 100);
        });
        barObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  barObserver.observe(warehouseCard);
}

// ── AI alert pulse animation ─────────────────────────────────
const alertDanger = document.querySelector('.alert-card.alert-danger');
if (alertDanger) {
  setInterval(() => {
    alertDanger.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.4)';
    setTimeout(() => { alertDanger.style.boxShadow = ''; }, 800);
  }, 3000);
}

// ── Contact form ─────────────────────────────────────────────
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Дякуємо! Ми зв\'яжемось з вами протягом 24 годин.';
  btn.style.background = 'linear-gradient(135deg, #10b981, #0ea5e9)';
  btn.style.color = '#fff';
  btn.disabled = true;
});

// ── Smooth counter animation for hero stats ───────────────────
function animateCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const text = el.textContent.trim();
    const num = parseFloat(text);
    if (isNaN(num)) return;
    const suffix = text.replace(String(num), '');
    let start = 0;
    const duration = 1200;
    const step = 16;
    const increment = num / (duration / step);
    const timer = setInterval(() => {
      start = Math.min(start + increment, num);
      el.textContent = (Number.isInteger(num) ? Math.round(start) : start.toFixed(1)) + suffix;
      if (start >= num) clearInterval(timer);
    }, step);
  });
}

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
  const statsObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateCounters();
      statsObserver.disconnect();
    }
  }, { threshold: 0.8 });
  statsObserver.observe(heroStats);
}
