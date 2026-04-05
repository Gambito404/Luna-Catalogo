// ===================== CONFIGURACIÓN =====================
const PROXY_URL = 'https://corsproxy.io/?';
const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmFOg19QckG5j_OaZldxicj5x9YxijlFEnoRrW62YXx6Mu5km52v47O9nvsgoM0srsq3OEVvc-U4UR/pub';
const SHEET_URL = SHEET_BASE + '?output=csv';
const SHEET_URL_MENSAJE = SHEET_BASE + '?output=csv&gid=9360674';
const FALLBACK_PROXY = 'https://api.allorigins.win/raw?url=';
const SYNC_INTERVAL = 30000;

let products = [];
let cart = [];
let currentHash = '';
let updateBannerVisible = false;
let initialLoad = true;

// DOM elements
const productsContainer = document.getElementById('pg');
const cartCountSpan = document.getElementById('cc');
const cartSidebar = document.getElementById('csb');
const cartOverlay = document.getElementById('cbo');
const cartCloseBtn = document.getElementById('csbx');
const cartItemsContainer = document.getElementById('cart-items');
const cartFoot = document.getElementById('cart-foot');
const loaderOverlay = document.getElementById('loader-overlay');
const toastMsg = document.getElementById('tmsg');
const toast = document.getElementById('toast');
const updateBanner = document.getElementById('updateBanner');
const updateNowBtn = document.getElementById('updateNowBtn');
const skeleton = document.getElementById('skeleton-loader');

// ===================== UTILIDADES =====================
function showToast(message, duration = 3500) {
  toastMsg.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function showLoader(show) {
  if (show) {
    loaderOverlay.classList.remove('hidden');
  } else {
    loaderOverlay.classList.add('hidden');
  }
}

function hideSkeleton() {
  if (skeleton) skeleton.style.display = 'none';
}

// ===================== FETCH PRODUCTS =====================
async function fetchProducts(forceFresh = true) {
  try {
    let csvText = null;
    try {
      const url = PROXY_URL + encodeURIComponent(SHEET_URL + '&t=' + Date.now());
      const response = await fetch(url);
      if (response.ok) {
        csvText = await response.text();
      } else {
        throw new Error('Proxy principal falló');
      }
    } catch (err) {
      console.warn('Proxy principal falló, usando fallback:', err);
      const fallbackUrl = FALLBACK_PROXY + encodeURIComponent(SHEET_URL + '&t=' + Date.now());
      const response = await fetch(fallbackUrl);
      if (!response.ok) throw new Error('Fallback falló');
      csvText = await response.text();
    }

    const newProds = parseCSV(csvText);
    const newHash = JSON.stringify(newProds.map(p => ({ id: p.id, estado: p.estado, price: p.price, name: p.name })));

    if (!initialLoad && currentHash !== '' && currentHash !== newHash && !updateBannerVisible) {
      updateBanner.classList.add('active');
      updateBannerVisible = true;
    }

    currentHash = newHash;
    return newProds;
  } catch (error) {
    console.error('Error cargando productos:', error);
    showToast('Error al cargar productos. Revisa tu conexión.');
    return null;
  }
}

// ===================== PARSER CSV =====================
function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell) currentRow.push(currentCell.trim());
  if (currentRow.length > 0) rows.push(currentRow);

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const imgCol = headers.indexOf('imagen');
  const idCol  = headers.indexOf('id');

  const cardStyles = [
    { bg: 'radial-gradient(ellipse at center,#1a1530 0%,#0d0e18 100%)', gc: 'rgba(180,140,220,.2)' },
    { bg: 'radial-gradient(ellipse at center,#151f1a 0%,#0c0f12 100%)', gc: 'rgba(100,200,140,.16)' },
    { bg: 'radial-gradient(ellipse at center,#1e1710 0%,#100e08 100%)', gc: 'rgba(212,175,55,.28)' },
    { bg: 'radial-gradient(ellipse at center,#201a15 0%,#0f0e0b 100%)', gc: 'rgba(200,150,100,.18)' },
    { bg: 'radial-gradient(ellipse at center,#251815 0%,#120a0a 100%)', gc: 'rgba(220,130,130,.2)' },
    { bg: 'radial-gradient(ellipse at center,#101820 0%,#05080a 100%)', gc: 'rgba(130,180,220,.18)' }
  ];

  // Helper: convierte una URL de Drive en thumbnail
  function driveThumb(url) {
    if (!url) return '';
    url = url.trim();
    if (url.includes('drive.google.com') && url.includes('/d/')) {
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url;
    }
    return url;
  }

  const products = [];
  let styleIdx = 0;

  rows.slice(1).forEach(row => {
    const rawId  = idCol  >= 0 ? (row[idCol]  || '').trim() : '';
    const rawImg = imgCol >= 0 ? (row[imgCol] || '').trim() : '';

    // Fila de imagen extra — sin id, solo tiene imagen
    if (!rawId && rawImg && products.length > 0) {
      const last = products[products.length - 1];
      const extra = driveThumb(rawImg);
      if (extra && !last.imgs.includes(extra)) last.imgs.push(extra);
      last.img = last.imgs[0] || '';
      return;
    }

    // Fila de producto normal (tiene id)
    if (!rawId) return;

    const product = {
      id: null, name: '', desc: '', long: '',
      price: 0, oldPrice: null, type: '', img: '', imgs: [],
      estado: 'inactivo',
      bg: cardStyles[styleIdx % cardStyles.length].bg,
      gc: cardStyles[styleIdx % cardStyles.length].gc,
      beneficios: []
    };

    headers.forEach((header, col) => {
      let value = row[col] || '';
      switch (header) {
        case 'nombre':   product.name  = value; break;
        case 'id':       product.id    = parseInt(value); break;
        case 'estado':   product.estado = value.toLowerCase().trim(); break;
        case 'descripcion': product.desc = value; product.long = value; break;
        case 'precio':
          product.price = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          break;
        case 'descuento': {
          const disc = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          if (disc > 0) { product.oldPrice = product.price; product.price -= disc; }
          break;
        }
        case 'tipo': product.type = value; break;
        case 'imagen': {
          // También soporta varias en la misma celda separadas por |
          const urls = value.split('|').map(u => driveThumb(u)).filter(u => u);
          product.imgs = urls;
          product.img  = urls[0] || '';
          break;
        }
        case 'beneficios':
          product.beneficios = value.split('|').map(s => s.trim()).filter(s => s);
          break;
      }
    });

    product.priceFormatted    = '$' + product.price.toFixed(2);
    product.oldPriceFormatted = product.oldPrice ? '$' + product.oldPrice.toFixed(2) : null;

    if (product.estado === 'activo' && product.id) {
      products.push(product);
      styleIdx++;
    }
  });

  return products;
}

