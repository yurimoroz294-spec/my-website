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
}, { threshold: 0.3 });
sections.forEach(s => navObserver.observe(s));

// ── Install tabs ─────────────────────────────────────────────
document.querySelectorAll('.install-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    document.querySelectorAll('.install-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.install-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${id}`)?.classList.add('active');
  });
});

// ── Copy code buttons ─────────────────────────────────────────
const snippets = {
  shoptet: `<script src="https://cdn.zapi.cz/widget.js" data-id="VÁŠ_ID"></script>`,
  web:     `<script src="https://cdn.zapi.cz/widget.js" data-id="VÁŠ_ID" data-lang="cs" data-theme="dark"></script>`,
};
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = snippets[btn.dataset.code] ?? '';
    navigator.clipboard?.writeText(code).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Zkopírováno';
      setTimeout(() => (btn.textContent = orig), 2000);
    });
  });
});

// ── Scroll reveal setup ──────────────────────────────────────
function addReveal(el, cls = '', delay = '') {
  if (!el) return;
  el.classList.add('reveal');
  if (cls)   el.classList.add(cls);
  if (delay) el.classList.add(delay);
}

// Hero
addReveal(document.querySelector('.hero-badge'));
addReveal(document.querySelector('.hero-title'),   '', 'reveal-delay-1');
addReveal(document.querySelector('.hero-sub'),     '', 'reveal-delay-2');
addReveal(document.querySelector('.hero-actions'), '', 'reveal-delay-3');
addReveal(document.querySelector('.hero-trust'),   '', 'reveal-delay-4');
addReveal(document.querySelector('.hero-mockup'),  'from-right', 'reveal-delay-2');
addReveal(document.querySelector('.hero-stats-bar'));

// Section headers
document.querySelectorAll('.section-header').forEach(el => addReveal(el));

// Feature cards
document.querySelectorAll('.feature-card').forEach((card, i) =>
  addReveal(card, 'scale-in', `reveal-delay-${Math.min(i + 1, 5)}`)
);

// Steps
document.querySelectorAll('.step').forEach((el, i) =>
  addReveal(el, 'scale-in', `reveal-delay-${i + 1}`)
);

// Install section
addReveal(document.querySelector('.install-tabs'));
addReveal(document.querySelector('.install-panels'), '', 'reveal-delay-1');

// Pricing
addReveal(document.querySelector('.pricing-card'), 'from-left');
addReveal(document.querySelector('.pricing-side'), 'from-right', 'reveal-delay-1');

// Contact
addReveal(document.querySelector('.contact-text'), 'from-left');
addReveal(document.querySelector('.contact-form'), 'from-right', 'reveal-delay-1');

// ── Intersection observer ─────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

// Hero elements fire immediately
document.querySelectorAll('.hero .reveal, .hero-stats-bar .reveal').forEach(el =>
  el.classList.add('visible')
);
// Fire hero badge/title/etc directly since they're in hero
document.querySelectorAll('.hero-badge, .hero-title, .hero-sub, .hero-actions, .hero-trust, .hero-mockup').forEach(el =>
  el.classList.add('visible')
);
document.querySelector('.hero-stats-bar')?.classList.add('visible');

// Observe everything else
document.querySelectorAll('.reveal').forEach(el => {
  if (!el.classList.contains('visible')) revealObserver.observe(el);
});

// ── Contact form ──────────────────────────────────────────────
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Odesláno! Ozveme se do 24 hodin.';
  btn.style.background = 'linear-gradient(135deg, #10b981, #0ea5e9)';
  btn.disabled = true;
});
