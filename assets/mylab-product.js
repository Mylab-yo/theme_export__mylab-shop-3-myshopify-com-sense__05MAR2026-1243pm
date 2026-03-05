/**
 * MyLab Shop — Logique fiche produit + Panier AJAX
 * Fichier : assets/mylab-product.js
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    const euros = cents / 100;
    return euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function formatMoneyCompact(cents) {
    const euros = cents / 100;
    return euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const state = {
    selectedContenance: null,
    selectedVariantId: null,
    selectedQty: null,
    currentTiers: [],
    variantPrice: 0
  };

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    const handle = window.location.pathname.split('/products/')[1].split('?')[0];
    if (!handle) return;

    try {
      const response = await fetch(`/products/${handle}.js`);
      const product = await response.json();

      window.MylabProductData = {
        productId: product.id,
        productHandle: product.handle,
        variants: product.variants.map(v => ({
          id: v.id,
          contenance: v.option1,
          price: v.price,
          available: v.available
        })),
        tiers: {
          "200ml": [
            { qty: 6,  price: 700 },
            { qty: 12, price: 665 },
            { qty: 24, price: 630 },
            { qty: 48, price: 560 },
            { qty: 96, price: 500 }
          ],
          "500ml": [
            { qty: 6,  price: 1490 },
            { qty: 14, price: 1340 },
            { qty: 28, price: 1265 },
            { qty: 42, price: 1190 },
            { qty: 54, price: 1065 }
],
          "1000ml": [
            { qty: 1,  price: 2490 },
            { qty: 3,  price: 2365 },
            { qty: 6,  price: 2100 },
            { qty: 9,  price: 1990 },
            { qty: 12, price: 1865 }
          ]
        }
      };
    } catch (e) {
      console.error('MyLab: impossible de charger les données produit', e);
      return;
    }

    initProduct();
    initCartDrawer();
    initGallery();
    fetchAndRenderCart();
  }

  // Bloquer le drawer Sense en permanence
const observer = new MutationObserver(function() {
  const senseDrawer = document.querySelector('cart-drawer');
  if (senseDrawer && senseDrawer.classList.contains('is-active')) {
    senseDrawer.classList.remove('is-active');
    senseDrawer.classList.remove('drawer');
    if (typeof senseDrawer.close === 'function') senseDrawer.close();
  }
});

const senseDrawerEl = document.querySelector('cart-drawer');
if (senseDrawerEl) {
  observer.observe(senseDrawerEl, { attributes: true, subtree: true, attributeFilter: ['aria-expanded', 'class'] });
}

  // ============================================================
  // CALCUL PRIX REMISÉ DEPUIS LES TIERS
  // ============================================================

  function getUnitPriceFromTiers(variantTitle, quantity) {
    const data = window.MylabProductData;
    if (!data) return null;

    // Nettoyer le titre de la variante (ex: "200ml" ou "200 ml")
    const contenance = (variantTitle || '').replace(/\s/g, '') || '200ml';
    const tiers = data.tiers[contenance] || data.tiers['200ml'];

    // Trouver le palier le plus élevé correspondant à la quantité
    let unitPrice = tiers[0].price;
    for (const tier of tiers) {
      if (quantity >= tier.qty) unitPrice = tier.price;
    }
    return unitPrice;
  }

  // ============================================================
  // PRODUIT
  // ============================================================

  function initProduct() {
  const activeBtn = document.querySelector('.ml-contenance-btn.is-active')
                 || document.querySelector('.ml-contenance-btn');

  if (activeBtn) {
    const contenance = activeBtn.dataset.contenance;
    const variantId = parseInt(activeBtn.dataset.variantId);
    const data = window.MylabProductData;
    const variant = data.variants.find(v => v.id === variantId);

    state.selectedContenance = contenance;
    state.selectedVariantId = variantId;
    state.variantPrice = variant ? variant.price : 0;
    state.currentTiers = data.tiers[contenance] || data.tiers['200ml'];

    renderQtyButtons(state.currentTiers);
    const firstQtyBtn = document.querySelector('.ml-qty-btn');
    if (firstQtyBtn) selectQty(firstQtyBtn);
  }

  const cartBtn = document.getElementById('ml-btn-cart');
  if (cartBtn) cartBtn.addEventListener('click', handleAddToCart);

  const descToggle = document.querySelector('.ml-desc-toggle');
  if (descToggle) {
    descToggle.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      this.closest('.ml-description').classList.toggle('is-open');
    });
  }
}

  function selectContenance(btn) {
    const data = window.MylabProductData;
    const contenance = btn.dataset.contenance;
    const variantId = parseInt(btn.dataset.variantId);
    const variant = data.variants.find(v => v.id === variantId);

    document.querySelectorAll('.ml-contenance-btn').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');

    state.selectedContenance = contenance;
    state.selectedVariantId = variantId;
    state.variantPrice = variant ? variant.price : 0;

    const tiers = data.tiers[contenance] || data.tiers['200ml'];
    state.currentTiers = tiers;

    updateGalleryForContenance(contenance);
    renderQtyButtons(tiers);

    const firstQtyBtn = document.querySelector('.ml-qty-btn');
    if (firstQtyBtn) selectQty(firstQtyBtn);
  }

  // ============================================================
  // PALIERS
  // ============================================================

  function renderQtyButtons(tiers) {
    const container = document.getElementById('ml-qty-btns');
    if (!container) return;

    container.innerHTML = '';
    const basePrice = tiers[0].price;

    tiers.forEach((tier, index) => {
      const discountPct = Math.round((1 - tier.price / basePrice) * 100);
      const btn = document.createElement('button');
      btn.className = 'ml-qty-btn' + (index === 0 ? ' is-active' : '');
      btn.setAttribute('data-qty', tier.qty);
      btn.setAttribute('data-price', tier.price);
      btn.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');

      btn.innerHTML = `
        <span class="ml-qty-btn__num">${tier.qty}</span>
        <span class="ml-qty-btn__label">unité${tier.qty > 1 ? 's' : ''}</span>
        ${discountPct > 0 ? `<span class="ml-qty-btn__badge">-${discountPct}%</span>` : ''}
      `;

      btn.addEventListener('click', function () { selectQty(this); });
      container.appendChild(btn);
    });
  }

  function selectQty(btn) {
    const qty = parseInt(btn.dataset.qty);
    const unitPrice = parseInt(btn.dataset.price);

    document.querySelectorAll('.ml-qty-btn').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');

    state.selectedQty = qty;
    updatePriceDisplay(qty, unitPrice);
    updatePalierTable(qty);
    updateCartButton(qty);
  }

  function updatePriceDisplay(qty, unitPrice) {
    const basePrice = state.currentTiers[0].price;
    const totalPrice = unitPrice * qty;
    const savings = (basePrice - unitPrice) * qty;

    const totalEl = document.getElementById('ml-price-total');
    if (totalEl) {
      totalEl.classList.add('is-updating');
      setTimeout(() => {
        totalEl.textContent = formatMoneyCompact(totalPrice);
        totalEl.classList.remove('is-updating');
      }, 120);
    }

    const unitEl = document.getElementById('ml-price-unit');
    if (unitEl) unitEl.textContent = formatMoney(unitPrice);

    const savingsEl = document.getElementById('ml-price-savings');
    const savingsText = document.getElementById('ml-savings-text');
    if (savingsEl && savingsText) {
      if (savings > 0) {
        savingsText.textContent = `Vous économisez ${formatMoney(savings)} sur cette commande`;
        savingsEl.classList.add('is-visible');
      } else {
        savingsEl.classList.remove('is-visible');
      }
    }
  }

  function updatePalierTable(activeQty) {
    const tbody = document.getElementById('ml-palier-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const basePrice = state.currentTiers[0].price;

    state.currentTiers.forEach(tier => {
      const unitPrice = tier.price;
      const discountPct = Math.round((1 - unitPrice / basePrice) * 100);
      const isActive = tier.qty === activeQty;

      const tr = document.createElement('tr');
      if (isActive) tr.classList.add('is-active');

      tr.innerHTML = `
        <td class="ml-palier-qty">${tier.qty} unité${tier.qty > 1 ? 's' : ''}</td>
        <td class="ml-palier-price">${formatMoney(unitPrice)}</td>
        <td class="ml-palier-discount">
          ${discountPct > 0
            ? `<span class="ml-discount-badge">-${discountPct}%</span>`
            : '<span class="ml-no-discount">—</span>'
          }
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function updateCartButton(qty) {
    const pill = document.getElementById('ml-cart-pill');
    if (pill) pill.textContent = `${qty} unité${qty > 1 ? 's' : ''}`;
  }

  // ============================================================
  // AJOUT AU PANIER
  // ============================================================

  async function handleAddToCart() {
    const btn = document.getElementById('ml-btn-cart');
    if (!btn || !state.selectedVariantId || !state.selectedQty) return;

    btn.classList.add('is-loading');
    btn.disabled = true;

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ items: [{ id: state.selectedVariantId, quantity: state.selectedQty }] })
      });

      if (!response.ok) throw new Error('Erreur ajout panier');

      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      const textEl = btn.querySelector('.ml-btn-cart__text');
      if (textEl) textEl.textContent = 'Ajouté !';

      await fetchAndRenderCart();

      setTimeout(() => {
        btn.classList.remove('is-success');
        btn.disabled = false;
        if (textEl) textEl.textContent = 'Ajouter au panier';
      }, 2000);

    } catch (error) {
      console.error('MyLab Cart Error:', error);
      btn.classList.remove('is-loading');
      btn.disabled = false;
      btn.classList.add('is-error');
      setTimeout(() => btn.classList.remove('is-error'), 2000);
    }
  }

  // ============================================================
  // PANIER — FETCH & RENDER
  // ============================================================

  async function fetchAndRenderCart() {
    try {
      const response = await fetch('/cart.js', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const cart = await response.json();
      renderCart(cart);
      updateCartCount(cart.item_count);
    } catch (error) {
      console.error('MyLab Fetch Cart Error:', error);
    }
  }

  function renderCart(cart) {
    const itemsContainer = document.getElementById('ml-drawer-items');
    const emptyEl = document.getElementById('ml-drawer-empty');
    const footerEl = document.getElementById('ml-drawer-footer');
    const subtotalEl = document.getElementById('ml-drawer-subtotal');
    const countEl = document.getElementById('ml-drawer-count');

    if (!itemsContainer) return;

    if (countEl) countEl.textContent = cart.item_count;

    if (cart.item_count === 0) {
      itemsContainer.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'block';

    // Calculer le sous-total avec les vrais prix remisés depuis les tiers
    const calculatedTotal = cart.items.reduce((sum, item) => {
      const unitPrice = getUnitPriceFromTiers(item.variant_title, item.quantity);
      return sum + (unitPrice ? unitPrice * item.quantity : item.line_price);
    }, 0);

    if (subtotalEl) subtotalEl.textContent = formatMoney(calculatedTotal) + ' HT';

    itemsContainer.innerHTML = cart.items.map(item => {
      const unitPrice = getUnitPriceFromTiers(item.variant_title, item.quantity);
      const linePrice = unitPrice ? unitPrice * item.quantity : item.line_price;
      const displayUnitPrice = unitPrice || item.price;

      return `
        <div class="ml-cart-item" data-line="${item.variant_id}" data-key="${item.key}">
          <div class="ml-cart-item__img">
            ${item.image
              ? `<img src="${item.image}" alt="${item.product_title}" loading="lazy">`
              : '<div class="ml-cart-item__img-placeholder"></div>'
            }
          </div>
          <div class="ml-cart-item__details">
            <div class="ml-cart-item__header">
              <div class="ml-cart-item__name">${item.product_title}</div>
              <div class="ml-cart-item__unit-price">${formatMoney(displayUnitPrice)} HT / unité</div>
            </div>
            ${item.variant_title && item.variant_title !== 'Default Title'
              ? `<div class="ml-cart-item__variant">${item.variant_title}</div>`
              : ''
            }
            <div class="ml-cart-item__price-row">
              <div class="ml-cart-item__qty-display">
                <span>${item.quantity} unité${item.quantity > 1 ? 's' : ''}</span>
                <span class="ml-cart-item__price">${formatMoney(linePrice)} HT</span>
              </div>
              <button class="ml-cart-item__remove" data-key="${item.key}" aria-label="Supprimer">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    attachCartItemListeners();
  }

  function attachCartItemListeners() {
    document.querySelectorAll('.ml-cart-item__remove').forEach(btn => {
      btn.addEventListener('click', async function () {
        await updateCartItem(this.dataset.key, 0);
      });
    });
  }

  async function updateCartItem(key, quantity) {
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: key, quantity })
      });
      const cart = await response.json();
      renderCart(cart);
      updateCartCount(cart.item_count);
    } catch (error) {
      console.error('MyLab Update Cart Error:', error);
    }
  }

  // ============================================================
  // PANIER TIROIR
  // ============================================================

  function initCartDrawer() {
  const closeBtn = document.getElementById('ml-drawer-close');
  const overlay = document.getElementById('ml-drawer-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  const selectors = [
    '#cart-icon-bubble',
    'a[href="/cart"]',
    '.header__icon--cart',
    '[data-cart-trigger]'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleDrawer();
      }, true);
    });
  });
}

  function openDrawer() {
  const drawer = document.getElementById('ml-cart-drawer');
  const overlay = document.getElementById('ml-drawer-overlay');
  if (drawer) {
    drawer.style.cssText = 'position: fixed !important; top: 0 !important; right: 0 !important; left: auto !important; width: 480px !important; height: 100vh !important; z-index: 99999 !important;';
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) { overlay.classList.add('is-visible'); overlay.setAttribute('aria-hidden', 'false'); }
  document.body.classList.add('ml-drawer-open');
}
  
  function closeDrawer() {
    const drawer = document.getElementById('ml-cart-drawer');
    const overlay = document.getElementById('ml-drawer-overlay');
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (overlay) { overlay.classList.remove('is-visible'); overlay.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('ml-drawer-open');
  }

  function toggleDrawer() {
    const drawer = document.getElementById('ml-cart-drawer');
    if (drawer && drawer.classList.contains('is-open')) {
      closeDrawer();
    } else {
      fetchAndRenderCart().then(openDrawer);
    }
  }
  

  function updateCartCount(count) {
    document.querySelectorAll('.cart-count-bubble, [data-cart-count]').forEach(el => {
      el.textContent = count;
      if (count > 0) el.style.display = '';
    });
    const drawerCount = document.getElementById('ml-drawer-count');
    if (drawerCount) drawerCount.textContent = count;
  }

  // ============================================================
  // GALERIE
  // ============================================================

  function updateGalleryForContenance(contenance) {
    document.querySelectorAll('.ml-gallery__slide').forEach(slide => {
      slide.classList.toggle('is-active', slide.dataset.contenance === contenance);
    });
  }

  function initGallery() {
    document.querySelectorAll('.ml-gallery__thumb').forEach(thumb => {
      thumb.addEventListener('click', function () {
        document.querySelectorAll('.ml-gallery__thumb').forEach(t => t.classList.remove('is-active'));
        this.classList.add('is-active');
      });
    });
  }

  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

  window.MylabCart = { open: openDrawer, close: closeDrawer, refresh: fetchAndRenderCart };

  // Désactiver le drawer natif Sense et forcer le nôtre
const senseDrawer = document.querySelector('cart-drawer');
if (senseDrawer) {
  senseDrawer.style.display = 'none';
  senseDrawer.open = function() {};
  senseDrawer.close = function() {};
}

// Cloner le bouton panier pour supprimer les listeners BSS
const cartBtn = document.getElementById('cart-icon-bubble');
if (cartBtn) {
  const clone = cartBtn.cloneNode(true);
  cartBtn.parentNode.replaceChild(clone, cartBtn);
  clone.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    toggleDrawer();
  }, true);
}

// Intercepter tous les autres clics vers le panier
document.addEventListener('click', function(e) {
  const cartLink = e.target.closest('a[href="/cart"], .header__icon--cart');
  if (cartLink && cartLink.id !== 'cart-icon-bubble') {
    e.preventDefault();
    e.stopImmediatePropagation();
    toggleDrawer();
  }
}, true);

})();