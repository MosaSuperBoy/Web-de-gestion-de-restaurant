document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const CART_KEY = 'pluto_restau_jomo_cart_v1';
  const FAVORITES_KEY = 'pluto_restau_jomo_favorites_v1';
  const money = value => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const grid = document.getElementById('productGrid');
  const categoryFilters = document.getElementById('categoryFilters');
  const searchInput = document.getElementById('productSearch');
  const sortSelect = document.getElementById('productSort');
  const cartDrawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('shopBackdrop');
  const cartItems = document.getElementById('cartItems');
  const checkoutForm = document.getElementById('checkoutForm');
  const cartFooter = document.getElementById('cartFooter');
  const cartEmpty = document.getElementById('cartEmpty');
  const orderSuccess = document.getElementById('orderSuccess');
  const toast = document.getElementById('shopToast');
  const maintenanceBanner = document.getElementById('shopMaintenanceBanner');

  let state;
  let maintenanceEnabled = true;
  let maintenanceStatusReady = false;
  let isSubmittingOrder = false;
  let cart = [];
  let favorites = [];
  let selectedCategory = 'Tout';
  let favoritesOnly = false;
  let search = '';
  let toastTimer;

  function readList(key, validateItem, label) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    let value;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Impossible de lire ${label}. Effacez les données locales corrompues ou restaurez une sauvegarde.`);
    }
    if (!Array.isArray(value) || !value.every(validateItem)) {
      throw new Error(`Les données de ${label} sont invalides. Vérifiez le stockage local de votre navigateur.`);
    }
    return value;
  }

  function saveCart() {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function saveFavorites() {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  async function refreshMaintenanceStatus() {
    try {
      const response = await fetch('api/maintenance.php', {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || !result || typeof result.enabled !== 'boolean') {
        throw new Error(result && result.error ? result.error : 'État du serveur invalide.');
      }
      maintenanceEnabled = result.enabled;
      maintenanceStatusReady = true;
      maintenanceBanner.hidden = !maintenanceEnabled;
      maintenanceBanner.querySelector('.container').textContent = maintenanceEnabled
        ? 'La prise de commandes est temporairement suspendue pour maintenance. Vous pouvez toujours consulter notre carte.'
        : '';
    } catch (error) {
      maintenanceEnabled = true;
      maintenanceStatusReady = false;
      maintenanceBanner.hidden = false;
      maintenanceBanner.querySelector('.container').textContent =
        'Impossible de vérifier la disponibilité auprès du serveur. Les commandes sont suspendues ; réessayez plus tard.';
    }

    renderProducts();
    renderCart();
    return maintenanceStatusReady && !maintenanceEnabled;
  }

  function getVisibleProducts() {
    const query = search.trim().toLocaleLowerCase('fr');
    return state.products
      .filter(product => product.published)
      .filter(product => selectedCategory === 'Tout' || product.category === selectedCategory)
      .filter(product => !favoritesOnly || favorites.includes(product.id))
      .filter(product => !query || [product.name, product.category, product.description, ...(product.variants || [])]
        .join(' ').toLocaleLowerCase('fr').includes(query))
      .sort((a, b) => {
        if (sortSelect.value === 'price-asc') return a.price - b.price;
        if (sortSelect.value === 'price-desc') return b.price - a.price;
        if (sortSelect.value === 'name') return a.name.localeCompare(b.name, 'fr');
        return 0;
      });
  }

  function renderCategories() {
    const categories = ['Tout', ...new Set(state.products.filter(product => product.published).map(product => product.category))];
    categoryFilters.innerHTML = categories.map(category => `
      <button type="button" class="shop-filter-chip ${category === selectedCategory ? 'active' : ''}"
        data-category="${escapeHtml(category)}" aria-pressed="${category === selectedCategory}">
        ${escapeHtml(category)}
      </button>`).join('');
  }

  function renderProducts() {
    const products = getVisibleProducts();
    document.getElementById('productResults').textContent =
      `${products.length} plat${products.length > 1 ? 's' : ''} sur la carte`;
    document.getElementById('emptyProducts').hidden = products.length > 0;
    grid.hidden = products.length === 0;

    grid.innerHTML = products.map((product, index) => {
      const isFavorite = favorites.includes(product.id);
      const soldOut = product.stock < 1;
      const imageSource = product.imageData || product.image;
      const image = imageSource
        ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" class="product-photo">`
        : `<span class="product-emoji" aria-hidden="true">PLUTO</span>`;
      const credit = product.imageSource && product.imageCredit
        ? `<a class="photo-credit" href="${escapeHtml(product.imageSource)}" target="_blank" rel="noopener noreferrer">Photo : ${escapeHtml(product.imageCredit)} · CC BY-SA 4.0 ↗</a>`
        : '';
      const variants = product.variants.length
        ? `<label class="product-variant-label"><span>Choisir une option</span>
            <select class="product-variant" aria-label="Option pour ${escapeHtml(product.name)}">
              ${product.variants.map(variant => `<option value="${escapeHtml(variant)}">${escapeHtml(variant)}</option>`).join('')}
            </select></label>`
        : '';
      return `
        <article class="shop-product-card" style="--card-index:${index % 4}">
          <div class="product-art product-art-${index % 6}">
            ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}
            <button type="button" class="product-favorite ${isFavorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(product.id)}"
              aria-pressed="${isFavorite}" aria-label="${isFavorite ? 'Retirer des' : 'Ajouter aux'} favoris">${isFavorite ? '♥' : '♡'}</button>
            ${image}
            <span class="product-art-caption">PLUTO · ABIDJAN</span>
          </div>
          <div class="product-card-info">
            <span class="product-category">${escapeHtml(product.category)}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <div class="product-card-bottom">
              <strong class="product-price">${money(Number(product.price))}</strong>
              <span class="product-stock ${product.stock <= 4 && !soldOut ? 'stock-low' : ''}">${soldOut ? 'Indisponible' : product.stock <= 4 ? `Plus que ${product.stock}` : 'Disponible'}</span>
            </div>
            ${variants}
            <button type="button" class="product-add-button" data-add="${escapeHtml(product.id)}" ${soldOut || !maintenanceStatusReady || maintenanceEnabled ? 'disabled' : ''}>
              ${soldOut ? 'Indisponible' : !maintenanceStatusReady ? 'Commandes indisponibles' : maintenanceEnabled ? 'Commandes en pause' : 'Ajouter à ma commande'} <span aria-hidden="true">＋</span>
            </button>
            ${credit}
          </div>
        </article>`;
    }).join('');
  }

  function getCartLines() {
    return cart.map(line => {
      const product = state.products.find(item => item.id === line.productId);
      return { line, product };
    });
  }

  function renderCart() {
    const lines = getCartLines();
    const availableLines = lines.filter(entry => entry.product && entry.product.published);
    const quantity = cart.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = availableLines.reduce((sum, entry) => sum + entry.product.price * entry.line.quantity, 0);
    const unavailable = lines.some(entry => !entry.product || !entry.product.published
      || entry.line.quantity > entry.product.stock);
    document.getElementById('cartCount').textContent = quantity;
    document.getElementById('drawerCartCount').textContent = `(${quantity})`;
    document.getElementById('cartSubtotal').textContent = money(subtotal);
    document.getElementById('wishlistCount').textContent = favorites.length;
    const checkoutButton = document.getElementById('startCheckoutBtn');
    checkoutButton.disabled = quantity === 0 || unavailable || isSubmittingOrder || !maintenanceStatusReady || maintenanceEnabled;
    checkoutButton.firstChild.textContent = !maintenanceStatusReady || maintenanceEnabled
      ? 'Commandes en pause '
      : 'Continuer ma commande ';
    document.getElementById('checkoutButton').disabled = isSubmittingOrder || !maintenanceStatusReady || maintenanceEnabled;
    const maintenanceCartNotice = document.getElementById('maintenanceCartNotice');
    maintenanceCartNotice.hidden = maintenanceStatusReady && !maintenanceEnabled;
    maintenanceCartNotice.textContent = maintenanceStatusReady
      ? 'Les commandes sont temporairement suspendues pour maintenance.'
      : 'La disponibilité des commandes ne peut pas être vérifiée. Elles sont suspendues par précaution.';
    cartEmpty.hidden = lines.length > 0;
    document.getElementById('cartItems').hidden = lines.length === 0;

    cartItems.innerHTML = lines.map(({ line, product }) => {
      if (!product || !product.published) {
        return `<div class="cart-line cart-line-unavailable">
          <div><strong>Article indisponible</strong><small>Supprimez cet article pour continuer.</small></div>
          <button type="button" class="cart-remove" data-remove="${escapeHtml(line.productId)}" data-variant="${escapeHtml(line.variant)}">Supprimer</button>
        </div>`;
      }
      const invalid = line.quantity > product.stock;
      return `<div class="cart-line">
        <div class="cart-line-visual">${escapeHtml(product.visual || '✦')}</div>
        <div class="cart-line-details">
          <strong>${escapeHtml(product.name)}</strong>
          ${line.variant ? `<small>Option : ${escapeHtml(line.variant)}</small>` : ''}
          ${invalid ? `<small class="cart-stock-error">Stock restant : ${product.stock}</small>` : ''}
          <span>${money(product.price * line.quantity)}</span>
        </div>
        <div class="cart-line-actions">
          <div class="cart-quantity">
            <button type="button" data-quantity="-1" data-id="${escapeHtml(line.productId)}" data-variant="${escapeHtml(line.variant)}" aria-label="Diminuer la quantité">−</button>
            <span>${line.quantity}</span>
            <button type="button" data-quantity="1" data-id="${escapeHtml(line.productId)}" data-variant="${escapeHtml(line.variant)}" aria-label="Augmenter la quantité" ${line.quantity >= product.stock ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="cart-remove" data-remove="${escapeHtml(line.productId)}" data-variant="${escapeHtml(line.variant)}">Retirer</button>
        </div>
      </div>`;
    }).join('');
  }

  function render() {
    renderCategories();
    renderProducts();
    renderCart();
    document.getElementById('clearSearchBtn').hidden = search === '';
    document.getElementById('wishlistFilter').classList.toggle('active', favoritesOnly);
    document.getElementById('wishlistFilter').setAttribute('aria-pressed', String(favoritesOnly));
  }

  function setDrawerOpen(open) {
    cartDrawer.classList.toggle('open', open);
    cartDrawer.setAttribute('aria-hidden', String(!open));
    backdrop.hidden = !open;
    document.body.classList.toggle('shop-drawer-open', open);
    if (open) document.getElementById('closeCartBtn').focus();
    else {
      checkoutForm.hidden = true;
      cartFooter.hidden = false;
      orderSuccess.hidden = true;
      document.getElementById('openCartBtn').focus();
    }
  }

  function updateAddressVisibility() {
    const delivery = checkoutForm.elements.delivery.value === 'delivery';
    document.getElementById('addressField').hidden = !delivery;
    checkoutForm.elements.address.required = delivery;
    const lines = getCartLines().filter(entry => entry.product && entry.product.published);
    const subtotal = lines.reduce((sum, entry) => sum + entry.product.price * entry.line.quantity, 0);
    const deliveryFee = delivery ? Number(state.settings.deliveryFee) : 0;
    document.getElementById('checkoutPriceSummary').innerHTML = `
      <div><span>Sous-total</span><strong>${money(subtotal)}</strong></div>
      <div><span>Livraison</span><strong>${deliveryFee ? money(deliveryFee) : 'Offerte'}</strong></div>
      <div class="checkout-price-total"><span>Total à régler</span><strong>${money(subtotal + deliveryFee)}</strong></div>`;
  }

  function makeWhatsappUrl(order) {
    const number = String(state.settings.whatsapp || '').replace(/\D/g, '');
    if (number.length < 8 || number.length > 15) return '';
    const summary = order.items.map(item => `• ${item.name}${item.variant ? ` (${item.variant})` : ''} × ${item.quantity}`).join('\n');
    const message = `Bonjour, je confirme ma commande ${order.id} auprès de PLUTO RESTAU-JOMO.\n${summary}\nTotal : ${money(order.total)}.\nMerci !`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function showOrderConfirmation(order) {
    const whatsappUrl = makeWhatsappUrl(order);
    orderSuccess.innerHTML = `
      <div class="order-success-mark" aria-hidden="true">✓</div>
      <span class="shop-kicker">COMMANDE ENREGISTRÉE</span>
      <h3>Merci, ${escapeHtml(order.customer.name.split(/\s+/)[0])} !</h3>
      <p>Votre commande <strong>${escapeHtml(order.id)}</strong> est enregistrée sur cet appareil.</p>
      <div class="order-success-total"><span>Total à régler</span><strong>${money(order.total)}</strong></div>
      <p>${order.payment === 'mobile-money' ? 'Le paiement Mobile Money sera organisé à la réception.' : 'Le règlement se fera à la réception de votre commande.'}</p>
      ${whatsappUrl ? `<a class="shop-checkout-button order-whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Confirmer sur WhatsApp ↗</a>` : ''}
      <button type="button" class="cart-continue-button" id="closeSuccessBtn">Retour à la boutique</button>`;
    orderSuccess.hidden = false;
    cartItems.hidden = true;
    cartEmpty.hidden = true;
    checkoutForm.hidden = true;
    cartFooter.hidden = true;
    document.getElementById('closeSuccessBtn').addEventListener('click', () => setDrawerOpen(false));
  }

  document.getElementById('fontSelector').addEventListener('change', event => {
    try {
      window.RjmTypography.apply(event.target.value, true);
    } catch (error) {
      showToast(`La police n'a pas pu être enregistrée : ${error.message}`);
    }
  });

  searchInput.addEventListener('input', () => {
    search = searchInput.value;
    renderProducts();
    document.getElementById('clearSearchBtn').hidden = search === '';
  });
  document.getElementById('clearSearchBtn').addEventListener('click', () => {
    searchInput.value = '';
    search = '';
    searchInput.focus();
    renderProducts();
    document.getElementById('clearSearchBtn').hidden = true;
  });
  sortSelect.addEventListener('change', renderProducts);
  categoryFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    selectedCategory = button.dataset.category;
    render();
  });
  document.getElementById('wishlistFilter').addEventListener('click', event => {
    favoritesOnly = !favoritesOnly;
    event.currentTarget.classList.toggle('active', favoritesOnly);
    event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly));
    renderProducts();
  });
  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    selectedCategory = 'Tout';
    favoritesOnly = false;
    search = '';
    searchInput.value = '';
    render();
  });
  grid.addEventListener('click', event => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const id = favoriteButton.dataset.favorite;
      favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
      try {
        saveFavorites();
        render();
      } catch (error) {
        showToast(`Favoris non enregistrés : ${error.message}`);
      }
      return;
    }
    const addButton = event.target.closest('[data-add]');
    if (!addButton || addButton.disabled) return;
    if (!maintenanceStatusReady || maintenanceEnabled) {
      showToast(maintenanceStatusReady
        ? 'Les commandes sont temporairement suspendues.'
        : 'La disponibilité des commandes ne peut pas être vérifiée.');
      return;
    }
    const card = addButton.closest('.shop-product-card');
    const product = state.products.find(item => item.id === addButton.dataset.add);
    const variant = card.querySelector('.product-variant')?.value || '';
    if (!product) {
      showToast('Ce plat n’est plus disponible.');
      return;
    }
    const line = cart.find(item => item.productId === product.id && item.variant === variant);
    if (line && line.quantity >= product.stock) {
      showToast(`Stock maximum atteint pour « ${product.name} ».`);
      return;
    }
    try {
      if (line) line.quantity += 1;
      else cart.push({ productId: product.id, variant, quantity: 1 });
      saveCart();
      renderCart();
      showToast(`${product.name} ajouté à ma commande.`);
    } catch (error) {
      showToast(`Le panier n’a pas pu être enregistré : ${error.message}`);
    }
  });

  cartItems.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove]');
    const quantityButton = event.target.closest('[data-quantity]');
    const button = removeButton || quantityButton;
    if (!button) return;
    const productId = removeButton ? removeButton.dataset.remove : quantityButton.dataset.id;
    const variant = button.dataset.variant || '';
    const lineIndex = cart.findIndex(item => item.productId === productId && item.variant === variant);
    if (lineIndex < 0) return;
    if (removeButton) cart.splice(lineIndex, 1);
    else {
      const product = state.products.find(item => item.id === productId);
      cart[lineIndex].quantity += Number(quantityButton.dataset.quantity);
      if (cart[lineIndex].quantity < 1) cart.splice(lineIndex, 1);
      else if (product && cart[lineIndex].quantity > product.stock) {
        cart[lineIndex].quantity = product.stock;
        showToast(`Stock disponible : ${product.stock} article(s).`);
      }
    }
    try {
      saveCart();
      renderCart();
    } catch (error) {
      showToast(`Le panier n’a pas pu être enregistré : ${error.message}`);
    }
  });

  document.getElementById('openCartBtn').addEventListener('click', () => setDrawerOpen(true));
  document.getElementById('closeCartBtn').addEventListener('click', () => setDrawerOpen(false));
  document.getElementById('continueShoppingBtn').addEventListener('click', () => setDrawerOpen(false));
  backdrop.addEventListener('click', () => setDrawerOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && cartDrawer.classList.contains('open')) setDrawerOpen(false);
  });
  document.getElementById('startCheckoutBtn').addEventListener('click', async () => {
    if (!await refreshMaintenanceStatus()) {
      showToast(maintenanceStatusReady
        ? 'Les commandes sont temporairement suspendues.'
        : 'La disponibilité des commandes ne peut pas être vérifiée.');
      return;
    }
    checkoutForm.hidden = false;
    cartFooter.hidden = true;
    cartEmpty.hidden = true;
    document.getElementById('checkoutFeedback').textContent = '';
    updateAddressVisibility();
    document.getElementById('cartTitle').scrollIntoView({ block: 'nearest' });
  });
  checkoutForm.addEventListener('change', event => {
    if (event.target.name === 'delivery') updateAddressVisibility();
  });
  checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = document.getElementById('checkoutButton');
    const feedback = document.getElementById('checkoutFeedback');
    if (isSubmittingOrder) return;
    isSubmittingOrder = true;
    submitButton.disabled = true;
    feedback.textContent = '';
    try {
      if (!await refreshMaintenanceStatus()) {
        throw new Error(maintenanceStatusReady
          ? 'Les commandes sont temporairement suspendues.'
          : 'La disponibilité des commandes ne peut pas être vérifiée. Réessayez plus tard.');
      }
      const formData = new FormData(checkoutForm);
      const order = window.RjmStore.createOrder({
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        address: formData.get('address'),
        delivery: formData.get('delivery'),
        payment: formData.get('payment'),
        items: cart
      });
      state = window.RjmStore.getState();
      cart = [];
      saveCart();
      checkoutForm.reset();
      isSubmittingOrder = false;
      render();
      showOrderConfirmation(order);
    } catch (error) {
      isSubmittingOrder = false;
      feedback.textContent = error.message || 'La commande n’a pas pu être enregistrée.';
      submitButton.disabled = !maintenanceStatusReady || maintenanceEnabled;
    }
  });

  window.addEventListener('storage', event => {
    if (event.key !== window.RjmStore.STORAGE_KEY && event.key !== null) return;
    try {
      state = window.RjmStore.getState();
      document.querySelector('.shop-hero-photo').src =
        state.settings.heroImageData || 'assets/menu/poisson-braise.jpg';
      render();
      const heroImage = document.querySelector('.shop-hero-photo');
      if (heroImage) heroImage.src = state.settings.heroImageData || 'assets/menu/poisson-braise.jpg';
    } catch (error) {
      showToast(`La boutique n’a pas pu actualiser ses réglages : ${error.message}`);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMaintenanceStatus();
  });

  try {
    state = window.RjmStore.getState();
    cart = readList(CART_KEY, item => item && typeof item.productId === 'string'
      && typeof item.variant === 'string' && Number.isInteger(item.quantity) && item.quantity > 0, 'le panier');
    favorites = readList(FAVORITES_KEY, item => typeof item === 'string', 'les favoris');
    render();
    refreshMaintenanceStatus();
  } catch (error) {
    grid.hidden = true;
    document.getElementById('emptyProducts').hidden = false;
    document.getElementById('emptyProducts').innerHTML = `<span aria-hidden="true">!</span><h3>La boutique ne peut pas charger ses données.</h3><p>${escapeHtml(error.message)}</p>`;
    showToast(error.message || 'La boutique ne peut pas charger ses données.');
  }
});
