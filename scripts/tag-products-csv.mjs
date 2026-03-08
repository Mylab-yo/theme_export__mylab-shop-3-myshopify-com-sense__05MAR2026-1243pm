/**
 * tag-products-csv.mjs — Ajoute les tags MyLab (gamme + contenance + type) via CSV
 *
 * Usage :
 *   node scripts/tag-products-csv.mjs
 *
 * Lit  : C:\Users\startec\Downloads\products_export_1.csv
 * Écrit : C:\Users\startec\Downloads\products_tagged.csv
 */

import fs from 'fs';

const INPUT  = 'C:\\Users\\startec\\Downloads\\products_export_1.csv';
const OUTPUT = 'C:\\Users\\startec\\Downloads\\products_tagged.csv';

/* ------------------------------------------------------------------ */
/* PARSING CSV correct (gère les champs multi-lignes entre guillemets)  */
/* ------------------------------------------------------------------ */

function parseCSV(raw) {
  const rows = [];
  let row    = [];
  let field  = '';
  let inQ    = false;

  for (let i = 0; i < raw.length; i++) {
    const ch   = raw[i];
    const next = raw[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')            { inQ = false; }
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { inQ = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* ignore */ }
      else                  { field += ch; }
    }
  }
  // dernière cellule / ligne
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows;
}

function escapeCSV(val) {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* LOGIQUE DE TAGS                                                       */
/* ------------------------------------------------------------------ */

function computeTags(handle, title, type, existingTags) {
  const h    = (handle || '').toLowerCase();
  const t    = (title  || '').toLowerCase();
  const ty   = (type   || '').toLowerCase();
  const text = `${h} ${t} ${ty}`;

  const tags = new Set(
    (existingTags || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  /* ---- Gamme ---- */
  if (text.includes('nourrissant'))                                    tags.add('nourrissant');
  if (text.includes('volume'))                                         tags.add('volume');
  if (text.includes('lissant'))                                        tags.add('lissant');
  if (text.includes('repulpe') || text.includes('botox') ||
      text.includes('hyaluron'))                                       tags.add('ha-repulpe');
  if (text.includes('purifiant'))                                      tags.add('purifiant');
  if (text.includes('boucle'))                                         tags.add('boucles');
  if (text.includes('protecteur') && text.includes('couleur'))         tags.add('protecteur-couleur');
  if (text.includes('dejaunisseur') || text.includes('déjaunisseur') ||
      text.includes('coloristeur')  || text.includes('platine') ||
      text.includes('blond-soleil') || text.includes('blond-vanille') ||
      text.includes('cuivre') || text.includes('noisette') ||
      text.includes('chocolat'))                                       tags.add('dejaunisseur');
  if ((text.includes('reparateur') || text.includes('réparateur')) &&
       text.includes('spray'))                                         tags.add('masque-reparateur');
  if (text.includes('miraculeux') || text.includes('finition') ||
      (text.includes('bain') && text.includes('miraculeux')))          tags.add('finition');
  if (text.includes('herborist') || text.includes('barbe') ||
      text.includes('cbd'))                                            tags.add('homme');
  if (ty.includes('cire') || (text.includes('cire') &&
      !text.includes('ricin') && !text.includes('macadamia') &&
      !text.includes('camellia')))                                     tags.add('cire');

  /* ---- Contenance ---- */
  const contenanceTags = ['50ml','200ml','400ml','500ml','1000ml'];
  const hasContenance  = contenanceTags.some(c => tags.has(c));
  if (!hasContenance) {
    if      (h.includes('1000') || t.includes('1000 ml') || t.includes('1000ml'))  tags.add('1000ml');
    else if (h.includes('500')  || t.includes('500 ml')  || t.includes('500ml'))   tags.add('500ml');
    else if (h.includes('400')  || t.includes('400 ml')  || t.includes('400ml'))   tags.add('400ml');
    else if (h.includes('-50')  || t.includes('50 ml')   || t.includes('50ml'))    tags.add('50ml');
    else                                                                             tags.add('200ml');
  }

  /* ---- Type produit ---- */
  if (ty.includes('shampoing')  || t.includes('shampoing'))           tags.add('shampoing');
  if (ty.includes('masque')     || t.includes('masque'))              tags.add('masque');
  if (ty.includes('crème')      || ty.includes('creme') ||
      t.includes('crème')       || t.includes('sans rinçage'))        tags.add('crème');
  if (ty.includes('spray')      || t.includes('spray'))               tags.add('spray');
  if ((ty.includes('huile')     || t.includes('huile')) &&
      !text.includes('ricin')   && !text.includes('macadamia'))       tags.add('huile');
  if (ty.includes('sérum') || ty.includes('serum') ||
      (t.includes('sérum') && !t.includes('barbe')))                  tags.add('sérum');

  return Array.from(tags).sort().join(', ');
}

/* ------------------------------------------------------------------ */
/* MAIN                                                                  */
/* ------------------------------------------------------------------ */

console.log('\n🏷️  MyLab — Tag produits via CSV');
console.log('   Lecture du fichier...');

const raw  = fs.readFileSync(INPUT, 'utf8');
const rows = parseCSV(raw);

const header   = rows[0];
const iHandle  = header.indexOf('Handle');
const iTitle   = header.indexOf('Title');
const iType    = header.indexOf('Type');
const iTags    = header.indexOf('Tags');

if (iHandle === -1 || iTags === -1) {
  console.error('❌  Colonnes Handle ou Tags introuvables.');
  process.exit(1);
}

console.log(`   ${rows.length - 1} lignes trouvées\n`);

const tagsByHandle = new Map();
let changed = 0;

const outputRows = [header];

for (let i = 1; i < rows.length; i++) {
  const fields  = [...rows[i]];
  const handle  = fields[iHandle] || '';
  const title   = fields[iTitle]  || '';
  const type    = fields[iType]   || '';
  const oldTags = fields[iTags]   || '';

  // Lignes de continuation sans handle = variante déjà traitée ou ligne vide
  if (!handle) {
    outputRows.push(fields);
    continue;
  }

  let newTags;
  if (!tagsByHandle.has(handle)) {
    newTags = computeTags(handle, title, type, oldTags);
    tagsByHandle.set(handle, newTags);

    const oldSorted = oldTags.split(',').map(s => s.trim()).filter(Boolean).sort().join(', ');
    if (newTags !== oldSorted) {
      console.log(`✏️  ${handle}`);
      console.log(`   Avant : ${oldTags || '(aucun)'}`);
      console.log(`   Après : ${newTags}\n`);
      changed++;
    } else {
      console.log(`✅  ${handle}`);
    }
  } else {
    newTags = tagsByHandle.get(handle);
  }

  fields[iTags] = newTags;
  outputRows.push(fields);
}

// Reconstruction du CSV
const csvOut = outputRows
  .map(row => row.map(escapeCSV).join(','))
  .join('\n');

fs.writeFileSync(OUTPUT, csvOut, 'utf8');

console.log('\n' + '─'.repeat(60));
console.log(`✅  ${changed} produit(s) tagué(s)`);
console.log(`📄  Fichier enregistré : ${OUTPUT}`);
console.log(`\n👉  Importe dans Shopify : Produits → Importer`);
console.log(`    Cocher "Écraser les produits existants" → Importer`);