// ===================== RENDER =====================
function renderProducts() {
  if (!productsContainer) return;
  productsContainer.innerHTML = '';

  const groups = {};
  const groupOrder = [];
  products.forEach(p => {
    const type = p.type || 'Colección';
    if (!groups[type]) { groups[type] = []; groupOrder.push(type); }
    groups[type].push(p);
  });

  let html = '';
  groupOrder.forEach((type, idx) => {
    const items = groups[type];
    html += `
      <div class="product-group rv">
        <div class="group-header">
          <div class="group-header-left">
            <span class="group-num">${String(idx + 1).padStart(2, '0')}</span>
            <div>
              <h3 class="group-title">${type}</h3>
              <p class="group-count">${items.length} producto${items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div class="group-header-line"></div>
        </div>
        <div class="product-grid">
          ${items.map(p => createProductCardHTML(p)).join('')}
        </div>
      </div>`;
  });
  productsContainer.innerHTML = html;
  observeRv();
}

function createProductCardHTML(p) {
  const badge = p.badge ? `<span class="pb">${p.badge}</span>` : '';
  const imgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
  const hasMultiple = imgs.length > 1;

  const slides = imgs.map((src, i) => `
    <div class="pi-slide ${i===0?'active':''}" data-idx="${i}">
      <img class="pii" src="${src}" alt="${p.name}" loading="lazy">
    </div>`).join('');

  const dots = hasMultiple ? `
    <div class="pi-dots" onclick="event.stopPropagation()">
      ${imgs.map((_,i) => `<button class="pi-dot ${i===0?'active':''}" onclick="cardSlide(event,${p.id},${i})" aria-label="Imagen ${i+1}"></button>`).join('')}
    </div>` : '';

  const arrows = hasMultiple ? `
    <button class="pi-arrow pi-prev" onclick="cardSlide(event,${p.id},-1,true)" aria-label="Anterior">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button class="pi-arrow pi-next" onclick="cardSlide(event,${p.id},1,true)" aria-label="Siguiente">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>` : '';

  return `
    <div class="pc rv" id="p-${p.id}" onclick="openModal(${p.id})">
      <div class="pi-wrap" style="background:${p.bg}">
        <div class="pi-track-outer">
          <div class="pig" style="--gc:${p.gc}"></div>
          <div class="pi-track" id="pt-${p.id}">
            ${slides}
          </div>
          ${dots}
          ${badge}
        </div>
        ${arrows}
      </div>
      <div class="pin">
        <div class="ptype">${p.type}</div>
        <h3 class="pname">${p.name}</h3>
        <p class="pdesc">${p.desc}</p>
        <div class="pft">
          <div class="p-prices">
            ${p.oldPriceFormatted ? `<span class="pprice-old">${p.oldPriceFormatted}</span>` : ''}
            <span class="pprice">${p.priceFormatted}</span>
          </div>
          <button class="pbtn" onclick="event.stopPropagation();openModal(${p.id})">Ver Más</button>
        </div>
      </div>
    </div>`;
}

