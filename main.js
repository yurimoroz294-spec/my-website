'use strict';

/* ══════════════════════════════════════════════════════════════
   LUNDR — main.js
   ══════════════════════════════════════════════════════════════ */

// ── Product data ─────────────────────────────────────────────
const PRODUCTS = [
  // KITCHEN
  { id: 1,  category: 'kitchen', name: 'Mycí prostředek na nádobí',       variant: 'Citrus & Aloe',           desc: 'Jemný mycí prostředek s citrusovými extrakty a aloe vera. Účinný na mastnotu, šetrný k pokožce rukou.', volume: '290 ml', price: 189, tag: 'Bestseller', color: '#E8F2EC', accent: '#4D7B62' },
  { id: 2,  category: 'kitchen', name: 'Kuchyňský sprej',                 variant: 'Pine & Mint',             desc: 'Víceúčelový čisticí sprej s borovicovým olejem a mátou. Pro pracovní plochy, sporáky a dřezy.',     volume: '500 ml', price: 229, tag: null,          color: '#E4EEE8', accent: '#3D6B54' },
  { id: 3,  category: 'kitchen', name: 'Odmašťovač',                      variant: 'Tea Tree & Eucalyptus',   desc: 'Silný odmašťovač s antibakteriálními účinky. Pro troubu, digestoř a silně znečištěné plochy.',       volume: '750 ml', price: 259, tag: 'Nový',       color: '#E6EBE8', accent: '#4A7465' },
  { id: 4,  category: 'kitchen', name: 'Tablety do myčky',                variant: 'Nordic Clean',            desc: 'Kompaktní tablety pro myčky. Bez fosfátů, biologicky odbouratelné. Balení na 25 mytí.',            volume: '25 ks',  price: 349, tag: 'Eco volba', color: '#EBF0E8', accent: '#5A7A5E' },
  { id: 5,  category: 'kitchen', name: 'Náhradní náplň — Mycí prostředek', variant: 'Citrus & Aloe',         desc: 'Koncentrovaná náhradní náplň. Stačí naředit vodou. O 75 % méně plastu než nová lahev.',             volume: '500 ml', price: 149, tag: 'Refill',     color: '#F0EDE4', accent: '#7A6040' },
  { id: 6,  category: 'kitchen', name: 'Čistič dřezu',                    variant: 'Lemon & Baking Soda',     desc: 'Jemný abrazivní čistič pro ušlechtilou ocel a keramiku. Odstraní skvrny bez poškrábání.',           volume: '400 ml', price: 199, tag: null,          color: '#F4F0E0', accent: '#7A7A3D' },
  // BATHROOM
  { id: 7,  category: 'bath',    name: 'Čistič koupelny',                 variant: 'Lavender & Cedar',        desc: 'Jemný ale účinný čistič. Odstraní mýdlové usazeniny a vodní kámen se svěží vůní levandule a cedru.', volume: '500 ml', price: 219, tag: 'Bestseller', color: '#EDE8F4', accent: '#5A4D7B' },
  { id: 8,  category: 'bath',    name: 'Čistič WC',                       variant: 'Arctic Pine',             desc: 'Efektivní čistič záchodu s dezinfekčními účinky a příjemnou vůní severské borovice.',              volume: '500 ml', price: 189, tag: null,          color: '#E8EEF4', accent: '#3D5B7B' },
  { id: 9,  category: 'bath',    name: 'Tekuté mýdlo na ruce',            variant: 'Nordic Birch',            desc: 'Jemné mýdlo s extraktem z březové kůry. Čistí, hydratuje a nechává ruce hebké. Pro celou rodinu.',  volume: '300 ml', price: 159, tag: 'Oblíbené',  color: '#F4F0E8', accent: '#7B6A3D' },
  { id: 10, category: 'bath',    name: 'Čistič zrcadel a oken',           variant: 'Crystal Clear',           desc: 'Bezbarvý čistič bez šmuh pro zrcadla, sklo a chromované povrchy. Bez amoniaku.',                  volume: '500 ml', price: 229, tag: 'Nový',       color: '#E8F4F4', accent: '#3D7A7B' },
  { id: 11, category: 'bath',    name: 'Náhradní náplň — Čistič koupelny', variant: 'Lavender & Cedar',      desc: 'Koncentrovaná náhradní náplň pro čistič koupelny. O 75 % méně plastu, 30 % úspora.',               volume: '500 ml', price: 169, tag: 'Refill',     color: '#F0EDE4', accent: '#7A6040' },
  { id: 12, category: 'bath',    name: 'Sprchový gel',                    variant: 'Sea Salt & Kelp',         desc: 'Osvěžující sprchový gel s mořskou solí a extraktem z chaluhy. Jemný pro každodenní použití.',       volume: '250 ml', price: 199, tag: null,          color: '#E4EEF4', accent: '#3D5B6B' },
];

