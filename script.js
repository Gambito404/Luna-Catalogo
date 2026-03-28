// ===================== CONFIGURACIÓN =====================
const PROXY_URL = 'https://corsproxy.io/?';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmFOg19QckG5j_OaZldxicj5x9YxijlFEnoRrW62YXx6Mu5km52v47O9nvsgoM0srsq3OEVvc-U4UR/pub?output=csv';
const FALLBACK_PROXY = 'https://api.allorigins.win/raw?url=';
const SYNC_INTERVAL = 30000; // 30 segundos

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
    // Intentar con proxy principal
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
    
    // Si hay cambios y no estamos en carga inicial, mostrar banner (solo una vez)
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
  const cardStyles = [
    { bg: 'radial-gradient(ellipse at center,#1a1530 0%,#0d0e18 100%)', gc: 'rgba(180,140,220,.18)' },
    { bg: 'radial-gradient(ellipse at center,#151f1a 0%,#0c0f12 100%)', gc: 'rgba(100,200,140,.14)' },
    { bg: 'radial-gradient(ellipse at center,#1e1710 0%,#100e08 100%)', gc: 'rgba(212,175,55,.25)' },
    { bg: 'radial-gradient(ellipse at center,#201a15 0%,#0f0e0b 100%)', gc: 'rgba(200, 150, 100, .15)' },
    { bg: 'radial-gradient(ellipse at center,#251815 0%,#120a0a 100%)', gc: 'rgba(220, 130, 130, .18)' },
    { bg: 'radial-gradient(ellipse at center,#101820 0%,#05080a 100%)', gc: 'rgba(130, 180, 220, .15)' }
  ];

  return rows.slice(1).map((row, idx) => {
    const product = {
      id: null,
      name: '',
      desc: '',
      long: '',
      price: 0,
      oldPrice: null,
      type: '',
      img: '',
      estado: 'inactivo',
      bg: cardStyles[idx % cardStyles.length].bg,
      gc: cardStyles[idx % cardStyles.length].gc,
      beneficios: []
    };

    headers.forEach((header, col) => {
      let value = row[col] || '';
      switch (header) {
        case 'nombre': product.name = value; break;
        case 'id': product.id = parseInt(value); break;
        case 'estado': product.estado = value.toLowerCase().trim(); break;
        case 'descripcion': product.desc = value; product.long = value; break;
        case 'precio':
          let raw = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          product.price = raw;
          break;
        case 'descuento':
          let disc = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          if (disc > 0) {
            product.oldPrice = product.price;
            product.price = product.price - disc;
          }
          break;
        case 'tipo': product.type = value; break;
        case 'imagen':
          if (value.includes('drive.google.com') && value.includes('/d/')) {
            const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
            product.img = match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800` : value;
          } else {
            product.img = value;
          }
          break;
        case 'beneficios':
          product.beneficios = value.split('|').map(s => s.trim()).filter(s => s);
          break;
      }
    });

    product.priceFormatted = '$' + product.price.toFixed(2);
    product.oldPriceFormatted = product.oldPrice ? '$' + product.oldPrice.toFixed(2) : null;

    return product.estado === 'activo' && product.id ? product : null;
  }).filter(p => p !== null);
}

// ===================== RENDER Y ACTUALIZACIÓN =====================
function renderProducts() {
  if (!productsContainer) return;
  productsContainer.innerHTML = '';

  const groups = {};
  products.forEach(p => {
    const type = p.type || 'Colección';
    if (!groups[type]) groups[type] = [];
    groups[type].push(p);
  });

  let html = '';
  for (const [type, items] of Object.entries(groups)) {
    html += `<h3 class="type-title rv">${type}</h3>`;
    html += `<div class="pg">`;
    items.forEach(p => {
      html += createProductCardHTML(p);
    });
    html += `</div>`;
  }
  productsContainer.innerHTML = html;
  observeRv();
}

function createProductCardHTML(p) {
  const badge = p.badge ? `<span class="pb">${p.badge}</span>` : '';
  return `
    <div class="pc rv" id="p-${p.id}" onclick="openModal(${p.id})">
      <div class="pi" style="background:${p.bg}">
        <div class="pig" style="--gc:${p.gc}"></div>
        <img class="pii" src="${p.img}" alt="${p.name}" loading="lazy">
        ${badge}
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

function silentUpdate(newProducts) {
  // 1. Actualizar store
  products = newProducts;

  // 2. Obtener todas las tarjetas existentes
  const existingCards = new Map();
  document.querySelectorAll('.pc').forEach(card => {
    const id = parseInt(card.id.split('-')[1]);
    existingCards.set(id, card);
  });

  // 3. Procesar nuevos productos
  newProducts.forEach(p => {
    const existingCard = existingCards.get(p.id);
    if (existingCard) {
      // Actualizar contenido
      updateCardContent(existingCard, p);
      existingCards.delete(p.id);
    } else {
      // Agregar nueva tarjeta
      const groupTitle = Array.from(document.querySelectorAll('.type-title')).find(el => el.textContent === (p.type || 'Colección'));
      let groupDiv = groupTitle ? groupTitle.nextElementSibling : null;
      if (!groupDiv) {
        const wrapper = document.querySelector('.pw');
        const title = document.createElement('h3');
        title.className = 'type-title rv vis';
        title.textContent = p.type || 'Colección';
        wrapper.insertBefore(title, wrapper.children[0]);
        groupDiv = document.createElement('div');
        groupDiv.className = 'pg';
        wrapper.insertBefore(groupDiv, title.nextSibling);
      }
      groupDiv.insertAdjacentHTML('beforeend', createProductCardHTML(p));
    }
  });

  // 4. Eliminar tarjetas que ya no existen
  existingCards.forEach((card, id) => {
    card.classList.add('fade-out');
    setTimeout(() => card.remove(), 500);
  });

  // 5. Si algún grupo quedó vacío, eliminarlo también
  document.querySelectorAll('.pg').forEach(group => {
    if (group.children.length === 0) {
      const title = group.previousElementSibling;
      if (title && title.classList.contains('type-title')) {
        title.remove();
      }
      group.remove();
    }
  });
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
      <span class="pprice">${p.priceFormatted}</span>
    `;
  }
  let badge = card.querySelector('.pb');
  if (p.badge && !badge) {
    const pi = card.querySelector('.pi');
    pi.insertAdjacentHTML('beforeend', `<span class="pb">${p.badge}</span>`);
  } else if (!p.badge && badge) badge.remove();
  else if (badge) badge.textContent = p.badge;
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

function saveCart() {
  localStorage.setItem('luna_cart', JSON.stringify(cart));
}

function addToCart(productId, quantity = 1) {
  const product = products.find(p => p.id === productId);
  if (!product) {
    showToast('Producto no disponible');
    return false;
  }
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
    showToast(`${quantity} ${product.name} añadido(s). Total: ${existing.quantity}`);
  } else {
    cart.push({ ...product, quantity });
    showToast(`${quantity} ${product.name} añadido al carrito`);
  }
  saveCart();
  updateCartCount();
  renderCartSidebar();
  return true;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartCount();
  renderCartSidebar();
}

function updateQuantity(index, delta) {
  const newQty = cart[index].quantity + delta;
  if (newQty <= 0) {
    removeFromCart(index);
  } else {
    cart[index].quantity = newQty;
    saveCart();
    renderCartSidebar();
  }
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
    cartItemsContainer.innerHTML = '<div class="c-empty">Tu carrito está vacío.<br>Descubre nuestra belleza lunar.</div>';
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
            <button onclick="updateQuantity(${idx}, -1)">-</button>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${idx}, 1)">+</button>
          </div>
        </div>
        <button class="c-rem" onclick="removeFromCart(${idx})">✕</button>
      </div>
    `;
  }).join('');

  cartFoot.style.display = 'block';
  cartFoot.innerHTML = `
    <div class="c-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
    <button class="btn-gf" onclick="validateCheckout()">Finalizar Pedido</button>
  `;
}

// ===================== CHECKOUT CON VALIDACIÓN =====================
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
      cart = updatedCart;
      saveCart();
      renderCartSidebar();
      updateCartCount();
      showValidationModal(changes);
      silentUpdate(freshProducts);
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
      return `<div class="cm-item"><div class="cm-title">${c.name}</div><div class="cm-desc">Precio actualizado: <span style="text-decoration:line-through">${c.old}</span> → <span style="color:var(--gold)">${c.new}</span></div></div>`;
    }
  }).join('');
  modal.classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('cmo').classList.remove('active');
}

