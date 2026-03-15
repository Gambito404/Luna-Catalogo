const PRODS = [
  {id:1,icon:'✨',type:'Sérum Facial',name:'Sérum Lunar',desc:'Iluminación instantánea y nutrición profunda.',long:'Nuestro Sérum Lunar es la joya de nuestra línea. Formulado con extractos de flores de luna y ácido hialurónico de triple peso molecular, penetra en las capas más profundas para una hidratación duradera y luminosidad sin igual.',price:'$60.00',badge:'Más Vendido',bg:'radial-gradient(ellipse at center,#1a1530 0%,#0d0e18 100%)',gc:'rgba(180,140,220,.18)',ing:['Ácido Hialurónico','Extracto de Perla','Vitamina C estabilizada'],ben:['Hidratación intensa 72h','Luminosidad inmediata','Efecto anti-edad visible'],ste:['Aplica 2–3 gotas al rostro limpio','Masajea en movimientos circulares hacia arriba','Deja absorber 1 min antes de continuar']},
  {id:2,icon:'🌙',type:'Crema Hidratante',name:'Crema Nocturna',desc:'Regeneración celular mientras sueñas.',long:'La Crema Nocturna LUNA trabaja mientras duermes. Su fórmula rica en retinol y aceite de rosa mosqueta regenera tu piel durante las horas de descanso para que despiertes radiante cada mañana.',price:'$45.00',badge:'Nuevo',bg:'radial-gradient(ellipse at center,#151f1a 0%,#0c0f12 100%)',gc:'rgba(100,200,140,.14)',ing:['Retinol encapsulado','Aceite de Rosa Mosqueta','Manteca de Karité orgánica'],ben:['Regeneración nocturna activa','Firmeza y elasticidad','Textura visiblemente renovada'],ste:['Limpia y tonifica el rostro','Aplica por la noche como último paso','Masajea suavemente hacia el cuello']},
  {id:3,icon:'💛',type:'Esencia de Lujo',name:'Esencia Dorada',desc:'Oro de 24k para una piel eterna.',long:'La Esencia Dorada LUNA combina partículas de oro coloidal con extractos botánicos para una piel visiblemente más firme, luminosa y rejuvenecida. El tratamiento definitivo de lujo para tu rutina.',price:'$80.00',badge:'Premium',bg:'radial-gradient(ellipse at center,#1e1710 0%,#100e08 100%)',gc:'rgba(212,175,55,.25)',ing:['Oro Coloidal 24k','Niacinamida al 10%','Complejo de Péptidos'],ben:['Firmeza visible desde día 7','Tono de piel uniforme','Efecto anti-manchas'],ste:['Aplica tras la limpieza facial','Extiende uniformemente por el rostro','Continúa con tu crema habitual']}
];

// --- CART LOGIC WITH LOCAL STORAGE ---
let cart = JSON.parse(localStorage.getItem('luna_cart_data')) || [];
updateCartUI();

function addCart(id, buy = false) {
  const p = PRODS.find(x => x.id === id);
  if(p) {
    cart.push(p);
    saveCart();
    updateCartUI();
    showToast(buy ? `¡Procesando ${p.name}!` : `${p.name} añadido`);
    
    if (buy) {
        closeM();
        openCart();
    }
  }
}

function saveCart() {
  localStorage.setItem('luna_cart_data', JSON.stringify(cart));
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
  renderCartContents();
}

function updateCartUI() {
  const el = document.getElementById('cc');
  if (el) {
    el.textContent = cart.length;
    if (cart.length > 0) el.classList.add('active');
    else el.classList.remove('active');
  }
}

// Cart Sidebar Logic
const csb = document.getElementById('csb');
const cbo = document.getElementById('cbo');
const csbx = document.getElementById('csbx');

if(csbx) csbx.onclick = closeCart;
if(cbo) cbo.onclick = closeCart;