// Card carousel navigation
function cardSlide(e, productId, indexOrDelta, isDelta = false) {
  e.stopPropagation();
  const track = document.getElementById('pt-' + productId);
  if (!track) return;
  const slides = track.querySelectorAll('.pi-slide');
  if (slides.length < 2) return;
  const card = document.getElementById('p-' + productId);
  const dots = card ? card.querySelectorAll('.pi-dot') : [];
  let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
  if (current === -1) current = 0;
  let next = isDelta ? current + indexOrDelta : indexOrDelta;
  if (next < 0) next = slides.length - 1;
  if (next >= slides.length) next = 0;
  slides[current].classList.remove('active');
  slides[next].classList.add('active');
  if (dots.length) {
    dots[current]?.classList.remove('active');
    dots[next]?.classList.add('active');
  }
}

function silentUpdate(newProducts) {
  products = newProducts;
  // Re-render fully for simplicity and correctness with grouped layout
  renderProducts();
}

function updateCardContent(card, p) {
  const img = card.querySelector('.pii');
  if (img && img.src !== p.img) img.src = p.img;
  const type = card.querySelector('.ptype');
  if (type) type.textContent = p.type;
  const name = card.querySelector('.pname');
  if (name) name.textContent = p.name;
  const desc = card.querySelector('.pdesc');
  if (desc) desc.textContent = p.desc;
  const prices = card.querySelector('.p-prices');
  if (prices) {
    prices.innerHTML = `
      ${p.oldPriceFormatted ? `<span class="pprice-old">${p.oldPriceFormatted}</span>` : ''}
      <span class="pprice">${p.priceFormatted}</span>`;
  }
  card.classList.add('updated');
  setTimeout(() => card.classList.remove('updated'), 2000);
}

// ===================== CARRITO =====================
function loadCart() {
  const stored = localStorage.getItem('luna_cart');
  if (stored) {
    cart = JSON.parse(stored);
    cart.forEach(item => { if (!item.quantity) item.quantity = 1; });
  }
  updateCartCount();
}

function saveCart() { localStorage.setItem('luna_cart', JSON.stringify(cart)); }

function addToCart(productId, quantity = 1) {
  const product = products.find(p => p.id === productId);
  if (!product) { showToast('Producto no disponible'); return false; }
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
    showToast(`${product.name} actualizado en carrito`);
  } else {
    cart.push({ ...product, quantity });
    showToast(`${product.name} añadido al carrito`);
  }
  saveCart(); updateCartCount(); renderCartSidebar();
  return true;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart(); updateCartCount(); renderCartSidebar();
}

function updateQuantity(index, delta) {
  const newQty = cart[index].quantity + delta;
  if (newQty <= 0) { removeFromCart(index); }
  else { cart[index].quantity = newQty; saveCart(); renderCartSidebar(); }
  updateCartCount();
}

function updateCartCount() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountSpan.textContent = totalItems;
  if (totalItems > 0) cartCountSpan.classList.add('active');
  else cartCountSpan.classList.remove('active');
}