function sendOrderToWhatsApp() {
  if (cart.length === 0) {
    showToast('Carrito vacío');
    return;
  }
  let message = "¡Hola! ✨ Quisiera hacer el siguiente pedido:\n\n";
  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    message += `- ${item.quantity}x ${item.name} (${item.priceFormatted}) → $${subtotal.toFixed(2)}\n`;
  });
  message += `\n*Total: $${total.toFixed(2)}*`;
  const phone = '59177424842'; // Reemplazar con tu número
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

// ===================== MODAL =====================
function openModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) {
    showToast('Producto no disponible');
    return;
  }
  const modalContent = document.getElementById('mw');
  let selectedQuantity = 1;

  modalContent.innerHTML = `
    <div class="mt">
      <div class="mv" style="background:${product.bg}">
        <img class="mvi" src="${product.img}" alt="${product.name}" loading="lazy">
      </div>
      <div class="mb">
        <div class="mtype">${product.type}</div>
        <h2 class="mname">${product.name}</h2>
        <p class="mdesc">${product.long || product.desc}</p>
        <div class="mprice">
          ${product.oldPriceFormatted ? `<span class="pprice-old" style="font-size:0.6em; margin-right:15px;">${product.oldPriceFormatted}</span>` : ''}
          ${product.priceFormatted}
        </div>
        <div class="quantity-selector">
          <span>Cantidad:</span>
          <button class="qty-btn" id="qty-minus">-</button>
          <span id="qty-value">1</span>
          <button class="qty-btn" id="qty-plus">+</button>
        </div>
        <div class="mact">
          <button class="btn-gf" id="buy-now-btn">Comprar Ahora</button>
          <button class="btn-o" id="add-to-cart-btn"><span>Añadir al Carrito</span></button>
        </div>
      </div>
    </div>
    <div class="mdet">
      <div class="mdt">Beneficios</div>
      <div class="mdg">
        ${product.beneficios && product.beneficios.length ? `
          <div class="dc">
            <ul>${product.beneficios.map(b => `<li>${b}</li>`).join('')}</ul>
          </div>
        ` : '<div class="dc"><p>Ingredientes naturales para cuidar tu piel.</p></div>'}
        <div class="dc">
          <h4>Envío</h4>
          <ul><li>Envío gratuito en compras superiores a $100</li><li>Entregas a todo el país</li></ul>
        </div>
        <div class="dc">
          <h4>Garantía</h4>
          <ul><li>Producto 100% original</li><li>Certificado de autenticidad</li></ul>
        </div>
      </div>
    </div>
  `;

  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');
  const qtySpan = document.getElementById('qty-value');
  const buyBtn = document.getElementById('buy-now-btn');
  const addBtn = document.getElementById('add-to-cart-btn');

  const updateQuantity = (delta) => {
    let newVal = selectedQuantity + delta;
    if (newVal < 1) newVal = 1;
    if (newVal > 99) newVal = 99;
    selectedQuantity = newVal;
    qtySpan.textContent = selectedQuantity;
  };

  qtyMinus.onclick = () => updateQuantity(-1);
  qtyPlus.onclick = () => updateQuantity(1);

  buyBtn.onclick = () => {
    addToCart(product.id, selectedQuantity);
    closeModal();
    setTimeout(() => openCart(), 300);
  };
  addBtn.onclick = () => {
    addToCart(product.id, selectedQuantity);
    closeModal();
  };

  const modal = document.getElementById('mo');
  modal.classList.add('active');
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

