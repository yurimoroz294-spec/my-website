(function () {
  'use strict';

  const script   = document.currentScript;
  const apiKey   = script.getAttribute('data-api-key');
  const apiBase  = script.getAttribute('data-api-url') || new URL(script.src).origin;
  const position = script.getAttribute('data-position') || 'right';
  const color    = script.getAttribute('data-color')    || '#4f6ef7';
  const greeting = script.getAttribute('data-greeting') || 'Ahoj! Jak vám mohu pomoci?';

  if (!apiKey) { console.warn('[Zapi] data-api-key chybí'); return; }
  if (window.__zapiLoaded) return;
  window.__zapiLoaded = true;

  // ── Session ID ────────────────────────────────────────────────────────────
  const sessionId = (() => {
    const key = 'zapi_sid';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  // ── State ─────────────────────────────────────────────────────────────────
  let convId   = null;
  let isOpen   = false;
  let isBusy   = false;

  // ── Shadow host ───────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.setAttribute('id', 'zapi-widget-host');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // ── CSS ───────────────────────────────────────────────────────────────────
  const side = position === 'left' ? 'left:24px' : 'right:24px';

  const css = `
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}

#btn{
  position:fixed;bottom:24px;${side};
  width:56px;height:56px;border-radius:50%;
  background:${color};border:none;cursor:pointer;
  box-shadow:0 4px 20px rgba(0,0,0,.28);
  display:flex;align-items:center;justify-content:center;
  z-index:2147483646;transition:transform .2s,box-shadow .2s;
}
#btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.35)}
#btn svg{width:26px;height:26px;fill:#fff;pointer-events:none}

#panel{
  position:fixed;bottom:92px;${side};
  width:360px;max-height:520px;
  background:#fff;border-radius:18px;
  box-shadow:0 8px 48px rgba(0,0,0,.18);
  display:flex;flex-direction:column;overflow:hidden;
  z-index:2147483645;
  opacity:0;transform:translateY(14px) scale(.96);
  transition:opacity .22s ease,transform .22s ease;
  pointer-events:none;
}
#panel.open{opacity:1;transform:none;pointer-events:all}

/* Header */
#hdr{
  background:${color};color:#fff;
  padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;
}
#av{
  width:36px;height:36px;border-radius:50%;
  background:rgba(255,255,255,.22);
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:16px;flex-shrink:0;
}
#info{flex:1;min-width:0}
#info strong{display:block;font-size:15px}
#info span{font-size:12px;opacity:.85}
#close-btn{
  background:none;border:none;cursor:pointer;
  color:#fff;opacity:.75;padding:4px;flex-shrink:0;
  display:flex;align-items:center;
}
#close-btn:hover{opacity:1}
#close-btn svg{width:20px;height:20px;fill:currentColor}

/* Messages */
#msgs{
  flex:1;overflow-y:auto;
  padding:14px 14px 8px;
  display:flex;flex-direction:column;gap:9px;
  scroll-behavior:smooth;
}
#msgs::-webkit-scrollbar{width:4px}
#msgs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px}

.m{
  max-width:84%;padding:10px 14px;
  font-size:14px;line-height:1.5;
  border-radius:16px;
  animation:pop .18s ease;
}
@keyframes pop{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.m.bot{
  background:#f1f4fb;color:#1a1a2e;
  border-bottom-left-radius:4px;align-self:flex-start;
}
.m.user{
  background:${color};color:#fff;
  border-bottom-right-radius:4px;align-self:flex-end;
}
.m.err{background:#fee2e2;color:#b91c1c;align-self:flex-start;border-bottom-left-radius:4px}

/* Typing dots */
#dots{
  align-self:flex-start;display:none;
  background:#f1f4fb;border-radius:16px;border-bottom-left-radius:4px;
  padding:12px 16px;gap:5px;align-items:center;
}
#dots.show{display:flex}
#dots span{
  width:7px;height:7px;border-radius:50%;background:#9ca3af;
  animation:bounce 1.2s infinite ease-in-out;
}
#dots span:nth-child(2){animation-delay:.2s}
#dots span:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:scale(.65);opacity:.45}40%{transform:scale(1);opacity:1}}

/* Input row */
#foot{
  padding:10px 12px;border-top:1px solid #e9ecef;
  display:flex;gap:8px;align-items:flex-end;flex-shrink:0;
}
#inp{
  flex:1;border:1.5px solid #d1d5db;border-radius:10px;
  padding:9px 12px;font-size:14px;resize:none;
  max-height:96px;outline:none;color:#111;
  line-height:1.45;font-family:inherit;
  transition:border-color .15s;
}
#inp:focus{border-color:${color}}
#inp:disabled{opacity:.6}
#send{
  width:38px;height:38px;border-radius:10px;
  background:${color};border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;transition:opacity .15s;
}
#send:disabled{opacity:.4;cursor:default}
#send svg{width:18px;height:18px;fill:#fff}

/* Footer brand */
#brand{
  text-align:center;padding:5px 0 7px;
  font-size:11px;color:#b0b8c9;border-top:1px solid #f3f4f6;flex-shrink:0;
}
#brand a{color:#b0b8c9;text-decoration:none}
#brand a:hover{color:#6b7280}

@media(max-width:480px){
  #panel{
    ${position === 'left' ? 'left:8px' : 'left:8px;right:8px'};
    width:calc(100vw - 16px);bottom:84px;max-height:72vh;
  }
  #btn{bottom:16px;${position === 'left' ? 'left:16px' : 'right:16px'}}
}
`;

  // ── HTML ──────────────────────────────────────────────────────────────────
  shadow.innerHTML = `
<style>${css}</style>

<button id="btn" aria-label="Otevřít Zapi chat">
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
</button>

<div id="panel" role="dialog" aria-modal="true" aria-label="Zapi chat">
  <div id="hdr">
    <div id="av">Z</div>
    <div id="info">
      <strong>Zapi</strong>
      <span>AI asistent · online</span>
    </div>
    <button id="close-btn" aria-label="Zavřít chat">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
  </div>

  <div id="msgs">
    <div class="m bot"></div>
    <div id="dots"><span></span><span></span><span></span></div>
  </div>

  <div id="foot">
    <textarea id="inp" rows="1" placeholder="Napište zprávu…" maxlength="1000"></textarea>
    <button id="send" aria-label="Odeslat zprávu">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
  <div id="brand">Powered by <a href="https://zapi.cz" target="_blank" rel="noopener">Zapi</a></div>
</div>
`;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const btn      = shadow.getElementById('btn');
  const panel    = shadow.getElementById('panel');
  const closeBtn = shadow.getElementById('close-btn');
  const msgs     = shadow.getElementById('msgs');
  const dots     = shadow.getElementById('dots');
  const inp      = shadow.getElementById('inp');
  const sendBtn  = shadow.getElementById('send');

  // Set greeting text
  shadow.querySelector('.m.bot').textContent = greeting;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function addMsg(text, type) {
    const el = document.createElement('div');
    el.className = 'm ' + type;
    el.textContent = text;
    msgs.insertBefore(el, dots);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function setBusy(on) {
    isBusy = on;
    dots.classList.toggle('show', on);
    sendBtn.disabled = on;
    inp.disabled = on;
    msgs.scrollTop = msgs.scrollHeight;
  }

  function autoResize() {
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 96) + 'px';
  }

  // ── API ───────────────────────────────────────────────────────────────────
  async function startConv() {
    const r = await fetch(apiBase + '/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!r.ok) throw new Error('conv_start');
    return (await r.json()).id;
  }

  async function send(text) {
    if (!convId) convId = await startConv();
    const r = await fetch(`${apiBase}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ content: text }),
    });
    if (r.status === 402) throw new Error('trial_expired');
    if (!r.ok) throw new Error('send');
    return r.json();
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = inp.value.trim();
    if (!text || isBusy) return;

    inp.value = '';
    inp.style.height = 'auto';
    addMsg(text, 'user');
    setBusy(true);

    try {
      const reply = await send(text);
      setBusy(false);
      addMsg(reply.content, 'bot');
    } catch (e) {
      setBusy(false);
      if (e.message === 'trial_expired') {
        addMsg('Zkušební verze vypršela. Prosím kontaktujte správce e-shopu.', 'err');
      } else {
        addMsg('Omlouvám se, nastala chyba. Zkuste to prosím znovu.', 'err');
      }
    }
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(() => inp.focus(), 240);
    // Eagerly start conversation in background
    if (!convId) startConv().then(id => { convId = id; }).catch(() => {});
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);
  sendBtn.addEventListener('click', handleSend);

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  inp.addEventListener('input', autoResize);

  // Close on outside click
  document.addEventListener('click', e => {
    if (isOpen && e.target !== host) closePanel();
  }, { capture: false });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

})();
