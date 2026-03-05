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
    initGallery();
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
        body: JSON.stringify({
          items: [{ id: state.selectedVariantId, quantity: state.selectedQty }],
          sections: ['cart-drawer', 'cart-icon-bubble'],
          sections_url: window.location.pathname
        })
      });

      if (!response.ok) throw new Error('Erreur ajout panier');

      const parsedState = await response.json();

      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      const textEl = btn.querySelector('.ml-btn-cart__text');
      if (textEl) textEl.textContent = 'Ajouté !';

      try {
        const senseDrawer = document.querySelector('cart-drawer');
        if (senseDrawer && typeof senseDrawer.renderContents === 'function') {
          senseDrawer.renderContents(parsedState);
        } else if (senseDrawer && typeof senseDrawer.open === 'function') {
          senseDrawer.open();
        }
      } catch (drawerErr) {
        console.warn('MyLab: impossible d\'ouvrir le drawer', drawerErr);
      }

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

})();