// ── Cart state ────────────────────────────────────────────────
let cart = []; // [{ product, quantity }]

// ── DOM refs ─────────────────────────────────────────────────
const cartDrawer   = document.getElementById('cartDrawer');
const cartOverlay  = document.getElementById('cartOverlay');
const cartBtn      = document.getElementById('cartBtn');
const cartClose    = document.getElementById('cartClose');
const cartItems    = document.getElementById('cartItems');
const cartEmpty    = document.getElementById('cartEmpty');
const cartFooter   = document.getElementById('cartFooter');
const cartBadge    = document.getElementById('cartBadge');
const cartTotal    = document.getElementById('cartTotal');
const checkoutBtn  = document.getElementById('checkoutBtn');
const navWrap      = document.getElementById('navWrap');
const hamburger    = document.getElementById('hamburger');
const navLinks     = document.getElementById('navLinks');
const toast        = document.getElementById('toast');
const toastMsg     = document.getElementById('toastMsg');
const newsletterForm = document.getElementById('newsletterForm');
const nlSuccess    = document.getElementById('nlSuccess');
const kitchenGrid  = document.getElementById('kitchenGrid');
const bathGrid     = document.getElementById('bathGrid');

/* ══════════════════════════════════════════════════════════════
   PRODUCT RENDERING
   ══════════════════════════════════════════════════════════════ */

/**
 * Build the inline CSS bottle illustration for a product card.
 * Different shapes depending on product category/id for visual variety.
 */
function buildBottleIllustration(product) {
  const { color, accent, variant } = product;

  // Cycle through 4 bottle shapes based on product id
  const shape = product.id % 4;

  if (shape === 0) {
    // Round jar
    return `
      <div class="pv-bottle">
        <div class="pv-cap"    style="background:${accent};width:52px;height:12px;border-radius:6px 6px 0 0;"></div>
        <div class="pv-body-round" style="background:${accent};width:72px;height:72px;display:flex;align-items:center;justify-content:center;">
          <div class="pv-label"><span class="pv-label-text">${variant}</span></div>
        </div>
      </div>`;
  }

  if (shape === 1) {
    // Spray bottle
    return `
      <div class="pv-bottle" style="position:relative;">
        <div style="width:48px;height:22px;background:${accent};border-radius:8px 8px 0 0;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 4px 3px;opacity:0.85;">
          <div style="width:10px;height:14px;background:${accent};border-radius:0 0 4px 4px;filter:brightness(0.7);"></div>
        </div>
        <div style="width:12px;height:14px;background:${color};border:2px solid ${accent};align-self:center;"></div>
        <div class="pv-body-spray" style="background:${accent};opacity:0.85;display:flex;align-items:center;justify-content:center;">
          <div class="pv-label"><span class="pv-label-text">${variant}</span></div>
        </div>
      </div>`;
  }

  if (shape === 2) {
    // Pump bottle (tall)
    return `
      <div class="pv-bottle">
        <div style="width:28px;height:10px;background:${accent};border-radius:4px 4px 0 0;opacity:0.9;"></div>
        <div style="width:3px;height:22px;background:${accent};margin:0 auto;opacity:0.7;"></div>
        <div style="width:18px;height:10px;background:${color};border:2px solid ${accent};align-self:center;border-radius:3px;"></div>
        <div class="pv-body" style="background:${accent};opacity:0.85;height:100px;display:flex;align-items:center;justify-content:center;">
          <div class="pv-label"><span class="pv-label-text">${variant}</span></div>
        </div>
      </div>`;
  }

  // Default: simple tall bottle
  return `
    <div class="pv-bottle">
      <div class="pv-cap" style="background:${accent};"></div>
      <div style="width:14px;height:16px;background:${color};border-left:2px solid ${accent};border-right:2px solid ${accent};align-self:center;"></div>
      <div class="pv-body" style="background:${accent};opacity:0.85;display:flex;align-items:center;justify-content:center;">
        <div class="pv-label"><span class="pv-label-text">${variant}</span></div>
      </div>
    </div>`;
}

