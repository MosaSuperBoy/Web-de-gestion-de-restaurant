(function (window) {
  'use strict';

  const STORAGE_KEY = 'pluto_restau_jomo_v1';
  const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
  const MAX_IMAGE_DATA_LENGTH = 800000;
  const MAX_STORED_IMAGE_DATA_LENGTH = 3000000;

  const starterProducts = [
    { id: 'garba-thon', name: 'Garba au thon', category: 'Les incontournables', price: 3000, stock: 24, badge: 'Le classique', description: 'Attiéké légèrement grainé, thon doré, oignons et piment à votre goût.', image: 'assets/menu/attieke-thon.jpg', imageCredit: 'Mognissan', imageSource: 'https://commons.wikimedia.org/wiki/File:Atti%C3%A9k%C3%A9_poisson_thon_01.jpg', variants: [], published: true },
    { id: 'poulet-braise', name: 'Poulet braisé & attiéké', category: 'Grillades', price: 5000, stock: 18, badge: 'Un favori', description: 'Poulet braisé et attiéké, servis avec leurs condiments.', image: 'assets/menu/poulet-braise.jpg', imageCredit: 'Jacquitoz', imageSource: 'https://commons.wikimedia.org/wiki/File:Poulet_brais%C3%A9_attiek%C3%A9.JPG', variants: [], published: true },
    { id: 'kedjenou-poulet', name: 'Kédjénou de poulet', category: 'Les incontournables', price: 5500, stock: 16, badge: '', description: 'Un mijoté de poulet tendre aux légumes et aux aromates.', image: 'assets/menu/kedjenou.jpg', imageCredit: 'African Hope', imageSource: 'https://commons.wikimedia.org/wiki/File:Kedjenou_poulet_sauce_claire.JPG', variants: [], published: true },
    { id: 'poisson-braise', name: 'Poisson braisé & attiéké', category: 'Grillades', price: 6500, stock: 14, badge: 'À partager', description: 'Poisson grillé, attiéké et accompagnements à la mode ivoirienne.', image: 'assets/menu/poisson-braise.jpg', imageCredit: 'Papischou', imageSource: 'https://commons.wikimedia.org/wiki/File:Atti%C3%A9k%C3%A9_au_poisson_grill%C3%A9e.JPG', variants: [], published: true },
    { id: 'alloco-poisson', name: 'Alloco & poisson', category: 'À partager', price: 4000, stock: 18, badge: '', description: 'Bananes plantain dorées, poisson et petits condiments.', image: 'assets/menu/alloco-poisson.jpg', imageCredit: 'Jacquitoz', imageSource: 'https://commons.wikimedia.org/wiki/File:Alloco_poisson_sosso.JPG', variants: [], published: true },
    { id: 'alloco-poulet', name: 'Alloco & poulet', category: 'À partager', price: 4000, stock: 18, badge: '', description: 'Alloco tout chaud, poulet et condiments généreux.', image: 'assets/menu/alloco-poulet.jpg', imageCredit: 'Isabelle Christiane', imageSource: 'https://commons.wikimedia.org/wiki/File:Alloco_au_poulet.jpg', variants: [], published: true },
    { id: 'jus-bissap', name: 'Jus de bissap', category: 'Boissons maison', price: 1000, stock: 30, badge: 'Frais', description: 'Une boisson fraîche aux fleurs d’hibiscus, pour la petite pause.', image: 'assets/menu/jus-bissap.jpg', imageCredit: 'Kalamuh 045', imageSource: 'https://commons.wikimedia.org/wiki/File:Jus_de_bouye,_gingembre_et_bissap_01.jpg', variants: [], published: true },
    { id: 'jus-gingembre', name: 'Jus de gingembre', category: 'Boissons maison', price: 1000, stock: 30, badge: '', description: 'Du gingembre bien parfumé, relevé comme il faut.', image: 'assets/menu/jus-gingembre.jpg', imageCredit: 'Cheikh cherif', imageSource: 'https://commons.wikimedia.org/wiki/File:Jus_de_gingembre-2025.jpg', variants: [], published: true }
  ];

  function makeInitialState() {
    const config = window.RESTAURANT_CONFIG || {};
    const configuredFee = Number(config.deliveryFee);
    return {
      products: starterProducts.map(product => Object.assign({}, product)),
      orders: [],
      settings: {
        deliveryFee: Number.isFinite(configuredFee) && Number.isSafeInteger(configuredFee) && configuredFee >= 0 ? configuredFee : 1500,
        whatsapp: typeof config.whatsapp === 'string' ? config.whatsapp : '',
        heroImageData: ''
      }
    };
  }

  function validateState(state) {
    if (!state || !Array.isArray(state.products) || !Array.isArray(state.orders)
      || !state.settings || typeof state.settings.whatsapp !== 'string') {
      throw new Error('Les données de la boutique sont incomplètes ou illisibles. Restaurez une sauvegarde JSON valide.');
    }

    const deliveryFee = Number(state.settings.deliveryFee);
    if (!Number.isFinite(deliveryFee) || !Number.isSafeInteger(deliveryFee) || deliveryFee < 0) {
      throw new Error('Les données de la boutique sont incomplètes ou illisibles. Restaurez une sauvegarde JSON valide.');
    }
    state.settings.deliveryFee = deliveryFee;
    delete state.settings.maintenance;
    if (state.settings.heroImageData === undefined) state.settings.heroImageData = '';
    if (typeof state.settings.heroImageData !== 'string'
      || (state.settings.heroImageData !== ''
        && (!/^data:image\/jpeg;base64,[\da-z+/]+=*$/i.test(state.settings.heroImageData)
          || state.settings.heroImageData.length > MAX_IMAGE_DATA_LENGTH))) {
      throw new Error('La photo du grand cadre est invalide ou trop volumineuse.');
    }
    let storedImageDataLength = state.settings.heroImageData.length;
    const productIds = new Set();
    state.products.forEach(product => {
      if (!product || typeof product.id !== 'string' || !product.id || productIds.has(product.id)
        || typeof product.name !== 'string' || !product.name.trim()
        || typeof product.category !== 'string' || !product.category.trim()
        || !Number.isSafeInteger(Number(product.price)) || Number(product.price) < 1
        || !Number.isSafeInteger(Number(product.stock)) || Number(product.stock) < 0
        || typeof product.description !== 'string' || !Array.isArray(product.variants)
        || !product.variants.every(variant => typeof variant === 'string')
        || typeof product.published !== 'boolean'
        || (product.image && (typeof product.image !== 'string'
          || (!/^https:\/\//i.test(product.image) && !/^assets\/menu\/[a-z0-9-]+\.jpg$/i.test(product.image))))
        || (product.imageData !== undefined && (typeof product.imageData !== 'string'
          || (product.imageData !== '' && (!/^data:image\/jpeg;base64,[\da-z+/]+=*$/i.test(product.imageData)
            || product.imageData.length > MAX_IMAGE_DATA_LENGTH))))
        || (product.imageSource && (typeof product.imageSource !== 'string' || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(product.imageSource)))
        || (product.imageCredit && typeof product.imageCredit !== 'string')) {
        throw new Error('Une fiche produit est invalide. Vérifiez la sauvegarde de la boutique.');
      }
      storedImageDataLength += (product.imageData || '').length;
      if (storedImageDataLength > MAX_STORED_IMAGE_DATA_LENGTH) {
        throw new Error('Les photos importées dépassent la limite de stockage local. Réduisez leur nombre ou leur taille.');
      }
      productIds.add(product.id);
    });

    const orderIds = new Set();
    state.orders.forEach(order => {
      if (!order || typeof order.id !== 'string' || !order.id || orderIds.has(order.id)
        || !Array.isArray(order.items) || !order.items.length || !ORDER_STATUSES.includes(order.status)
        || !order.customer || typeof order.customer.name !== 'string' || !order.customer.name.trim()
        || typeof order.customer.phone !== 'string' || !order.customer.phone.trim()
        || !order.delivery || !['delivery', 'pickup'].includes(order.delivery.mode)
        || typeof order.delivery.address !== 'string'
        || !['delivery', 'mobile-money'].includes(order.payment)
        || !order.items.every(item => item && typeof item.productId === 'string'
          && typeof item.name === 'string' && typeof item.variant === 'string'
          && Number.isSafeInteger(item.quantity) && item.quantity > 0
          && Number.isSafeInteger(item.unitPrice) && item.unitPrice > 0
          && Number.isSafeInteger(item.total) && item.total === item.quantity * item.unitPrice)
        || !Number.isSafeInteger(order.subtotal) || !Number.isSafeInteger(order.deliveryFee)
        || !Number.isSafeInteger(order.total) || order.total !== order.subtotal + order.deliveryFee
        || typeof order.restocked !== 'boolean') {
        throw new Error('Une commande est invalide. Vérifiez la sauvegarde de la boutique.');
      }
      orderIds.add(order.id);
    });
    return state;
  }

  function getState() {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const state = makeInitialState();
      saveState(state);
      return state;
    }
    let state;
    try {
      state = JSON.parse(stored);
    } catch (error) {
      throw new Error('Les données de la boutique ne sont pas un JSON valide. Exportez ou restaurez une sauvegarde avant de continuer.');
    }
    return validateState(state);
  }

  function saveState(state) {
    validateState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function makeOrderId() {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const suffix = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID().slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PLUTO-${stamp}-${suffix}`;
  }

  function createOrder(details) {
    const state = getState();
    const payload = details && typeof details === 'object' ? details : {};
    const name = String(payload.name || '').trim();
    const phone = String(payload.phone || '').trim();
    const email = String(payload.email || '').trim();
    const address = String(payload.address || '').trim();
    const delivery = payload.delivery === 'pickup' ? 'pickup' : 'delivery';
    const payment = payload.payment === 'mobile-money' ? 'mobile-money' : 'delivery';
    const quantities = new Map();

    if (!name || !phone) throw new Error('Renseignez votre nom et votre numéro de téléphone.');
    if (delivery === 'delivery' && !address) throw new Error('Renseignez votre adresse de livraison.');
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    if (rawItems.length === 0) throw new Error('Votre panier est vide.');

    rawItems.forEach(line => {
      const quantity = Number(line && line.quantity);
      if (!line || typeof line.productId !== 'string' || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Le panier contient une quantité invalide. Vérifiez vos articles.');
      }
      const key = `${line.productId}\u0000${String(line.variant || '')}`;
      quantities.set(key, (quantities.get(key) || 0) + quantity);
    });

    const items = [];
    for (const [key, quantity] of quantities.entries()) {
      const separator = key.indexOf('\u0000');
      const productId = key.slice(0, separator);
      const variant = key.slice(separator + 1);
      const product = state.products.find(item => item.id === productId && item.published);
      if (!product) throw new Error('Un article de votre panier n’est plus disponible. Actualisez la page.');
      if (quantity > product.stock) throw new Error(`Stock insuffisant pour « ${product.name} » : ${product.stock} disponible(s).`);
      if (!Number.isSafeInteger(quantity * Number(product.price))) throw new Error('Le montant de votre panier est trop élevé.');
      items.push({
        productId: product.id,
        name: product.name,
        variant,
        quantity,
        unitPrice: Number(product.price),
        total: Number(product.price) * quantity
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const deliveryFee = delivery === 'pickup' ? 0 : Number(state.settings.deliveryFee);
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(subtotal + deliveryFee)) {
      throw new Error('Le montant total de votre commande est trop élevé.');
    }
    items.forEach(item => {
      const product = state.products.find(entry => entry.id === item.productId);
      product.stock -= item.quantity;
    });

    const order = {
      id: makeOrderId(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      customer: { name, phone, email },
      delivery: { mode: delivery, address: delivery === 'delivery' ? address : 'Retrait à Abidjan' },
      payment,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      restocked: false
    };
    state.orders.unshift(order);
    saveState(state);
    return order;
  }

  function updateOrderStatus(orderId, status) {
    if (!ORDER_STATUSES.includes(status)) throw new Error('Ce statut de commande n’est pas reconnu.');
    const state = getState();
    const order = state.orders.find(item => item.id === orderId);
    if (!order) throw new Error('Cette commande est introuvable.');
    if (order.status === 'cancelled' && status !== 'cancelled') {
      throw new Error('Une commande annulée ne peut pas être rouverte.');
    }
    if (status === 'cancelled' && !order.restocked) {
      order.items.forEach(line => {
        const product = state.products.find(item => item.id === line.productId);
        if (product) product.stock += line.quantity;
      });
      order.restocked = true;
    }
    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveState(state);
    return state;
  }

  window.RjmStore = {
    STORAGE_KEY,
    ORDER_STATUSES,
    getState,
    saveState,
    createOrder,
    updateOrderStatus
  };
})(window);
