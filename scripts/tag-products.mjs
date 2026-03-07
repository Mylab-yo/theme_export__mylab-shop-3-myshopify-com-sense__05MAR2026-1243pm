/**
 * tag-products.mjs — Ajoute des tags Gamme + Contenance + Type à tous les produits MyLab
 *
 * Usage :
 *   SHOPIFY_TOKEN=shpat_xxx node scripts/tag-products.mjs          ← aperçu (dry-run)
 *   SHOPIFY_TOKEN=shpat_xxx node scripts/tag-products.mjs --apply  ← applique les changements
 */

const STORE    = 'mylab-shop-3.myshopify.com';
const TOKEN    = process.env.SHOPIFY_TOKEN;
const DRY_RUN  = !process.argv.includes('--apply');
const API_VER  = '2024-01';

if (!TOKEN) {
  console.error('❌  Définis la variable SHOPIFY_TOKEN avant de lancer le script.');
  console.error('   Exemple : SHOPIFY_TOKEN=shpat_xxx node scripts/tag-products.mjs');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* LOGIQUE DE TAGS                                                      */
/* ------------------------------------------------------------------ */

/**
 * Détermine les tags à ajouter selon le handle et le titre du produit.
 * Conserve les tags existants + ajoute les nouveaux.
 */
function computeTags(product) {
  const handle = (product.handle || '').toLowerCase();
  const title  = (product.title  || '').toLowerCase();
  const type   = (product.product_type || '').toLowerCase();
  const vendor = (product.vendor || '').toLowerCase();
  const text   = `${handle} ${title} ${type} ${vendor}`;

  const existing = product.tags
    ? product.tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const tags = new Set(existing);

  /* ---- Gamme ---- */
  if (text.includes('nourrissant'))                               tags.add('nourrissant');
  if (text.includes('volume'))                                    tags.add('volume');
  if (text.includes('lissant'))                                   tags.add('lissant');
  if (text.includes('repulpe') || text.includes('botox') ||
      text.includes('hyaluron') || text.includes('ha-repulpe'))   tags.add('ha-repulpe');
  if (text.includes('purifiant'))                                 tags.add('purifiant');
  if (text.includes('boucle'))                                    tags.add('boucles');
  if (text.includes('couleur') || text.includes('protecteur-couleur') ||
      text.includes('camellia') || text.includes('camelia') ||
      text.includes('karanja'))                                   tags.add('protecteur-couleur');
  if (text.includes('dejaunisseur') || text.includes('déjaunisseur') ||
      text.includes('coloristeur') || text.includes('platine') ||
      text.includes('blond-soleil') || text.includes('blond-vanille') ||
      text.includes('cuivre') || text.includes('noisette') ||
      text.includes('chocolat') || text.includes('violet'))       tags.add('dejaunisseur');
  if (text.includes('reparateur') || text.includes('réparateur') ||
      (text.includes('spray') && text.includes('sans-rinca')))    tags.add('masque-reparateur');
  if (text.includes('bain-miraculeux') || text.includes('miraculeux') ||
      text.includes('finition') ||
      (type.includes('huile') && !text.includes('homme') && !text.includes('herborist') && !text.includes('barbe')) ||
      (type.includes('sérum') && !text.includes('barbe') && !text.includes('herborist')))
                                                                  tags.add('finition');
  if (text.includes('herborist') || text.includes('barbe') ||
      text.includes('cbd') || text.includes('chanvre') ||
      vendor.includes('herborist'))                               tags.add('homme');
  if (text.includes('cire') && !text.includes('ricin') &&
      !text.includes('macadamia') && !text.includes('karanja'))   tags.add('cire');

  /* ---- Contenance ---- */
  // Priorité : handle d'abord (plus fiable), sinon titre
  if (handle.includes('1000') || title.includes('1000 ml') || title.includes('1000ml') ||
      title.includes('1 l') || title.includes('1l')) {
    tags.add('1000ml');
  } else if (handle.includes('500') || title.includes('500 ml') || title.includes('500ml')) {
    tags.add('500ml');
  } else if (handle.includes('50ml') || handle.includes('50-ml') ||
             title.includes('50 ml') || title.includes('50ml')) {
    tags.add('50ml');
  } else {
    tags.add('200ml'); // par défaut (shampoing, masque, crème 200ml)
  }

  /* ---- Type lisible ---- */
  if (text.includes('shampoing'))                                 tags.add('shampoing');
  if (text.includes('masque') && !text.includes('masque-intense'))tags.add('masque');
  if (text.includes('masque-intense') || (text.includes('masque') && text.includes('intense')))
                                                                  tags.add('masque');
  if (text.includes('crème') || text.includes('creme') ||
      text.includes('sans-rinca') || text.includes('sans rinca')) tags.add('crème');
  if (text.includes('spray'))                                     tags.add('spray');
  if ((text.includes('huile') || text.includes('sérum') || text.includes('serum')) &&
      !text.includes('ricin') && !text.includes('macadamia'))     tags.add('soin-finition');
  if (text.includes('cire') && !text.includes('ricin'))          tags.add('cire');

  return Array.from(tags).sort().join(', ');
}

/* ------------------------------------------------------------------ */
/* API SHOPIFY                                                          */
/* ------------------------------------------------------------------ */

async function shopifyFetch(path, options = {}) {
  const url = `https://${STORE}/admin/api/${API_VER}/${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} — ${path}\n${body}`);
  }
  return res.json();
}

async function getAllProducts() {
  const products = [];
  let url = `products.json?limit=250&fields=id,handle,title,tags,product_type,vendor`;

  while (url) {
    const data = await shopifyFetch(url);
    products.push(...data.products);

    // Pagination via Link header (Shopify cursor-based)
    // Pour simplifier on suppose < 250 produits (courant pour une boutique B2B)
    url = null;
  }

  return products;
}

async function updateProductTags(productId, tags) {
  return shopifyFetch(`products/${productId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: { id: productId, tags } })
  });
}

/* ------------------------------------------------------------------ */
/* MAIN                                                                  */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🏷️  MyLab — Tag automatique des produits`);
  console.log(`   Store  : ${STORE}`);
  console.log(`   Mode   : ${DRY_RUN ? '👁️  DRY-RUN (aucune modification)' : '✏️  APPLY (modifications réelles)'}`);
  console.log('─'.repeat(60));

  const products = await getAllProducts();
  console.log(`\n${products.length} produit(s) trouvé(s)\n`);

  let changed = 0;

  for (const product of products) {
    const newTags  = computeTags(product);
    const oldTags  = (product.tags || '').split(',').map(t => t.trim()).filter(Boolean).sort().join(', ');
    const hasChanged = newTags !== oldTags;

    const status = hasChanged ? '✏️ ' : '✅';
    console.log(`${status} [${product.handle}]`);
    if (hasChanged) {
      console.log(`   Avant  : ${oldTags || '(aucun)'}`);
      console.log(`   Après  : ${newTags}`);
    }

    if (hasChanged && !DRY_RUN) {
      await updateProductTags(product.id, newTags);
      // Pause légère pour respecter le rate limit Shopify (2 req/s)
      await new Promise(r => setTimeout(r, 500));
      changed++;
    } else if (hasChanged) {
      changed++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (DRY_RUN) {
    console.log(`📋  ${changed} produit(s) seraient modifiés.`);
    console.log(`    Pour appliquer : SHOPIFY_TOKEN=${TOKEN} node scripts/tag-products.mjs --apply`);
  } else {
    console.log(`✅  ${changed} produit(s) mis à jour.`);
  }
}

main().catch(err => {
  console.error('\n❌  Erreur :', err.message);
  process.exit(1);
});