function renderCartSidebar() {
  if (!cartItemsContainer) return;
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<div class="c-empty">Tu carrito está vacío.<br><br>Descubre nuestra belleza lunar.</div>';
    cartFoot.style.display = 'none';
    return;
  }
  let total = 0;
  cartItemsContainer.innerHTML = cart.map((item, idx) => {
    const priceNum = parseFloat(item.price);
    const itemTotal = priceNum * item.quantity;
    total += itemTotal;
    return `
      <div class="c-item">
        <div class="c-img"><img src="${item.img}" alt="${item.name}" loading="lazy"></div>
        <div class="c-info">
          <div class="c-name">${item.name}</div>
          <div class="c-price">${item.priceFormatted}</div>
          <div class="c-quantity">
            <button onclick="updateQuantity(${idx},-1)">−</button>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${idx},1)">+</button>
          </div>
        </div>
        <button class="c-rem" onclick="removeFromCart(${idx})">✕</button>
      </div>`;
  }).join('');
  cartFoot.style.display = 'block';
  cartFoot.innerHTML = `
    <div class="c-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
    <button class="btn-primary" style="width:100%;justify-content:center" onclick="validateCheckout()"><span>Finalizar Pedido</span></button>`;
}

// ===================== CHECKOUT =====================
async function validateCheckout() {
  showLoader(true);
  try {
    const freshProducts = await fetchProducts(true);
    if (!freshProducts) throw new Error('No se pudieron obtener datos frescos');
    const changes = [];
    const updatedCart = [];
    for (const item of cart) {
      const fresh = freshProducts.find(p => p.id === item.id);
      if (!fresh) {
        changes.push({ type: 'removed', name: item.name });
      } else {
        if (fresh.price !== item.price) {
          changes.push({ type: 'price', name: item.name, old: item.priceFormatted, new: fresh.priceFormatted });
        }
        updatedCart.push({ ...fresh, quantity: item.quantity });
      }
    }
    if (changes.length > 0) {
      cart = updatedCart; saveCart(); renderCartSidebar(); updateCartCount();
      showValidationModal(changes); silentUpdate(freshProducts);
    } else {
      sendOrderToWhatsApp();
    }
  } catch (error) {
    console.error(error);
    showToast('Error al verificar inventario. Intenta de nuevo.');
  } finally {
    showLoader(false);
  }
}

function showValidationModal(changes) {
  const modal = document.getElementById('cmo');
  const content = document.getElementById('cm-content');
  content.innerHTML = changes.map(c => {
    if (c.type === 'removed') {
      return `<div class="cm-item removed"><div class="cm-title">${c.name}</div><div class="cm-desc">Producto no disponible</div></div>`;
    } else {
      return `<div class="cm-item"><div class="cm-title">${c.name}</div><div class="cm-desc">Precio actualizado: <span style="text-decoration:line-through">${c.old}</span> → <strong style="color:var(--gold)">${c.new}</strong></div></div>`;
    }
  }).join('');
  modal.classList.add('active');
}

function closeCheckoutModal() { document.getElementById('cmo').classList.remove('active'); }

function sendOrderToWhatsApp() {
  if (cart.length === 0) { showToast('Carrito vacío'); return; }
  let message = "¡Hola! ✨ Quisiera hacer el siguiente pedido:\n\n";
  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    message += `- ${item.quantity}x ${item.name} (${item.priceFormatted}) → $${subtotal.toFixed(2)}\n`;
  });
  message += `\n*Total: $${total.toFixed(2)}*`;
  const phone = '59169485374';
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