/**
 * Map a tag string to its CSS class.
 */
function tagClass(tag) {
  if (!tag) return '';
  const map = {
    'Bestseller': 'tag-bestseller',
    'Nový':       'tag-novy',
    'Refill':     'tag-refill',
    'Eco volba':  'tag-eco',
    'Oblíbené':   'tag-oblibene',
  };
  return map[tag] || 'tag-green';
}

/**
 * Render a single product card element.
 */
function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card reveal';
  card.setAttribute('data-product-id', product.id);

  const tagHTML = product.tag
    ? `<span class="product-tag ${tagClass(product.tag)}">${product.tag}</span>`
    : '';

  card.innerHTML = `
    <div class="product-visual" style="background:${product.color}">
      ${tagHTML}
      ${buildBottleIllustration(product)}
    </div>
    <div class="product-body">
      <h3 class="product-name">${product.name}</h3>
      <p class="product-variant">${product.variant}</p>
      <p class="product-desc">${product.desc}</p>
      <div class="product-meta">
        <span class="product-volume">${product.volume}</span>
        <span class="product-price">${product.price} Kč</span>
      </div>
    </div>
    <div class="product-footer">
      <button
        class="btn-cart"
        data-id="${product.id}"
        aria-label="Přidat ${product.name} do košíku"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Do košíku
      </button>
    </div>
  `;

  // Add to cart event
  card.querySelector('.btn-cart').addEventListener('click', () => {
    addToCart(product.id);
  });

  return card;
}

/**
 * Render all products into the two grids.
 */
function renderProducts() {
  const kitchenProds = PRODUCTS.filter(p => p.category === 'kitchen');
  const bathProds    = PRODUCTS.filter(p => p.category === 'bath');

  kitchenProds.forEach((p, i) => {
    const card = createProductCard(p);
    card.style.transitionDelay = `${i * 0.06}s`;
    kitchenGrid.appendChild(card);
  });

  bathProds.forEach((p, i) => {
    const card = createProductCard(p);
    card.style.transitionDelay = `${i * 0.06}s`;
    bathGrid.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════════════
   CART SYSTEM
   ══════════════════════════════════════════════════════════════ */

function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.product.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1 });
  }

  renderCart();
  showToast(`${product.name} přidán do košíku`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product.id !== productId);
  renderCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.product.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    renderCart();
  }
}