// ===================== REVEAL ON SCROLL =====================
function observeRv() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('vis');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.rv').forEach(el => observer.observe(el));
}

// ===================== NAV THEME OBSERVER =====================
const nav = document.getElementById('mn');
const sections = document.querySelectorAll('section, footer');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const theme = entry.target.getAttribute('data-theme');
      if (theme === 'light') nav.classList.add('nav-light');
      else nav.classList.remove('nav-light');
    }
  });
}, { rootMargin: '-30px 0px -90% 0px' });
sections.forEach(s => sectionObserver.observe(s));

// ===================== SCROLL EFFECT =====================
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

// ===================== PARTICLES (escritorio) =====================
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
      const numStars = Math.floor(width * height / 8000);
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.5 + 0.2,
          o: Math.random() * 0.5 + 0.1,
          p: Math.random() * Math.PI * 2,
          sp: 0.002 + Math.random() * 0.003
        });
      }
    }
    function spawnParticle() {
      if (particles.length > 50) return;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -Math.random() * 0.4 - 0.1,
        life: 0,
        max: 150 + Math.random() * 100,
        r: Math.random() * 1.5 + 0.5
      });
    }
    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      t++;
      stars.forEach(s => {
        const o = s.o * (0.6 + 0.4 * Math.sin(t * s.sp + s.p));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${o})`;
        ctx.fill();
      });
      if (t % 5 === 0) spawnParticle();
      particles = particles.filter(p => p.life < p.max);
      particles.forEach(p => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        const progress = p.life / p.max;
        const o = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${o * 0.4})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize();
    draw();
    window.addEventListener('resize', resize);
  }
}

// ===================== INICIALIZACIÓN =====================
async function init() {
  loadCart();

  // Cargar datos frescos con spinner visible
  const freshData = await fetchProducts(true);
  if (freshData && freshData.length) {
    products = freshData;
    renderProducts();
  } else {
    productsContainer.innerHTML = '<div class="error-message" style="text-align:center; padding:40px; color:var(--gold);">No se pudieron cargar los productos. Por favor, recarga la página.</div>';
  }
  showLoader(false);
  hideSkeleton();
  initialLoad = false;

  // Iniciar verificación periódica
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

// Botón de actualización manual - RECARGA COMPLETA DEL CATÁLOGO
updateNowBtn?.addEventListener('click', async () => {
  updateBanner.classList.remove('active');
  updateBannerVisible = false;
  showLoader(true);
  const fresh = await fetchProducts(true);
  if (fresh && fresh.length) {
    products = fresh;
    // Forzar renderizado completo (no solo actualización silenciosa)
    renderProducts();
    // También actualizar el carrito en caso de cambios en precios/nombres
    const updatedCart = [];
    let cartChanged = false;
    for (const item of cart) {
      const freshItem = fresh.find(p => p.id === item.id);
      if (freshItem) {
        if (freshItem.price !== item.price || freshItem.name !== item.name) {
          cartChanged = true;
        }
        updatedCart.push({ ...freshItem, quantity: item.quantity });
      } else {
        cartChanged = true;
        // Producto ya no existe, lo eliminamos del carrito
        continue;
      }
    }
    if (cartChanged) {
      cart = updatedCart;
      saveCart();
      renderCartSidebar();
      updateCartCount();
      showToast('El catálogo se ha actualizado. Revisa tu carrito.');
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
document.getElementById('mo')?.addEventListener('click', (e) => { if (e.target === document.getElementById('mo')) closeModal(); });
document.querySelectorAll('.sb-nav a').forEach(link => link.addEventListener('click', closeSidebar));