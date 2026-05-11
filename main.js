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
      if (active) active.style.color = '#fff';
    }
  });
}, { threshold: 0.4 });
sections.forEach(s => navObserver.observe(s));

// ── Scroll reveal ────────────────────────────────────────────
function addReveal(el, cls = '', delay = '') {
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
document.querySelectorAll('.section-header').forEach(el => addReveal(el));

// Product cards — left visual, right content (or reversed)
document.querySelectorAll('.product-card').forEach((card, i) => {
  const visual   = card.querySelector('.product-visual');
  const content  = card.querySelector('.product-content');
  const isReverse = card.classList.contains('reverse');
  addReveal(visual,  isReverse ? 'from-right' : 'from-left');
  addReveal(content, isReverse ? 'from-left'  : 'from-right', 'reveal-delay-1');
  // feature list items stagger
  content.querySelectorAll('.feature-list li').forEach((li, j) =>
    addReveal(li, '', `reveal-delay-${Math.min(j + 1, 6)}`)
  );
});

// Steps
document.querySelectorAll('.step').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i + 1}`)
);

// Benefit cards
document.querySelectorAll('.benefit-card').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i % 3 + 1}`)
);

// Contact
addReveal(document.querySelector('.contact-text'), 'from-left');
addReveal(document.querySelector('.contact-form'), 'from-right', 'reveal-delay-1');

// Intersection observer that fires the animation
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

// Trigger hero immediately (already in view)
document.querySelectorAll('.hero .reveal').forEach(el => {
  el.classList.add('visible');
});

// Observe everything else
document.querySelectorAll('.reveal:not(.hero .reveal)').forEach(el =>
  revealObserver.observe(el)
);

// ── Contact form ─────────────────────────────────────────────
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Request sent!';
  btn.style.background = 'linear-gradient(135deg, #10b981, #0ea5e9)';
  btn.disabled = true;
});
