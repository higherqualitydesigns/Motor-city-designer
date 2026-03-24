const products = [
  {
    id: 'brand-starter-kit',
    name: 'Brand starter kit',
    category: 'branding',
    image: 'assets/brand-starter-kit.svg',
    imageAlt: 'Brand starter kit preview card with logo concept and style guide blocks',
    price: 850,
    description: 'A streamlined identity package for new businesses that need a confident visual starting point.',
    features: ['Primary logo concept', 'Color and type direction', 'Mini style guide'],
  },
  {
    id: 'signature-brand-system',
    name: 'Signature brand system',
    category: 'branding',
    image: 'assets/signature-brand-system.svg',
    imageAlt: 'Signature brand system preview with logo suite and brand guideline layout',
    price: 1600,
    description: 'A deeper identity package with flexible assets for businesses ready to look fully established.',
    features: ['Logo suite', 'Brand voice prompts', 'Expanded style guide'],
  },
  {
    id: 'web-launch-system',
    name: 'Web launch system',
    category: 'web',
    image: 'assets/web-launch-system.svg',
    imageAlt: 'Web launch system preview showing homepage and modular page sections',
    price: 2400,
    description: 'A conversion-minded website package with a premium homepage and polished service sections.',
    features: ['Responsive website design', 'Strategic section layout', 'Launch handoff support'],
  },
  {
    id: 'storefront-refresh',
    name: 'Storefront refresh',
    category: 'web',
    image: 'assets/storefront-refresh.svg',
    imageAlt: 'Storefront refresh preview with redesigned commerce panels',
    price: 3200,
    description: 'An elevated redesign for existing service or ecommerce sites that need sharper UX and merchandising.',
    features: ['Homepage redesign', 'Collection page concepts', 'Mobile optimization'],
  },
  {
    id: 'launch-creative-pack',
    name: 'Launch creative pack',
    category: 'marketing',
    image: 'assets/launch-creative-pack.svg',
    imageAlt: 'Launch creative pack preview featuring social and campaign creative cards',
    price: 700,
    description: 'Campaign visuals for social, email, and ad placements that support a polished release.',
    features: ['Social launch graphics', 'Ad creative set', 'Promo story slides'],
  },
  {
    id: 'monthly-design-pit-pass',
    name: 'Monthly design pit pass',
    category: 'marketing',
    image: 'assets/monthly-design-pit-pass.svg',
    imageAlt: 'Monthly design pit pass preview with retainer dashboard and task list',
    price: 1200,
    description: 'Ongoing design support for founders who need regular creative output without agency overhead.',
    features: ['Monthly priority queue', 'Graphics and page updates', 'One strategy sync'],
  },
];

const state = {
  activeFilter: 'all',
  query: '',
  cart: loadCart(),
  authToken: window.localStorage.getItem('motor-city-token') || '',
  user: null,
};

const API_BASE_URL = window.location.origin;

const productGrid = document.querySelector('#product-grid');
const productTemplate = document.querySelector('#product-card-template');
const searchInput = document.querySelector('#product-search');
const filterButtons = document.querySelectorAll('[data-filter]');
const cartDrawer = document.querySelector('[data-cart-drawer]');
const cartItems = document.querySelector('#cart-items');
const cartSubtotal = document.querySelector('#cart-subtotal');
const cartCount = document.querySelector('[data-cart-count]');
const backdrop = document.querySelector('[data-backdrop]');
const checkoutButton = document.querySelector('#checkout-button');
const contactForm = document.querySelector('#contact-form');
const contactFeedback = document.querySelector('#contact-feedback');
const chatbotLaunch = document.querySelector('#chatbot-launch');
const chatbotPanel = document.querySelector('#chatbot-panel');
const chatbotClose = document.querySelector('#chatbot-close');
const chatbotMessages = document.querySelector('#chatbot-messages');
const chatbotForm = document.querySelector('#chatbot-form');
const chatbotInput = document.querySelector('#chatbot-input');
const chatbotQuickActions = document.querySelector('#chatbot-quick-actions');
const fluidCanvas = document.querySelector('#fluid-bg');
const particleCanvas = document.querySelector('#particle-layer');
const checkoutFeedback = document.querySelector('#checkout-feedback');
const signupForm = document.querySelector('#signup-form');
const loginForm = document.querySelector('#login-form');
const logoutButton = document.querySelector('#logout-button');
const authStatus = document.querySelector('#auth-status');
const authFeedback = document.querySelector('#auth-feedback');
const orderList = document.querySelector('#order-list');
const inboxList = document.querySelector('#inbox-list');
const adminPanel = document.querySelector('#admin-panel');
const adminRefresh = document.querySelector('#admin-refresh');
const adminUsers = document.querySelector('#admin-users');
const adminOrders = document.querySelector('#admin-orders');

