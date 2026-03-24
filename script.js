const products = [
  {
    id: 'brand-starter-kit',
    name: 'Brand starter kit',
    category: 'branding',
    price: 850,
    description: 'A streamlined identity package for new businesses that need a confident visual starting point.',
    features: ['Primary logo concept', 'Color and type direction', 'Mini style guide'],
  },
  {
    id: 'signature-brand-system',
    name: 'Signature brand system',
    category: 'branding',
    price: 1600,
    description: 'A deeper identity package with flexible assets for businesses ready to look fully established.',
    features: ['Logo suite', 'Brand voice prompts', 'Expanded style guide'],
  },
  {
    id: 'web-launch-system',
    name: 'Web launch system',
    category: 'web',
    price: 2400,
    description: 'A conversion-minded website package with a premium homepage and polished service sections.',
    features: ['Responsive website design', 'Strategic section layout', 'Launch handoff support'],
  },
  {
    id: 'storefront-refresh',
    name: 'Storefront refresh',
    category: 'web',
    price: 3200,
    description: 'An elevated redesign for existing service or ecommerce sites that need sharper UX and merchandising.',
    features: ['Homepage redesign', 'Collection page concepts', 'Mobile optimization'],
  },
  {
    id: 'launch-creative-pack',
    name: 'Launch creative pack',
    category: 'marketing',
    price: 700,
    description: 'Campaign visuals for social, email, and ad placements that support a polished release.',
    features: ['Social launch graphics', 'Ad creative set', 'Promo story slides'],
  },
  {
    id: 'monthly-design-pit-pass',
    name: 'Monthly design pit pass',
    category: 'marketing',
    price: 1200,
    description: 'Ongoing design support for founders who need regular creative output without agency overhead.',
    features: ['Monthly priority queue', 'Graphics and page updates', 'One strategy sync'],
  },
];

const state = {
  activeFilter: 'all',
  query: '',
  cart: loadCart(),
};

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
const suggestedBlock = document.querySelector('#suggested-block');
const suggestedList = document.querySelector('#suggested-list');
const contactForm = document.querySelector('#contact-form');
const contactFeedback = document.querySelector('#contact-feedback');
const suggestedByProduct = {
  'brand-starter-kit': ['launch-creative-pack'],
  'signature-brand-system': ['web-launch-system'],
  'web-launch-system': ['launch-creative-pack', 'monthly-design-pit-pass'],
  'storefront-refresh': ['monthly-design-pit-pass'],
  'launch-creative-pack': ['monthly-design-pit-pass'],
};

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
    renderSuggested([]);
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
  renderSuggested(getSuggestedProducts());
}

function getSuggestedProducts() {
  const idsInCart = new Set(state.cart.map((item) => item.id));
  const suggestionIds = new Set();

  state.cart.forEach((item) => {
    const linkedSuggestions = suggestedByProduct[item.id] || [];
    linkedSuggestions.forEach((suggestionId) => {
      if (!idsInCart.has(suggestionId)) {
        suggestionIds.add(suggestionId);
      }
    });
  });

  return [...suggestionIds]
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean)
    .slice(0, 3);
}

function renderSuggested(suggestedProducts) {
  if (!suggestedBlock || !suggestedList) {
    return;
  }

  suggestedList.innerHTML = '';

  if (!suggestedProducts.length) {
    suggestedBlock.hidden = true;
    return;
  }

  suggestedProducts.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'suggested-item';
    item.innerHTML = `
      <div>
        <strong>${product.name}</strong><br />
        <small>${formatCurrency(product.price)}</small>
      </div>
      <button type="button" data-suggested-id="${product.id}">Add</button>
    `;
    suggestedList.appendChild(item);
  });

  suggestedBlock.hidden = false;
}

function openCart() {
  cartDrawer.classList.add('is-open');
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('is-open');
  backdrop.hidden = true;
  document.body.style.overflow = '';
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

suggestedList?.addEventListener('click', (event) => {
  const suggestedButton = event.target.closest('[data-suggested-id]');

  if (suggestedButton) {
    addToCart(suggestedButton.dataset.suggestedId);
  }
});

checkoutButton?.addEventListener('click', () => {
  if (!state.cart.length) {
    cartSubtotal.textContent = 'Add a package first';
    return;
  }

  checkoutButton.textContent = 'Checkout request sent';
  checkoutButton.disabled = true;

  window.setTimeout(() => {
    state.cart = [];
    saveCart();
    renderCart();
    checkoutButton.textContent = 'Start checkout';
    checkoutButton.disabled = false;
    closeCart();
  }, 1800);
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

renderProducts();
renderCart();