// ===================== MODAL =====================
function openModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) { showToast('Producto no disponible'); return; }
  const modalContent = document.getElementById('mw');
  let selectedQuantity = 1;

  const imgs = product.imgs && product.imgs.length ? product.imgs : (product.img ? [product.img] : ['']);
  let currentImg = 0;

  const buildGallery = () => `
    <div class="mg-wrap" style="background:${product.bg}">
      <div class="mg-main" id="mg-main">
        <img class="mg-img" id="mg-img" src="${imgs[currentImg]}" alt="${product.name}">
        ${imgs.length > 1 ? `
        <button class="mg-arrow mg-prev" id="mg-prev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="mg-arrow mg-next" id="mg-next">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="mg-counter"><span id="mg-cur">1</span> / ${imgs.length}</div>` : ''}
      </div>
      ${imgs.length > 1 ? `
      <div class="mg-thumbs" id="mg-thumbs">
        ${imgs.map((src,i) => `<button class="mg-thumb ${i===0?'active':''}" data-i="${i}" onclick="mgGoTo(${i})">
          <img src="${src}" alt="Vista ${i+1}" loading="lazy">
        </button>`).join('')}
      </div>` : ''}
    </div>`;

  modalContent.innerHTML = `
    <div class="mt mt-gallery">
      ${buildGallery()}
      <div class="mb">
        <div class="mtype">${product.type}</div>
        <h2 class="mname">${product.name}</h2>
        <p class="mdesc">${product.long || product.desc}</p>
        <div class="mprice">
          ${product.oldPriceFormatted ? `<span class="pprice-old" style="font-size:.55em;margin-right:12px;">${product.oldPriceFormatted}</span>` : ''}
          ${product.priceFormatted}
        </div>
        <div class="quantity-selector">
          <span>Cantidad:</span>
          <button class="qty-btn" id="qty-minus">−</button>
          <span id="qty-value">1</span>
          <button class="qty-btn" id="qty-plus">+</button>
        </div>
        <div class="mact">
          <button class="btn-primary" id="buy-now-btn" style="flex:1;justify-content:center"><span>Comprar Ahora</span></button>
          <button class="btn-ghost" id="add-to-cart-btn" style="flex:1;justify-content:center">Añadir al Carrito</button>
        </div>
      </div>
    </div>
    ${product.beneficios && product.beneficios.length ? `
    <div class="mdet">
      <div class="mdt">Beneficios</div>
      <div class="dc">
        <ul>${product.beneficios.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
    </div>` : ''}`;

  // Gallery controls
  function mgGoTo(i) {
    const imgs2 = product.imgs && product.imgs.length ? product.imgs : [product.img];
    currentImg = (i + imgs2.length) % imgs2.length;
    const el = document.getElementById('mg-img');
    const cur = document.getElementById('mg-cur');
    const thumbs = document.querySelectorAll('.mg-thumb');
    if (el) { el.classList.add('mg-fade'); setTimeout(()=>{ el.src = imgs2[currentImg]; el.classList.remove('mg-fade'); },180); }
    if (cur) cur.textContent = currentImg + 1;
    thumbs.forEach((t,ti) => t.classList.toggle('active', ti === currentImg));
  }
  document.getElementById('mg-prev')?.addEventListener('click', () => mgGoTo(currentImg - 1));
  document.getElementById('mg-next')?.addEventListener('click', () => mgGoTo(currentImg + 1));
  window.mgGoTo = mgGoTo;

  // Swipe táctil en la imagen principal
  const mgMain = document.getElementById('mg-main');
  if (mgMain) {
    let tx = 0;
    mgMain.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, {passive:true});
    mgMain.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) mgGoTo(currentImg + (dx < 0 ? 1 : -1));
    }, {passive:true});
  }

  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');
  const qtySpan = document.getElementById('qty-value');
  const buyBtn = document.getElementById('buy-now-btn');
  const addBtn = document.getElementById('add-to-cart-btn');

  const updateQty = (delta) => {
    let newVal = selectedQuantity + delta;
    if (newVal < 1) newVal = 1;
    if (newVal > 99) newVal = 99;
    selectedQuantity = newVal;
    qtySpan.textContent = selectedQuantity;
  };

  qtyMinus.onclick = () => updateQty(-1);
  qtyPlus.onclick = () => updateQty(1);
  buyBtn.onclick = () => { addToCart(product.id, selectedQuantity); closeModal(); setTimeout(() => openCart(), 300); };
  addBtn.onclick = () => { addToCart(product.id, selectedQuantity); closeModal(); };

  document.getElementById('mo').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('mo').classList.remove('active');
  document.body.style.overflow = '';
}

// ===================== SIDEBAR =====================
function openSidebar() {
  document.getElementById('sb').classList.add('open');
  document.getElementById('sbo').classList.add('open');
  document.getElementById('hbg').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sb').classList.remove('open');
  document.getElementById('sbo').classList.remove('open');
  document.getElementById('hbg').classList.remove('open');
  document.body.style.overflow = '';
}
function openCart() {
  renderCartSidebar();
  cartSidebar.classList.add('open');
  cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  cartSidebar.classList.remove('open');
  cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ===================== SCROLL REVEAL =====================
function observeRv() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('vis');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.rv').forEach(el => observer.observe(el));
}

// ===================== NAV SCROLL =====================
const nav = document.getElementById('mn');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

// ===================== PARTICLES =====================
if (window.innerWidth >= 768) {
  const canvas = document.getElementById('pc');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height, stars = [], particles = [];
    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    }
    function initStars() {
      stars = [];
      const numStars = Math.floor(width * height / 9000);
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * width, y: Math.random() * height,
          r: Math.random() * 1.2 + 0.2, o: Math.random() * 0.4 + 0.1,
          p: Math.random() * Math.PI * 2, sp: 0.002 + Math.random() * 0.003
        });
      }
    }
    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      t++;
      stars.forEach(s => {
        const o = s.o * (0.6 + 0.4 * Math.sin(t * s.sp + s.p));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${o})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', resize);
  }
}

// ===================== BIRTHDAY SPLASH =====================
async function fetchMensaje() {
  const baseUrl = SHEET_URL_MENSAJE + '&t=' + Date.now();
  console.log('[MENSAJE] URL:', baseUrl);

  try {
    const res = await fetch(baseUrl, { cache: 'no-store' });
    console.log('[MENSAJE] Status:', res.status);
    if (res.ok) {
      const txt = await res.text();
      console.log('[MENSAJE] Respuesta:\n', txt.slice(0, 300));
      return txt;
    }
  } catch(e) { console.warn('[MENSAJE] Directo error:', e.message); }

  try {
    const url = PROXY_URL + encodeURIComponent(baseUrl);
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const txt = await res.text();
      console.log('[MENSAJE] Proxy respuesta:\n', txt.slice(0, 300));
      return txt;
    }
  } catch(e) { console.warn('[MENSAJE] Proxy error:', e.message); }

  try {
    const url = FALLBACK_PROXY + encodeURIComponent(baseUrl);
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const txt = await res.text();
      console.log('[MENSAJE] Fallback respuesta:\n', txt.slice(0, 300));
      return txt;
    }
  } catch(e) { console.warn('[MENSAJE] Fallback error:', e.message); }

  console.error('[MENSAJE] Todos los métodos fallaron');
  return null;
}

function parseMensaje(csv) {
  if (!csv) return null;
  console.log('[MENSAJE] CSV recibido (primeros 300 chars):\n', csv.slice(0, 300));

  const rows = [];
  let cur = [], cell = '', inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i], n = csv[i+1];
    if (c === '"') { if (inQ && n === '"') { cell += '"'; i++; } else { inQ = !inQ; } }
    else if (c === ',' && !inQ) { cur.push(cell.trim()); cell = ''; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      cur.push(cell.trim()); cell = '';
      if (cur.some(v => v)) rows.push(cur);
      cur = [];
    } else { cell += c; }
  }
  if (cell) cur.push(cell.trim());
  if (cur.some(v => v)) rows.push(cur);

  if (rows.length < 2) return null;

  const keys = rows[0].map(k => k.toLowerCase().trim().replace(/^"|"$/g,''));
  const vals = rows[1].map(v => v.trim().replace(/^"|"$/g,''));

  const data = {};
  keys.forEach((k, i) => { if (k) data[k] = vals[i] || ''; });
  console.log('[MENSAJE] Claves encontradas:', keys);
  console.log('[MENSAJE] Valores encontrados:', vals);
  console.log('[MENSAJE] Objeto final:', data);
  return data;
}

function showBirthdaySplash(data) {
  const splash = document.getElementById('bday-splash');
  if (!splash) return;

  // Aplicar contenido desde sheets
  if (data) {
    if (data.titulo)  document.getElementById('bdayTitle').textContent = data.titulo;
    if (data.nombre)  document.getElementById('bdayName').textContent = data.nombre;
    if (data.mensaje) document.getElementById('bdayText').textContent = data.mensaje;
    if (data.de)      document.getElementById('bdayFrom').textContent = '✦ De: ' + data.de + ' ✦';
  }

  // Crear partículas animadas
  const container = document.getElementById('bdayParticles');
  if (container) {
    const symbols = ['✦', '✧', '❤', '🌙', '⭐', '✨'];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('span');
      p.className = 'bday-particle';
      p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      p.style.cssText = `
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        animation-delay:${Math.random()*6}s;
        animation-duration:${4 + Math.random()*6}s;
        font-size:${10 + Math.random()*18}px;
        opacity:${0.08 + Math.random()*0.18};
      `;
      container.appendChild(p);
    }
  }

  // Mostrar splash con animación
  splash.classList.remove('bday-hidden');
  splash.classList.add('bday-show');
  document.body.style.overflow = 'hidden';

  // Botón entrar
  document.getElementById('bdayEnter')?.addEventListener('click', closeBirthdaySplash);
}

function closeBirthdaySplash() {
  const splash = document.getElementById('bday-splash');
  if (!splash) return;
  splash.classList.add('bday-exit');
  document.body.style.overflow = '';
  setTimeout(() => {
    splash.style.display = 'none';
  }, 900);
}

// ===================== INIT =====================
async function init() {
  loadCart();

  // 1. Fetch mensaje y productos en paralelo
  const [msgCsv, freshData] = await Promise.all([
    fetchMensaje(),
    fetchProducts(true)
  ]);

  // 2. Renderizar productos
  if (freshData && freshData.length) {
    products = freshData;
    renderProducts();
  } else {
    if (productsContainer) {
      productsContainer.innerHTML = '<div style="text-align:center;padding:60px 24px;color:var(--gold);font-family:\'Syne\',sans-serif;font-size:13px;letter-spacing:.14em">No se pudieron cargar los productos. Por favor, recarga la página.</div>';
    }
  }

  // 3. Ocultar loader
  showLoader(false);
  hideSkeleton();
  initialLoad = false;

  // 4. Mostrar splash de cumpleaños
  const msgData = parseMensaje(msgCsv);
  // Muestra siempre salvo que activo sea explícitamente "no"
  const splashDesactivado = msgData && msgData.activo && msgData.activo.toLowerCase() === 'no';
  if (!splashDesactivado) {
    setTimeout(() => showBirthdaySplash(msgData), 200);
  }

  // 5. Sincronización periódica
  setInterval(async () => {
    if (document.visibilityState === 'visible') {
      const newData = await fetchProducts(true);
      if (newData && JSON.stringify(newData.map(p => ({ id: p.id, estado: p.estado, price: p.price, name: p.name }))) !== currentHash) {
        silentUpdate(newData);
        products = newData;
      }
    }
  }, SYNC_INTERVAL);
}

updateNowBtn?.addEventListener('click', async () => {
  updateBanner.classList.remove('active');
  updateBannerVisible = false;
  showLoader(true);
  const fresh = await fetchProducts(true);
  if (fresh && fresh.length) {
    products = fresh;
    renderProducts();
    const updatedCart = [];
    let cartChanged = false;
    for (const item of cart) {
      const freshItem = fresh.find(p => p.id === item.id);
      if (freshItem) {
        if (freshItem.price !== item.price || freshItem.name !== item.name) cartChanged = true;
        updatedCart.push({ ...freshItem, quantity: item.quantity });
      } else {
        cartChanged = true;
      }
    }
    if (cartChanged) {
      cart = updatedCart; saveCart(); renderCartSidebar(); updateCartCount();
      showToast('El catálogo se actualizó. Revisa tu carrito.');
    } else {
      showToast('Catálogo actualizado');
    }
  } else {
    showToast('No se pudo actualizar. Revisa tu conexión.');
  }
  showLoader(false);
});

document.addEventListener('DOMContentLoaded', init);

// Eventos
document.getElementById('hbg')?.addEventListener('click', openSidebar);
document.getElementById('sbx')?.addEventListener('click', closeSidebar);
document.getElementById('sbo')?.addEventListener('click', closeSidebar);
document.getElementById('cartBtn')?.addEventListener('click', openCart);
cartCloseBtn?.addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);
document.getElementById('mcl')?.addEventListener('click', closeModal);
document.getElementById('mo')?.addEventListener('click', e => { if (e.target === document.getElementById('mo')) closeModal(); });
document.querySelectorAll('.sb-nav a').forEach(link => link.addEventListener('click', closeSidebar));