function loadCart() {
  try {
    return JSON.parse(window.localStorage.getItem('motor-city-cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart() {
  window.localStorage.setItem('motor-city-cart', JSON.stringify(state.cart));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getVisibleProducts() {
  return products.filter((product) => {
    const matchesFilter = state.activeFilter === 'all' || product.category === state.activeFilter;
    const matchesQuery = `${product.name} ${product.description}`
      .toLowerCase()
      .includes(state.query.trim().toLowerCase());

    return matchesFilter && matchesQuery;
  });
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();
  productGrid.innerHTML = '';

  if (!visibleProducts.length) {
    productGrid.innerHTML = '<div class="empty-state">No packages match this search yet. Try another keyword or filter.</div>';
    return;
  }

  visibleProducts.forEach((product) => {
    const fragment = productTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.product-card');
    const art = fragment.querySelector('.product-art');
    const tag = fragment.querySelector('.product-tag');
    const price = fragment.querySelector('.product-price');
    const title = fragment.querySelector('.product-title');
    const description = fragment.querySelector('.product-description');
    const features = fragment.querySelector('.product-features');
    const addButton = fragment.querySelector('.add-to-cart');

    card.dataset.category = product.category;
    art.style.background = productArt(product.category);
    art.innerHTML = `<img src="${product.image}" alt="${product.imageAlt}" loading="lazy" decoding="async" />`;
    tag.textContent = product.category;
    price.textContent = formatCurrency(product.price);
    title.textContent = product.name;
    description.textContent = product.description;
    addButton.dataset.productId = product.id;

    product.features.forEach((feature) => {
      const item = document.createElement('li');
      item.textContent = feature;
      features.appendChild(item);
    });

    productGrid.appendChild(fragment);
  });
}

function productArt(category) {
  const artByCategory = {
    branding: 'radial-gradient(circle at top right, rgba(249, 115, 22, 0.35), transparent 28%), linear-gradient(135deg, rgba(76, 29, 149, 0.85), rgba(30, 41, 59, 0.95))',
    web: 'radial-gradient(circle at top right, rgba(96, 165, 250, 0.32), transparent 28%), linear-gradient(135deg, rgba(3, 105, 161, 0.88), rgba(15, 23, 42, 0.95))',
    marketing: 'radial-gradient(circle at top right, rgba(52, 211, 153, 0.3), transparent 28%), linear-gradient(135deg, rgba(6, 95, 70, 0.85), rgba(17, 24, 39, 0.95))',
  };

  return artByCategory[category] || artByCategory.branding;
}

function addToCart(productId) {
  const existingItem = state.cart.find((item) => item.id === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.cart.push({ id: productId, quantity: 1 });
  }

  saveCart();
  renderCart();
  openCart();
}

function updateQuantity(productId, change) {
  state.cart = state.cart
    .map((item) => {
      if (item.id !== productId) {
        return item;
      }

      return { ...item, quantity: item.quantity + change };
    })
    .filter((item) => item.quantity > 0);

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.id !== productId);
  saveCart();
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = '';

  if (!state.cart.length) {
    cartItems.innerHTML = '<div class="empty-cart">Your cart is empty. Add a package to start building your project stack.</div>';
    cartSubtotal.textContent = formatCurrency(0);
    cartCount.textContent = '0';
    return;
  }

  let subtotal = 0;
  let totalItems = 0;

  state.cart.forEach((item) => {
    const product = products.find((entry) => entry.id === item.id);

    if (!product) {
      return;
    }

    totalItems += item.quantity;
    subtotal += product.price * item.quantity;

    const row = document.createElement('article');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-top">
        <div>
          <h3>${product.name}</h3>
          <p>${formatCurrency(product.price)} each</p>
        </div>
        <button class="remove-button" type="button" data-remove-id="${product.id}">Remove</button>
      </div>
      <div class="cart-item-controls">
        <div class="qty-controls">
          <button class="qty-button" type="button" data-qty-id="${product.id}" data-change="-1">−</button>
          <span>${item.quantity}</span>
          <button class="qty-button" type="button" data-qty-id="${product.id}" data-change="1">+</button>
        </div>
        <strong>${formatCurrency(product.price * item.quantity)}</strong>
      </div>
    `;

    cartItems.appendChild(row);
  });

  cartSubtotal.textContent = formatCurrency(subtotal);
  cartCount.textContent = String(totalItems);
}

function openCart() {
  cartDrawer.classList.add('is-open');
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  checkoutFeedback.textContent = '';
  document.querySelector('[data-open-cart]')?.setAttribute('aria-expanded', 'true');
}

function closeCart() {
  cartDrawer.classList.remove('is-open');
  backdrop.hidden = true;
  document.body.style.overflow = '';
  document.querySelector('[data-open-cart]')?.setAttribute('aria-expanded', 'false');
}

function cartSubtotalValue() {
  return state.cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) {
      return sum;
    }

    return sum + product.price * item.quantity;
  }, 0);
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

function setAuthFeedback(message, isError = false) {
  if (!authFeedback) return;
  authFeedback.textContent = message;
  authFeedback.style.color = isError ? '#ffb7b7' : 'var(--success)';
}

function renderPortal(user = state.user) {
  if (authStatus) {
    authStatus.textContent = user
      ? `Signed in as ${user.name} (${user.email}) — role: ${user.role || 'customer'}`
      : 'Not signed in.';
  }

  if (adminPanel) {
    adminPanel.hidden = !user || user.role !== 'admin';
  }
}

async function loadSession() {
  if (!state.authToken) {
    state.user = null;
    renderPortal();
    return;
  }

  try {
    const payload = await apiFetch('/api/session');
    state.user = payload.user;
    renderPortal(payload.user);
    await Promise.all([loadOrders(), loadInbox()]);
  } catch {
    state.authToken = '';
    state.user = null;
    window.localStorage.removeItem('motor-city-token');
    renderPortal();
  }
}

async function loadOrders() {
  if (!state.user || !orderList) {
    return;
  }
  const payload = await apiFetch('/api/orders');
  orderList.innerHTML = '';
  if (!payload.orders.length) {
    orderList.innerHTML = '<li>No orders yet.</li>';
    return;
  }

  payload.orders.forEach((order) => {
    const timeline = order.timeline.map((step) => `${step.stage} (${new Date(step.at).toLocaleString()})`).join(' → ');
    const item = document.createElement('li');
    item.innerHTML = `<strong>Order ${order.id.slice(0, 8)}</strong><br/>Stage: ${order.stage}<br/>${timeline}`;
    orderList.appendChild(item);
  });
}

async function loadInbox() {
  if (!state.user || !inboxList) {
    return;
  }
  const payload = await apiFetch('/api/inbox');
  inboxList.innerHTML = '';
  if (!payload.messages.length) {
    inboxList.innerHTML = '<li>No inbox messages yet.</li>';
    return;
  }

  payload.messages.forEach((message) => {
    const item = document.createElement('li');
    const download = message.metadata?.downloadUrl
      ? `<br/><a href="${message.metadata.downloadUrl}" target="_blank" rel="noreferrer">Download file</a>`
      : '';
    item.innerHTML = `<strong>${message.title}</strong><br/>${message.body}${download}`;
    inboxList.appendChild(item);
  });
}

function startCheckout() {
  if (!state.cart.length) {
    checkoutFeedback.textContent = 'Add at least one package to continue.';
    checkoutFeedback.style.color = '#ffb7b7';
    return false;
  }

  const amount = cartSubtotalValue();
  const cartLineItems = state.cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) {
        return null;
      }

      return {
        id: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price
      };
    })
    .filter(Boolean);

  checkoutFeedback.textContent = 'Connecting to PayPal checkout…';
  checkoutFeedback.style.color = 'var(--success)';
  checkoutButton.textContent = 'Redirecting…';
  checkoutButton.disabled = true;

  void (async () => {
    try {
      if (state.user) {
        const payload = await apiFetch('/api/orders/checkout', {
          method: 'POST',
          body: JSON.stringify({ items: cartLineItems })
        });
        state.cart = [];
        saveCart();
        renderCart();
        checkoutFeedback.textContent = `Checkout complete. Receipt #${payload.receipt.receiptNumber}`;
        checkoutButton.textContent = 'Start checkout';
        checkoutButton.disabled = false;
        await Promise.all([loadOrders(), loadInbox()]);
        return;
      }

      const payload = await apiFetch('/api/billing/checkout/public-order', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          currency: 'USD',
          returnUrl: `${window.location.origin}/?checkout=success`,
          cancelUrl: `${window.location.origin}/?checkout=cancelled`,
          items: cartLineItems
        })
      });

      const approvalUrl = payload.links?.find((link) => link.rel === 'approve')?.href;
      if (!approvalUrl) {
        throw new Error('Unable to create checkout order.');
      }
      window.location.assign(approvalUrl);
    } catch (error) {
      checkoutFeedback.textContent = error.message || 'Checkout failed. Please try again.';
      checkoutFeedback.style.color = '#ffb7b7';
      checkoutButton.textContent = 'Start checkout';
      checkoutButton.disabled = false;
    }
  })();

  return true;
}