function openCart() {
  renderCartContents();
  if(csb) csb.classList.add('open');
  if(cbo) cbo.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  if(csb) csb.classList.remove('open');
  if(cbo) cbo.classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartContents() {
  const container = document.getElementById('cart-items');
  const foot = document.getElementById('cart-foot');
  if(!container) return;

  if(cart.length === 0) {
    container.innerHTML = '<div class="c-empty">Tu carrito está vacío.<br>Descubre nuestra belleza lunar.</div>';
    foot.style.display = 'none';
  } else {
    let total = 0;
    container.innerHTML = cart.map((p, i) => {
      const priceNum = parseFloat(p.price.replace('$',''));
      total += priceNum;
      return `
      <div class="c-item">
        <div class="c-img">${p.icon}</div>
        <div class="c-info">
          <div class="c-name">${p.name}</div>
          <div class="c-price">${p.price}</div>
        </div>
        <button class="c-rem" onclick="removeFromCart(${i})">✕</button>
      </div>`;
    }).join('');
    
    foot.style.display = 'block';
    foot.innerHTML = `
      <div class="c-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      <button class="btn-gf">Checkout</button>
    `;
  }
}

// --- RENDER PRODUCTS ---
function renderProds() {
  const container = document.getElementById('pg');
  if (!container) return;
  
  container.innerHTML = PRODS.map((p, i) => `
    <div class="pc rv" style="transition-delay:${i * 0.15}s" onclick="openM(${p.id})">
      <div class="pi" style="background:${p.bg}">
        <div class="pig" style="--gc:${p.gc}"></div>
        <div class="pii">${p.icon}</div>
        ${p.badge ? `<span class="pb">${p.badge}</span>` : ''}
      </div>
      <div class="pin">
        <div class="ptype">${p.type}</div>
        <h3 class="pname">${p.name}</h3>
        <p class="pdesc">${p.desc}</p>
        <div class="pft"><span class="pprice">${p.price}</span>
          <button class="pbtn" onclick="event.stopPropagation();openM(${p.id})">Ver Más</button>
        </div>
      </div>
    </div>`).join('');
  observeRv();
}

// --- MODAL LOGIC ---
function openM(id) {
  const p = PRODS.find(x => x.id === id);
  if (!p) return;
  
  document.getElementById('mw').innerHTML = `
    <div class="mt">
      <div class="mv" style="background:${p.bg}">
        <div class="mvi">${p.icon}</div>
      </div>
      <div class="mb">
        <div class="mtype">${p.type}</div>
        <h2 class="mname">${p.name}</h2>
        <p class="mdesc">${p.long}</p>
        <div class="mprice">${p.price}</div>
        <div class="mact">
          <button class="btn-gf" onclick="addCart(${p.id}, true)">Comprar Ahora</button>
          <button class="btn-o" onclick="addCart(${p.id})"><span>Añadir al Carrito</span></button>
        </div>
        <div class="mtr">
          <div class="tr">Envío internacional gratuito</div>
          <div class="tr">Certificado de autenticidad</div>
          <div class="tr">Ingredientes 100% orgánicos</div>
        </div>
      </div>
    </div>
    <div class="mdet">
      <div class="mdt">Detalles Exclusivos</div>
      <div class="mdg">
        <div class="dc"><h4>Ingredientes</h4><ul>${p.ing.map(i => `<li>${i}</li>`).join('')}</ul></div>
        <div class="dc"><h4>Beneficios</h4><ul>${p.ben.map(b => `<li>${b}</li>`).join('')}</ul></div>
        <div class="dc"><h4>Ritual</h4><ul>${p.ste.map(s => `<li>${s}</li>`).join('')}</ul></div>
      </div>
    </div>`;
  
  const mo = document.getElementById('mo');
  mo.classList.add('active');
  document.body.style.overflow = 'hidden';
}

const closeBtn = document.getElementById('mcl');
if(closeBtn) closeBtn.onclick = closeM;
const modalOverlay = document.getElementById('mo');
if(modalOverlay) modalOverlay.onclick = function(e) { if (e.target === this) closeM(); };

function closeM() {
  document.getElementById('mo').classList.remove('active');
  document.body.style.overflow = '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('tmsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// --- SIDEBAR LOGIC (FIXED) ---
const hbg = document.getElementById('hbg');
const sb = document.getElementById('sb');
const sbo = document.getElementById('sbo');
const sbx = document.getElementById('sbx');

if(hbg) hbg.onclick = () => sb.classList.contains('open') ? closeSB() : openSB();
if(sbo) sbo.onclick = closeSB;

// Corrección botón cerrar sidebar: evento directo
if(sbx) sbx.onclick = closeSB;
document.querySelectorAll('.sb-nav a').forEach(link => link.addEventListener('click', closeSB));

function openSB() {
  sb.classList.add('open');
  sbo.classList.add('open');
  hbg.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSB() {
  sb.classList.remove('open');
  sbo.classList.remove('open');
  hbg.classList.remove('open');
  document.body.style.overflow = '';
}

// --- SCROLL EFFECTS ---
window.addEventListener('scroll', () => {
    const nav = document.getElementById('mn');
    if(nav) nav.classList.toggle('scrolled', window.scrollY > 50);
});

// --- CURSOR ---
const co = document.getElementById('cur-o');
const ci = document.getElementById('cur-i');
if(co && ci) {
    let mx = 0, my = 0, ox = 0, oy = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; ci.style.left = mx + 'px'; ci.style.top = my + 'px'; });
    
    (function anim() {
        ox += (mx - ox) * 0.15;
        oy += (my - oy) * 0.15;
        co.style.left = ox + 'px';
        co.style.top = oy + 'px';
        requestAnimationFrame(anim);
    })();
    
    document.querySelectorAll('a, button, .pc, .fsi').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('ch'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('ch'));
    });
}

// --- PARTICLES ---
(function() {
  const c = document.getElementById('pc');
  if(!c) return;
  const ctx = c.getContext('2d');
  let W, H, stars = [], parts = [];
  
  function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
  
  function initStars() {
    stars = [];
    const n = Math.floor(W * H / 7000); // Optimizado: Menos estrellas
    for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.2, o: Math.random() * 0.5 + 0.1, p: Math.random() * Math.PI * 2, sp: 0.002 + Math.random() * 0.003 });
  }
  
  function spawnP() {
    if (parts.length > 40) return; // Optimizado: Menos partículas activas
    parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.2, vy: -Math.random() * 0.4 - 0.1, life: 0, max: 200 + Math.random() * 150, r: Math.random() * 1.5 + 0.5 });
  }
  
  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t++;
    stars.forEach(s => {
      const o = s.o * (0.6 + 0.4 * Math.sin(t * s.sp + s.p));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 175, 55, ${o})`;
      ctx.fill();
    });
    
    if (t % 5 === 0) spawnP();
    parts = parts.filter(p => p.life < p.max);
    parts.forEach(p => {
      p.life++; p.x += p.vx; p.y += p.vy;
      const pr = p.life / p.max, o = pr < 0.2 ? pr / 0.2 : pr > 0.8 ? (1 - pr) / 0.2 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 175, 55, ${o * 0.4})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  
  resize(); initStars(); draw();
  window.addEventListener('resize', () => { resize(); initStars(); });
})();

// --- REVEAL ON SCROLL ---
function observeRv() {
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('vis');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
}

// Init
renderProds();
observeRv();