function getTotalPrice() {
  return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

function getTotalItems() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function renderCart() {
  const total      = getTotalPrice();
  const totalItems = getTotalItems();

  // Badge
  if (totalItems > 0) {
    cartBadge.textContent = totalItems > 99 ? '99+' : totalItems;
    cartBadge.style.display = 'flex';
  } else {
    cartBadge.style.display = 'none';
  }

  // Empty/items toggle
  if (cart.length === 0) {
    cartEmpty.style.display  = 'flex';
    cartFooter.style.display = 'none';
    cartItems.innerHTML = '';
    return;
  }

  cartEmpty.style.display  = 'none';
  cartFooter.style.display = 'flex';

  // Total
  cartTotal.textContent = `${total} Kč`;

  // Item rows
  cartItems.innerHTML = cart.map(({ product, quantity }) => `
    <div class="cart-item" data-cart-item="${product.id}">
      <div class="cart-item-thumb" style="background:${product.color}">
        <div style="
          width: 28px;
          height: 46px;
          background: ${product.accent};
          border-radius: 5px 5px 9px 9px;
          opacity: 0.85;
        "></div>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${product.name}</div>
        <div class="cart-item-variant">${product.variant} · ${product.volume}</div>
        <div class="cart-item-price">${product.price * quantity} Kč</div>
      </div>
      <div class="cart-item-controls">
        <div class="qty-row">
          <button
            class="qty-btn"
            onclick="updateQuantity(${product.id}, -1)"
            aria-label="Snížit množství"
          >−</button>
          <span class="qty-num" aria-label="${quantity} kusů">${quantity}</span>
          <button
            class="qty-btn"
            onclick="updateQuantity(${product.id}, 1)"
            aria-label="Zvýšit množství"
          >+</button>
        </div>
        <button
          class="cart-remove"
          onclick="removeFromCart(${product.id})"
          aria-label="Odebrat ${product.name}"
        >Odebrat</button>
      </div>
    </div>
  `).join('');
}

// Expose cart functions globally for inline onclick handlers
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

/* ══════════════════════════════════════════════════════════════
   CART DRAWER OPEN / CLOSE
   ══════════════════════════════════════════════════════════════ */

function openCart() {
  document.body.classList.add('cart-open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  cartClose.focus();
}

function closeCart() {
  document.body.classList.remove('cart-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  cartBtn.focus();
}

cartBtn.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('cart-open')) {
    closeCart();
  }
});

// Checkout (demo)
checkoutBtn && checkoutBtn.addEventListener('click', e => {
  e.preventDefault();
  alert('Funkce brzy k dispozici');
});

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ══════════════════════════════════════════════════════════════ */

let toastTimer = null;

function showToast(message) {
  toastMsg.textContent = message;
  toast.classList.add('show');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════
   NAV SCROLL BEHAVIOR
   ══════════════════════════════════════════════════════════════ */

function handleNavScroll() {
  if (window.scrollY > 60) {
    navWrap.classList.add('scrolled');
  } else {
    navWrap.classList.remove('scrolled');
  }
}

// Throttle scroll events for performance
let navScrollTicking = false;
window.addEventListener('scroll', () => {
  if (!navScrollTicking) {
    requestAnimationFrame(() => {
      handleNavScroll();
      navScrollTicking = false;
    });
    navScrollTicking = true;
  }
}, { passive: true });

// Run once on load (in case page loads mid-scroll)
handleNavScroll();

/* ══════════════════════════════════════════════════════════════
   MOBILE NAV
   ══════════════════════════════════════════════════════════════ */

hamburger && hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

// Close mobile nav when a link is clicked
navLinks && navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger && hamburger.setAttribute('aria-expanded', 'false');
  });
});

/* ══════════════════════════════════════════════════════════════
   SCROLL REVEAL (IntersectionObserver)
   ══════════════════════════════════════════════════════════════ */

function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    // Fallback: show everything immediately
    revealEls.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  revealEls.forEach(el => observer.observe(el));
}

/* ══════════════════════════════════════════════════════════════
   NEWSLETTER FORM
   ══════════════════════════════════════════════════════════════ */

newsletterForm && newsletterForm.addEventListener('submit', e => {
  e.preventDefault();

  const emailInput = document.getElementById('nlEmail');
  if (!emailInput || !emailInput.value.trim()) {
    emailInput && emailInput.focus();
    return;
  }

  // Hide form row, show success
  const inputRow = newsletterForm.querySelector('.nl-input-row');
  const disclaimer = newsletterForm.querySelector('.nl-disclaimer');

  if (inputRow)    inputRow.style.display    = 'none';
  if (disclaimer)  disclaimer.style.display  = 'none';

  nlSuccess.style.display = 'block';

  // Reset after 8 seconds
  setTimeout(() => {
    nlSuccess.style.display    = 'none';
    if (inputRow)   inputRow.style.display   = 'flex';
    if (disclaimer) disclaimer.style.display = 'block';
    emailInput.value = '';
  }, 8000);
});

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */

function init() {
  // Render products first so reveal elements exist
  renderProducts();
  // Initial cart render
  renderCart();
  // Start scroll reveal after products are in DOM
  // Small timeout to allow initial layout paint
  requestAnimationFrame(() => {
    requestAnimationFrame(initScrollReveal);
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