function postChatMessage(role, text) {
  const bubble = document.createElement('article');
  bubble.className = `chat-message ${role}`;
  bubble.textContent = text;
  chatbotMessages.appendChild(bubble);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function summarizeCart() {
  if (!state.cart.length) {
    return 'Your cart is currently empty. You can say “add web launch system” or tap a package in the shop.';
  }

  const details = state.cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) {
        return '';
      }

      return `${product.name} × ${item.quantity}`;
    })
    .filter(Boolean)
    .join(', ');

  return `You currently have ${details}. Subtotal is ${cartSubtotal.textContent}.`;
}

function findProductByText(text) {
  const clean = text.toLowerCase();
  return products.find((product) => clean.includes(product.id.replaceAll('-', ' ')) || clean.includes(product.name.toLowerCase()));
}

function respondToMessage(rawMessage) {
  const message = rawMessage.trim().toLowerCase();
  const pickedProduct = findProductByText(message);

  if (!message) {
    return 'Send a question anytime—I can help with packages, pricing, cart actions, and next steps.';
  }

  if (message.includes('show') && (message.includes('package') || message.includes('products'))) {
    return `We currently offer ${products.length} packages across branding, web, and marketing. Scroll to “Shop packages” to compare everything.`;
  }

  if (message.includes('pricing') || message.includes('cost') || message.includes('price')) {
    const minimum = Math.min(...products.map((item) => item.price));
    const maximum = Math.max(...products.map((item) => item.price));
    return `Packages currently range from ${formatCurrency(minimum)} to ${formatCurrency(maximum)}. I can also recommend options based on your goals.`;
  }

  if (message.includes('recommend') || message.includes('best')) {
    return 'If you want the strongest all-in-one start, Web launch system plus Signature brand system is a high-impact bundle.';
  }

  if (message.includes('view cart') || message.includes('cart status') || message === 'cart') {
    openCart();
    return summarizeCart();
  }

  if (message.includes('clear cart')) {
    state.cart = [];
    saveCart();
    renderCart();
    return 'Done—your cart has been cleared.';
  }

  if (message.includes('checkout')) {
    openCart();
    return startCheckout()
      ? 'Perfect. I started the checkout flow from your cart.'
      : 'Your cart is empty right now. Add at least one package and I can start checkout for you.';
  }

  if (message.includes('contact') || message.includes('quote') || message.includes('support')) {
    return 'Use the custom inquiry form in the Contact section to request tailored scope, timeline, and pricing support.';
  }

  if (message.includes('add') && pickedProduct) {
    addToCart(pickedProduct.id);
    return `${pickedProduct.name} has been added to your cart. ${summarizeCart()}`;
  }

  if (pickedProduct) {
    return `${pickedProduct.name} starts at ${formatCurrency(pickedProduct.price)} and includes ${pickedProduct.features[0].toLowerCase()}. Say “add ${pickedProduct.name}” if you want it in your cart.`;
  }

  return 'I can help with package details, pricing, adding items, viewing cart, and checkout. Try “add web launch system” or “view cart”.';
}

