const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');

const storage = new Map();
const window = {
  RESTAURANT_CONFIG: { whatsapp: '2250700000000' },
  crypto: webcrypto,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value)
  }
};

new Function('window', fs.readFileSync('boutique-data.js', 'utf8'))(window);
const shop = window.RjmStore;
const initial = shop.getState();
assert.equal(initial.products.length, 8);
assert.equal(initial.settings.whatsapp, '2250700000000');

window.localStorage.setItem('pluto_restau_jomo_v1', JSON.stringify({
  products: initial.products,
  orders: [],
  settings: { deliveryFee: '1800', whatsapp: '2250700000000' }
}));
assert.equal(shop.getState().settings.deliveryFee, 1800);
assert.equal('maintenance' in shop.getState().settings, false);

const testImageData = 'data:image/jpeg;base64,/9j/2Q==';
const imageState = shop.getState();
imageState.products[0].imageData = testImageData;
imageState.settings.heroImageData = testImageData;
shop.saveState(imageState);
assert.equal(shop.getState().products[0].imageData, testImageData);
assert.equal(shop.getState().settings.heroImageData, testImageData);
assert.throws(() => shop.saveState({
  ...shop.getState(),
  products: shop.getState().products.map(product => ({ ...product, imageData: 'data:image/png;base64,invalid' }))
}), /invalide/);
const oversizedPhoto = `data:image/jpeg;base64,${'A'.repeat(780000)}`;
assert.throws(() => shop.saveState({
  ...shop.getState(),
  products: shop.getState().products.map(product => ({ ...product, imageData: oversizedPhoto }))
}), /stockage local/);

const initialGarbaStock = initial.products.find(product => product.id === 'garba-thon').stock;
const order = shop.createOrder({
  name: 'Awa Test',
  phone: '+2250700000000',
  email: '',
  address: 'Cocody, Abidjan',
  delivery: 'delivery',
  payment: 'mobile-money',
  items: [
    { productId: 'garba-thon', variant: '', quantity: 2 },
    { productId: 'poulet-braise', variant: '', quantity: 1 }
  ]
});

assert.equal(order.subtotal, 11000);
assert.equal(order.deliveryFee, 1800);
assert.equal(order.total, 12800);
assert.equal(shop.getState().products.find(product => product.id === 'garba-thon').stock, initialGarbaStock - 2);

shop.updateOrderStatus(order.id, 'preparing');
shop.updateOrderStatus(order.id, 'cancelled');
assert.equal(shop.getState().products.find(product => product.id === 'garba-thon').stock, initialGarbaStock);
assert.throws(() => shop.updateOrderStatus(order.id, 'pending'), /rouverte/);
assert.throws(() => shop.createOrder(null), /nom et votre numéro/);
const maintenanceState = shop.getState();
maintenanceState.settings.maintenance = true;
shop.saveState(maintenanceState);
assert.equal('maintenance' in shop.getState().settings, false);
const ordersBeforeLegacyFlag = maintenanceState.orders.length;
const stockBeforeLegacyFlag = maintenanceState.products.find(product => product.id === 'garba-thon').stock;
shop.createOrder({
  name: 'Test',
  phone: '12345678',
  address: 'Abidjan',
  items: [{ productId: 'garba-thon', quantity: 1 }]
});
assert.equal(shop.getState().orders.length, ordersBeforeLegacyFlag + 1);
assert.equal(shop.getState().products.find(product => product.id === 'garba-thon').stock, stockBeforeLegacyFlag - 1);
assert.throws(() => shop.createOrder({
  name: 'Test',
  phone: '12345678',
  address: 'Abidjan',
  items: [{ productId: 'garba-thon', quantity: 999 }]
}), /Stock insuffisant/);
assert.throws(() => shop.saveState({
  ...shop.getState(),
  settings: { ...shop.getState().settings, deliveryFee: -1 }
}), /incomplètes/);
shop.saveState({
  ...shop.getState(),
  settings: { ...shop.getState().settings, maintenance: 'legacy-local-value' }
});
assert.equal('maintenance' in shop.getState().settings, false);

console.log('Shop order creation, totals, stock, cancellation and validation passed.');
