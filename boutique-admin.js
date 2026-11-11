document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const user = window.RjmAuth && window.RjmAuth.getUser();
  if (!user || !['admin', 'gestionnaire'].includes(user.role)) {
    window.location.href = 'connexion.html';
    return;
  }

  const form = document.getElementById('shopProductForm');
  const feedback = document.getElementById('shopAdminFeedback');
  const formFeedback = document.getElementById('productFormFeedback');
  const productRows = document.getElementById('adminProductRows');
  const orderRows = document.getElementById('adminOrderRows');
  const maintenanceButton = document.getElementById('toggleMaintenance');
  const maintenanceStatus = document.getElementById('maintenanceStatus');
  const productImageInput = document.getElementById('productImageFile');
  const productImagePreview = document.getElementById('productImagePreview');
  const heroImageInput = document.getElementById('heroImageFile');
  const heroImagePreview = document.getElementById('heroImagePreview');
  const money = value => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const statusLabels = {
    pending: 'À traiter',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    shipped: 'En livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };
  let state;
  let selectedProductImageData = '';

  async function optimizeImage(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choisissez une image JPG, PNG ou WebP.');
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('La photo doit faire 10 Mo ou moins.');

    let bitmap;
    let objectUrl;
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Impossible de lire ce fichier image.'));
        image.src = objectUrl;
      }).catch(error => {
        URL.revokeObjectURL(objectUrl);
        throw error;
      });
    }
    try {
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Impossible de préparer cette image sur cet appareil.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.72);
      if (imageData.length > 780000) {
        throw new Error('Cette photo reste trop volumineuse après optimisation. Choisissez une image plus légère.');
      }
      return imageData;
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function showImagePreview(container, imageData, fallbackSource) {
    container.replaceChildren();
    const preview = document.createElement('img');
    preview.alt = 'Aperçu de la photo';
    preview.src = imageData || fallbackSource;
    container.appendChild(preview);
    container.hidden = false;
  }

  function setFeedback(message, isError) {
    feedback.textContent = message;
    feedback.style.color = isError ? 'var(--danger)' : 'var(--success)';
  }

  function renderProducts() {
    const categories = [...new Set(state.products.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'fr'));
    document.getElementById('shopCategories').innerHTML = categories
      .map(category => `<option value="${escapeHtml(category)}"></option>`).join('');
    productRows.innerHTML = state.products.map(product => `
      <tr>
        <td><strong>${escapeHtml(product.name)}</strong><br><span class="form-helper">${escapeHtml(product.category)}</span></td>
        <td>${money(product.price)}</td>
        <td>${product.stock}</td>
        <td>${product.published ? 'En vente' : 'Masqué'}</td>
        <td><div class="shop-admin-actions">
          <button type="button" class="btn btn-sm btn-outline" data-edit-product="${escapeHtml(product.id)}">Modifier</button>
          <button type="button" class="btn btn-sm btn-outline" data-toggle-product="${escapeHtml(product.id)}">${product.published ? 'Masquer' : 'Publier'}</button>
          <button type="button" class="btn btn-sm btn-danger" data-delete-product="${escapeHtml(product.id)}" ${state.orders.some(order => order.items.some(item => item.productId === product.id)) ? 'disabled title="Conservé pour l’historique des commandes"' : ''}>Supprimer</button>
        </div></td>
      </tr>`).join('');
    document.getElementById('productsEmpty').hidden = state.products.length > 0;
    document.getElementById('statProducts').textContent = state.products.filter(product => product.published).length;
  }

  function renderOrders() {
    const filter = document.getElementById('orderStatusFilter').value;
    const orders = state.orders.filter(order => filter === 'all' || order.status === filter);
    orderRows.innerHTML = orders.map(order => {
      const itemSummary = order.items.map(item => `${escapeHtml(item.name)}${item.variant ? ` · ${escapeHtml(item.variant)}` : ''} × ${item.quantity}`).join('<br>');
      const date = new Date(order.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? 'Date inconnue' : date.toLocaleString('fr-FR');
      return `<tr>
        <td><strong>${escapeHtml(order.id)}</strong><br><span class="form-helper">${escapeHtml(dateLabel)}</span></td>
        <td>${escapeHtml(order.customer.name)}<br><a href="tel:${escapeHtml(order.customer.phone)}">${escapeHtml(order.customer.phone)}</a>${order.customer.email ? `<br>${escapeHtml(order.customer.email)}` : ''}</td>
        <td>${itemSummary}</td>
        <td><strong>${money(order.total)}</strong></td>
        <td>${order.delivery.mode === 'pickup' ? 'Retrait' : `Livraison : ${escapeHtml(order.delivery.address)}`}<br>${order.payment === 'mobile-money' ? 'Mobile Money à réception' : 'Espèces à réception'}</td>
        <td><select data-order-status="${escapeHtml(order.id)}" aria-label="Statut de la commande ${escapeHtml(order.id)}" ${order.status === 'cancelled' ? 'disabled' : ''}>
          ${window.RjmStore.ORDER_STATUSES.map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}
        </select></td>
      </tr>`;
    }).join('');
    document.getElementById('ordersEmpty').hidden = orders.length > 0;
    document.getElementById('statOrders').textContent = state.orders.length;
    document.getElementById('statPending').textContent = state.orders.filter(order => order.status === 'pending').length;
  }

  function render() {
    state = window.RjmStore.getState();
    renderProducts();
    renderOrders();
    document.getElementById('deliveryFee').value = state.settings.deliveryFee;
    document.getElementById('shopWhatsapp').value = state.settings.whatsapp;
  }

  function resetProductForm() {
    form.reset();
    form.elements.id.value = '';
    form.elements.published.checked = true;
    selectedProductImageData = '';
    productImagePreview.replaceChildren();
    productImagePreview.hidden = true;
    document.getElementById('productFormTitle').textContent = 'Ajouter un article';
    document.getElementById('saveProductButton').textContent = "Ajouter l'article";
    document.getElementById('cancelProductEdit').hidden = true;
    formFeedback.textContent = '';
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderMaintenanceStatus(enabled) {
    maintenanceButton.disabled = false;
    maintenanceButton.setAttribute('aria-pressed', String(enabled));
    maintenanceButton.textContent = enabled ? 'Désactiver la maintenance' : 'Activer la maintenance';
    maintenanceStatus.textContent = enabled
      ? 'Maintenance active : les commandes sont suspendues pour tous les visiteurs.'
      : 'Boutique ouverte : les visiteurs peuvent passer commande.';
  }

  async function loadMaintenanceStatus() {
    maintenanceButton.disabled = true;
    try {
      const response = await fetch('api/maintenance.php', {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || !result || typeof result.enabled !== 'boolean') {
        throw new Error(result && result.error ? result.error : 'État du serveur invalide.');
      }
      renderMaintenanceStatus(result.enabled);
    } catch (error) {
      maintenanceButton.disabled = true;
      maintenanceButton.textContent = 'Indisponible';
      maintenanceStatus.textContent = error.message || 'Impossible de vérifier le mode maintenance.';
      setFeedback('Configurez l’API PHP/MySQL du mode maintenance avant de l’utiliser.', true);
    }
  }

  maintenanceButton.addEventListener('click', async () => {
    const enabled = maintenanceButton.getAttribute('aria-pressed') !== 'true';
    if (enabled && !window.confirm('Activer le mode maintenance pour tous les visiteurs ? Les commandes seront suspendues.')) return;
    const password = window.prompt('Saisissez le mot de passe serveur du mode maintenance :');
    if (password === null) return;
    if (!password) {
      setFeedback('Le mot de passe serveur est obligatoire.', true);
      return;
    }

    maintenanceButton.disabled = true;
    try {
      const response = await fetch('api/maintenance.php', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ enabled, password })
      });
      const result = await response.json();
      if (!response.ok || !result || typeof result.enabled !== 'boolean') {
        throw new Error(result && result.error ? result.error : 'Le serveur a refusé la modification.');
      }
      renderMaintenanceStatus(result.enabled);
      setFeedback(result.enabled ? 'Mode maintenance activé pour tous les visiteurs.' : 'Boutique rouverte pour tous les visiteurs.', false);
    } catch (error) {
      maintenanceButton.disabled = false;
      setFeedback(error.message || 'Impossible de modifier le mode maintenance.', true);
    }
  });

  function csvCell(value) {
    let text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  document.getElementById('shopAdminIdentity').textContent = `${user.nom || user.identifiant} · ${user.role === 'admin' ? 'Super admin' : 'Gestionnaire'}`;
  document.getElementById('shopAdminLogout').addEventListener('click', () => {
    window.RjmAuth.logout();
    window.location.href = 'connexion.html';
  });
  window.RjmAuth.initInactivityWatcher(() => {
    window.location.href = 'connexion.html?expire=1';
  });

  const securityCard = document.getElementById('securitySettingsCard');
  if (user.role === 'admin') {
    document.getElementById('customThemeForm').hidden = false;
    try {
      const security = window.RjmAuth.getSecuritySettings();
      securityCard.hidden = false;
      document.getElementById('defaultPasswordWarning').hidden = !security.is_default_password;
      document.getElementById('adminSecurityQuestion').value = security.security_question;
      document.getElementById('adminInactivityMinutes').value = security.inactivity_minutes;
    } catch (error) {
      setFeedback(error.message || 'Impossible de charger les réglages de sécurité.', true);
    }
  }

  document.getElementById('securitySettingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    const securityForm = event.currentTarget;
    const formData = new FormData(securityForm);
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const question = String(formData.get('securityQuestion') || '').trim();
    const answer = window.RjmCrypto.normalizeAnswer(formData.get('securityAnswer'));
    const inactivityMinutes = Number(formData.get('inactivityMinutes'));
    const message = document.getElementById('securitySettingsFeedback');
    message.textContent = '';

    try {
      if (!Number.isSafeInteger(inactivityMinutes) || inactivityMinutes < 5 || inactivityMinutes > 240) {
        throw new Error('Choisissez un délai d’inactivité compris entre 5 et 240 minutes.');
      }
      if (!question || question.length > 180 || answer.length < 3 || answer.length > 120) {
        throw new Error('La question doit être renseignée et la réponse comporter au moins 3 caractères.');
      }
      if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword)
        || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        throw new Error('Le nouveau mot de passe doit comporter 12 caractères minimum, avec majuscule, minuscule, chiffre et symbole.');
      }
      if (newPassword !== confirmPassword) throw new Error('Les deux nouveaux mots de passe ne correspondent pas.');

      const security = window.RjmAuth.getSecuritySettings();
      if (await window.RjmCrypto.sha256(currentPassword) !== security.password_hash) {
        throw new Error('Le mot de passe actuel est incorrect.');
      }
      security.password_hash = await window.RjmCrypto.sha256(newPassword);
      security.is_default_password = false;
      security.last_password_change = new Date().toISOString();
      security.security_question = question;
      security.security_answer_hash = await window.RjmCrypto.sha256(answer);
      security.inactivity_minutes = inactivityMinutes;
      window.RjmAuth.saveSecuritySettings(security);
      securityForm.reset();
      document.getElementById('defaultPasswordWarning').hidden = true;
      document.getElementById('adminSecurityQuestion').value = question;
      document.getElementById('adminInactivityMinutes').value = inactivityMinutes;
      message.textContent = 'Mot de passe, récupération et délai de déconnexion mis à jour.';
      message.style.color = 'var(--success)';
    } catch (error) {
      message.textContent = error.message || 'Impossible d’enregistrer les réglages de sécurité.';
      message.style.color = 'var(--danger)';
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    formFeedback.textContent = '';
    try {
      const data = new FormData(form);
      const id = String(data.get('id') || '');
      const price = Number(data.get('price'));
      const stock = Number(data.get('stock'));
      const image = String(data.get('image') || '').trim();
      if (!Number.isSafeInteger(price) || price < 1) throw new Error('Le prix doit être un nombre entier positif en FCFA.');
      if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Le stock doit être un nombre entier supérieur ou égal à zéro.');
      const localImage = /^assets\/menu\/[a-z0-9-]+\.jpg$/i.test(image);
      if (image && !localImage) {
        let imageUrl;
        try {
          imageUrl = new URL(image);
        } catch {
          throw new Error('Indiquez un lien photo HTTPS valide ou une photo du dossier du restaurant.');
        }
        if (imageUrl.protocol !== 'https:') throw new Error('La photo doit utiliser une adresse HTTPS.');
      }
      const previousProduct = state.products.find(item => item.id === id);
      const keepsImage = previousProduct && previousProduct.image === image && !selectedProductImageData;
      const imageData = selectedProductImageData
        || (!image && previousProduct ? previousProduct.imageData || '' : '');
      if (!image && !imageData) {
        throw new Error('Ajoutez un lien de photo ou importez une image depuis votre appareil.');
      }
      const product = {
        id: id || `produit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: String(data.get('name')).trim(),
        category: String(data.get('category')).trim(),
        price,
        stock,
        description: String(data.get('description')).trim(),
        variants: String(data.get('variants') || '').split(',').map(value => value.trim()).filter(Boolean),
        badge: String(data.get('badge') || '').trim(),
        image,
        imageData,
        imageCredit: keepsImage ? previousProduct.imageCredit || '' : '',
        imageSource: keepsImage ? previousProduct.imageSource || '' : '',
        published: data.get('published') === 'on'
      };
      if (!product.name || !product.category || !product.description) throw new Error('Complétez le nom, la catégorie et la description.');
      if (product.variants.length > 12 || product.variants.some(variant => variant.length > 35)) {
        throw new Error('Saisissez au maximum 12 options de 35 caractères chacune.');
      }

      const index = state.products.findIndex(item => item.id === id);
      const products = state.products.slice();
      if (index >= 0) products[index] = Object.assign({}, products[index], product);
      else products.unshift(product);
      window.RjmStore.saveState(Object.assign({}, state, { products }));
      state = window.RjmStore.getState();
      render();
      resetProductForm();
      setFeedback(index >= 0 ? 'Article modifié.' : 'Article ajouté au catalogue.', false);
    } catch (error) {
      formFeedback.textContent = error.message || 'Impossible d’enregistrer cet article.';
    }
  });

  productImageInput.addEventListener('change', async () => {
    const file = productImageInput.files[0];
    if (!file) return;
    formFeedback.textContent = '';
    try {
      selectedProductImageData = await optimizeImage(file);
      form.elements.image.value = '';
      showImagePreview(productImagePreview, selectedProductImageData, '');
      formFeedback.textContent = 'Photo importée et optimisée. Elle sera enregistrée avec l’article.';
    } catch (error) {
      selectedProductImageData = '';
      productImageInput.value = '';
      formFeedback.textContent = error.message || 'Impossible de traiter cette photo.';
    }
  });

  form.elements.image.addEventListener('input', () => {
    if (productImageInput.files.length) productImageInput.value = '';
    selectedProductImageData = '';
    productImagePreview.replaceChildren();
    productImagePreview.hidden = true;
  });

  document.getElementById('cancelProductEdit').addEventListener('click', resetProductForm);
  productRows.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-product]');
    const toggle = event.target.closest('[data-toggle-product]');
    const remove = event.target.closest('[data-delete-product]');
    if (!edit && !toggle && !remove) return;
    try {
      const id = edit ? edit.dataset.editProduct : toggle ? toggle.dataset.toggleProduct : remove.dataset.deleteProduct;
      const product = state.products.find(item => item.id === id);
      if (!product) throw new Error('Cet article est introuvable. Actualisez la page.');
      if (edit) {
        form.elements.id.value = product.id;
        form.elements.name.value = product.name;
        form.elements.category.value = product.category;
        form.elements.price.value = product.price;
        form.elements.stock.value = product.stock;
        form.elements.description.value = product.description;
        form.elements.variants.value = product.variants.join(', ');
        form.elements.badge.value = product.badge || '';
        form.elements.image.value = product.image || '';
        selectedProductImageData = product.imageData || '';
        productImageInput.value = '';
        if (selectedProductImageData) showImagePreview(productImagePreview, selectedProductImageData, '');
        else {
          productImagePreview.replaceChildren();
          productImagePreview.hidden = true;
        }
        form.elements.published.checked = product.published;
        document.getElementById('productFormTitle').textContent = 'Modifier un article';
        document.getElementById('saveProductButton').textContent = 'Enregistrer les modifications';
        document.getElementById('cancelProductEdit').hidden = false;
        document.getElementById('productName').focus();
        return;
      }
      if (toggle) {
        product.published = !product.published;
        window.RjmStore.saveState(state);
        render();
        setFeedback(product.published ? 'Article publié.' : 'Article masqué.', false);
        return;
      }
      if (state.orders.some(order => order.items.some(item => item.productId === id))) {
        throw new Error('Cet article figure dans l’historique. Masquez-le plutôt que de le supprimer.');
      }
      if (!window.confirm(`Supprimer « ${product.name} » du catalogue ?`)) return;
      state.products = state.products.filter(item => item.id !== id);
      window.RjmStore.saveState(state);
      render();
      setFeedback('Article supprimé.', false);
    } catch (error) {
      setFeedback(error.message || 'Impossible de modifier le catalogue.', true);
    }
  });

  document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);
  orderRows.addEventListener('change', event => {
    const select = event.target.closest('[data-order-status]');
    if (!select) return;
    const previous = state.orders.find(order => order.id === select.dataset.orderStatus);
    if (select.value === 'cancelled' && previous
      && !window.confirm(`Annuler ${previous.id} et remettre les articles en stock ?`)) {
      select.value = previous.status;
      return;
    }
    try {
      state = window.RjmStore.updateOrderStatus(select.dataset.orderStatus, select.value);
      render();
      setFeedback('Statut de commande mis à jour.', false);
    } catch (error) {
      setFeedback(error.message || 'Impossible de modifier cette commande.', true);
      render();
    }
  });

  document.getElementById('shopSettingsForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      const deliveryFee = Number(data.get('deliveryFee'));
      const whatsapp = String(data.get('whatsapp') || '').trim();
      if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) throw new Error('Le forfait doit être un nombre entier positif ou nul.');
      if (whatsapp && !/^\+?[\d\s()-]{8,20}$/.test(whatsapp)) throw new Error('Saisissez un numéro WhatsApp valide avec son indicatif pays.');
      state.settings.deliveryFee = deliveryFee;
      state.settings.whatsapp = whatsapp;
      window.RjmStore.saveState(state);
      setFeedback('Réglages de livraison enregistrés.', false);
    } catch (error) {
      setFeedback(error.message || 'Impossible d’enregistrer les réglages.', true);
    }
  });

  function renderHeroImage() {
    showImagePreview(heroImagePreview, state.settings.heroImageData, 'assets/menu/poisson-braise.jpg');
    document.getElementById('resetHeroImage').disabled = !state.settings.heroImageData;
  }

  heroImageInput.addEventListener('change', async () => {
    const file = heroImageInput.files[0];
    if (!file) return;
    const message = document.getElementById('heroImageFeedback');
    message.textContent = '';
    try {
      const imageData = await optimizeImage(file);
      window.RjmStore.saveState(Object.assign({}, state, {
        settings: Object.assign({}, state.settings, { heroImageData: imageData })
      }));
      state = window.RjmStore.getState();
      renderHeroImage();
      message.textContent = 'Photo du grand cadre enregistrée sur cet appareil.';
      message.style.color = 'var(--success)';
    } catch (error) {
      heroImageInput.value = '';
      message.textContent = error.message || 'Impossible d’enregistrer la photo du grand cadre.';
      message.style.color = 'var(--danger)';
    }
  });

  document.getElementById('resetHeroImage').addEventListener('click', () => {
    try {
      window.RjmStore.saveState(Object.assign({}, state, {
        settings: Object.assign({}, state.settings, { heroImageData: '' })
      }));
      state = window.RjmStore.getState();
      heroImageInput.value = '';
      renderHeroImage();
      const message = document.getElementById('heroImageFeedback');
      message.textContent = 'La photo d’origine est rétablie.';
      message.style.color = 'var(--success)';
    } catch (error) {
      setFeedback(error.message || 'Impossible de rétablir la photo d’origine.', true);
    }
  });

  document.getElementById('exportOrders').addEventListener('click', () => {
    try {
      const columns = ['Commande', 'Date', 'Client', 'Téléphone', 'Courriel', 'Adresse', 'Articles', 'Sous-total FCFA', 'Livraison FCFA', 'Total FCFA', 'Paiement', 'Statut'];
      const rows = state.orders.map(order => [
        order.id,
        order.createdAt,
        order.customer.name,
        order.customer.phone,
        order.customer.email,
        order.delivery.address,
        order.items.map(item => `${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}`).join('; '),
        order.subtotal,
        order.deliveryFee,
        order.total,
        order.payment === 'mobile-money' ? 'Mobile Money à réception' : 'Espèces à réception',
        statusLabels[order.status]
      ]);
      const csv = [columns, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
      downloadFile('commandes-pluto-restau-jomo.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
      setFeedback(`${rows.length} commande(s) exportée(s).`, false);
    } catch (error) {
      setFeedback(error.message || 'Impossible d’exporter les commandes.', true);
    }
  });

  document.getElementById('exportProducts').addEventListener('click', () => {
    try {
      downloadFile('carte-pluto-restau-jomo.json', JSON.stringify(state.products, null, 2), 'application/json');
      setFeedback('Catalogue exporté en JSON.', false);
    } catch (error) {
      setFeedback(error.message || 'Impossible d’exporter le catalogue.', true);
    }
  });

  document.getElementById('exportShopBackup').addEventListener('click', () => {
    try {
      downloadFile('sauvegarde-pluto-restau-jomo.json', JSON.stringify(state, null, 2), 'application/json');
      setFeedback('Sauvegarde complète téléchargée.', false);
    } catch (error) {
      setFeedback(error.message || 'Impossible de créer la sauvegarde.', true);
    }
  });

  document.getElementById('importShopBackup').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Restaurer cette sauvegarde remplacera le catalogue, les commandes et les réglages présents sur cet appareil. Continuer ?')) return;
    try {
      const imported = JSON.parse(await file.text());
      window.RjmStore.saveState(imported);
      render();
      resetProductForm();
      setFeedback('Sauvegarde restaurée.', false);
    } catch (error) {
      setFeedback(error.message || 'Le fichier de sauvegarde est invalide.', true);
    }
  });

  try {
    render();
    renderHeroImage();
  } catch (error) {
    setFeedback(error.message || 'Impossible de charger la boutique.', true);
  }

  loadMaintenanceStatus();
});