function openChatbot() {
  chatbotPanel.hidden = false;
  chatbotLaunch.setAttribute('aria-expanded', 'true');
  chatbotInput.focus();
}

function handleCheckoutQueryStatus() {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  const localOrderId = params.get('localOrderId');

  if (!checkoutFeedback || !checkout) {
    return;
  }

  if (checkout === 'success') {
    checkoutFeedback.textContent = localOrderId
      ? `Checkout complete. Receipt generated for order ${localOrderId.slice(0, 8)}.`
      : 'Checkout complete. Receipt is available in your account inbox.';
    checkoutFeedback.style.color = 'var(--success)';
  } else if (checkout === 'cancelled') {
    checkoutFeedback.textContent = 'Checkout cancelled.';
    checkoutFeedback.style.color = '#ffb7b7';
  }
}

function closeChatbot() {
  chatbotPanel.hidden = true;
  chatbotLaunch.setAttribute('aria-expanded', 'false');
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.activeFilter = button.dataset.filter;
    filterButtons.forEach((chip) => chip.classList.toggle('active', chip === button));
    renderProducts();
  });
});

searchInput?.addEventListener('input', (event) => {
  state.query = event.target.value;
  renderProducts();
});

productGrid?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-product-id]');

  if (target) {
    addToCart(target.dataset.productId);
  }
});

document.querySelector('[data-open-cart]')?.setAttribute('aria-expanded', 'false');
document.querySelector('[data-open-cart]')?.addEventListener('click', openCart);
document.querySelector('[data-close-cart]')?.addEventListener('click', closeCart);
backdrop?.addEventListener('click', closeCart);

document.querySelectorAll('[data-quick-add]').forEach((button) => {
  button.addEventListener('click', () => addToCart(button.dataset.quickAdd));
});

cartItems?.addEventListener('click', (event) => {
  const quantityButton = event.target.closest('[data-qty-id]');
  const removeButton = event.target.closest('[data-remove-id]');

  if (quantityButton) {
    updateQuantity(quantityButton.dataset.qtyId, Number(quantityButton.dataset.change));
  }

  if (removeButton) {
    removeFromCart(removeButton.dataset.removeId);
  }
});

checkoutButton?.addEventListener('click', startCheckout);

signupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  try {
    const payload = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    state.authToken = payload.token;
    state.user = payload.user;
    window.localStorage.setItem('motor-city-token', payload.token);
    renderPortal(payload.user);
    setAuthFeedback('Signup successful. You are now logged in.');
    signupForm.reset();
    await Promise.all([loadOrders(), loadInbox()]);
  } catch (error) {
    setAuthFeedback(error.message, true);
  }
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  try {
    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    state.authToken = payload.token;
    state.user = payload.user;
    window.localStorage.setItem('motor-city-token', payload.token);
    renderPortal(payload.user);
    setAuthFeedback('Login successful.');
    loginForm.reset();
    await Promise.all([loadOrders(), loadInbox()]);
  } catch (error) {
    setAuthFeedback(error.message, true);
  }
});

logoutButton?.addEventListener('click', () => {
  state.authToken = '';
  state.user = null;
  window.localStorage.removeItem('motor-city-token');
  if (orderList) orderList.innerHTML = '';
  if (inboxList) inboxList.innerHTML = '';
  renderPortal();
  setAuthFeedback('Logged out.');
});

adminRefresh?.addEventListener('click', async () => {
  try {
    const [usersPayload, ordersPayload] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/orders')
    ]);
    adminUsers.textContent = JSON.stringify(usersPayload.users, null, 2);
    adminOrders.textContent = JSON.stringify(ordersPayload.orders, null, 2);
  } catch (error) {
    setAuthFeedback(error.message, true);
  }
});

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const submitButton = contactForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = 'Quote request received';
  contactFeedback.textContent = 'Thanks! Your inquiry has been captured in this demo flow and is ready to connect to your inbox or CRM.';
  contactFeedback.style.color = 'var(--success)';

  window.setTimeout(() => {
    contactForm.reset();
    submitButton.disabled = false;
    submitButton.textContent = 'Request a custom quote';
    contactFeedback.textContent = 'We’ll use your details to shape a tailored proposal and next steps.';
    contactFeedback.style.color = '';
  }, 2200);
});

chatbotLaunch?.addEventListener('click', () => {
  if (chatbotPanel.hidden) {
    openChatbot();
    return;
  }

  closeChatbot();
});

chatbotClose?.addEventListener('click', closeChatbot);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!chatbotPanel.hidden) {
      closeChatbot();
    }

    if (cartDrawer.classList.contains('is-open')) {
      closeCart();
    }
  }
});

chatbotForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = chatbotInput.value.trim();

  postChatMessage('user', message);

  const reply = respondToMessage(message);
  window.setTimeout(() => postChatMessage('bot', reply), 280);

  chatbotForm.reset();
  chatbotInput.focus();
});

chatbotQuickActions?.addEventListener('click', (event) => {
  const quickAction = event.target.closest('[data-chat-command]');
  if (!quickAction) {
    return;
  }

  const command = quickAction.dataset.chatCommand;
  postChatMessage('user', command);
  const response = respondToMessage(command);
  window.setTimeout(() => postChatMessage('bot', response), 200);
});

renderProducts();
renderCart();
handleCheckoutQueryStatus();
initFluidBackground();
postChatMessage('bot', 'Hi! I’m your storefront assistant. Ask about packages, pricing, your cart, or checkout.');
void loadSession();


function initFluidBackground() {
  if (!fluidCanvas || !particleCanvas) {
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fluidCtx = fluidCanvas.getContext('2d');
  const particleCtx = particleCanvas.getContext('2d');

  if (!fluidCtx || !particleCtx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth;
  let height = window.innerHeight;
  let rafId;
  let mouse = { x: width * 0.5, y: height * 0.5 };

  const blobs = [
    { x: 0.2, y: 0.3, r: 260, color: 'rgba(249,115,22,0.3)', speed: 0.0006, phase: 0 },
    { x: 0.75, y: 0.25, r: 280, color: 'rgba(96,165,250,0.22)', speed: 0.0005, phase: Math.PI * 0.65 },
    { x: 0.55, y: 0.72, r: 320, color: 'rgba(52,211,153,0.18)', speed: 0.00042, phase: Math.PI * 1.2 },
  ];

  const particles = Array.from({ length: 70 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    size: Math.random() * 2.3 + 0.4,
    alpha: Math.random() * 0.55 + 0.15,
  }));

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    [fluidCanvas, particleCanvas].forEach((canvas) => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });

    fluidCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderFluid(time) {
    fluidCtx.clearRect(0, 0, width, height);

    blobs.forEach((blob, index) => {
      const wave = Math.sin(time * blob.speed + blob.phase);
      const drift = Math.cos(time * (blob.speed * 0.77) + blob.phase);
      const x = width * blob.x + wave * (40 + index * 8) + (mouse.x - width / 2) * 0.008;
      const y = height * blob.y + drift * (36 + index * 6) + (mouse.y - height / 2) * 0.008;
      const radius = blob.r + Math.sin(time * blob.speed * 1.8) * 24;

      const gradient = fluidCtx.createRadialGradient(x, y, 10, x, y, radius);
      gradient.addColorStop(0, blob.color);
      gradient.addColorStop(1, 'rgba(5,11,20,0)');

      fluidCtx.fillStyle = gradient;
      fluidCtx.beginPath();
      fluidCtx.arc(x, y, radius, 0, Math.PI * 2);
      fluidCtx.fill();
    });
  }

  function renderParticles() {
    particleCtx.clearRect(0, 0, width, height);
    particleCtx.fillStyle = 'rgba(255,255,255,0.85)';

    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;
      if (particle.y < -8) particle.y = height + 8;
      if (particle.y > height + 8) particle.y = -8;

      particleCtx.globalAlpha = particle.alpha;
      particleCtx.beginPath();
      particleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      particleCtx.fill();
    });

    particleCtx.globalAlpha = 1;
  }

  function frame(time) {
    renderFluid(time);
    renderParticles();

    if (!reduceMotion) {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  resize();

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (event) => {
    mouse = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  if (reduceMotion) {
    renderFluid(3500);
    renderParticles();
    return;
  }

  rafId = window.requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  });
}
