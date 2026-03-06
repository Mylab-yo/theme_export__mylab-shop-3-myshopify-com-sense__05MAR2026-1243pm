# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Shopify theme export based on the **Sense** theme, customized for **MyLab Shop** — a B2B French cosmetics store. The theme is deployed via the Shopify admin (Theme Editor / Shopify CLI); there is no local build step or test runner.

## Deploying changes

Use the Shopify CLI to push/pull theme files:

```bash
# Pull current live theme
shopify theme pull --store mylab-shop-3.myshopify.com

# Push changes to development theme
shopify theme push --store mylab-shop-3.myshopify.com --development

# Start local dev server with live reload
shopify theme dev --store mylab-shop-3.myshopify.com
```

Assets (JS/CSS) are served directly by Shopify's CDN — there is no bundler. Edit source files in `assets/` directly.

## Architecture

### Directory layout

| Directory | Purpose |
|-----------|---------|
| `layout/` | Root HTML shell. `theme.liquid` wraps all pages; `password.liquid` is the coming-soon layout. |
| `templates/` | JSON files that compose sections onto a page type (e.g. `product.mylab.json` for the custom product template). |
| `sections/` | Reusable Liquid section files, each with an embedded `{% schema %}` block for Theme Editor settings. |
| `snippets/` | Partial Liquid fragments rendered via `{% render %}` — stateless, receive variables as arguments. |
| `assets/` | Flat directory of JS, CSS, and SVG files. JS files are vanilla custom elements or IIFE modules. |
| `locales/` | Translation strings (`en.default.json` is the source; `.schema.json` files control Theme Editor labels). |

### MyLab custom layer (prefixed `ml-` / `mylab-`)

The store has a **fully custom product page** overlaid on top of the Sense theme:

- **`templates/product.mylab.json`** — alternate product template that loads `sections/mylab-product.liquid` as its main section instead of the standard `main-product`.
- **`sections/mylab-product.liquid`** — custom product page markup with: variant selector (contenance: 200ml / 500ml / 1000ml), quantity tier buttons, pricing card, tier summary table, and add-to-cart CTA. Quantity buttons are generated entirely by JS.
- **`assets/mylab-product.js`** — IIFE that drives the entire product page + cart drawer. Key responsibilities:
  - Fetches product JSON via `/products/{handle}.js` on init.
  - Hardcodes volume-pricing tiers per contenance in `window.MylabProductData.tiers`.
  - Renders quantity tier buttons and updates price display/savings on selection.
  - Adds to cart via `/cart/add.js`, then re-renders the custom drawer.
  - **Actively suppresses the native Sense `cart-drawer` web component** using a `MutationObserver` and by setting `style.display = 'none'` and overriding its `.open()`/`.close()` methods.
- **`sections/mylab-cart-drawer.liquid`** — custom cart drawer HTML (IDs prefixed `ml-drawer-*`). Included globally in `layout/theme.liquid` via `{% section 'mylab-cart-drawer' %}`.
- **`assets/mylab-product.css`** — all styles for the custom product page and cart drawer using `ml-` BEM-style class prefix.

### Sense theme base layer

Standard Shopify Sense theme components remain intact for all non-product pages. Key files:

- `assets/global.js` — shared custom elements (`SectionId`, `HTMLUpdateUtility`, `MenuDrawer`, etc.) used across sections.
- `assets/pubsub.js` — lightweight publish/subscribe bus used by Sense components to communicate (e.g. cart updates).
- `assets/cart.js`, `assets/cart-drawer.js` — Sense's own cart logic (bypassed on the MyLab product template).
- `assets/facets.js` — collection filtering logic.
- `assets/product-info.js`, `assets/product-form.js` — standard product page logic (used by `main-product` section, not by the MyLab custom template).

### Pricing logic (important)

Volume pricing is **hardcoded in JS** (`assets/mylab-product.js` lines 49–70), not stored in Shopify metafields or variant prices. Prices are in centimes (e.g. `700` = 7.00 €). The displayed subtotal in the cart drawer is recalculated client-side from these tiers — it does **not** match what Shopify charges. This is a B2B display layer; actual checkout pricing must be managed separately.

The "contenance" selector (`200ml`, `500ml`, `1000ml`) links to **separate product handles** (`shampoing-nourrissant`, `shampoing-nourrissant-500ml`, `shampoing-nourrissant-1000-ml`) rather than variants of a single product — each navigates to a new URL.

### Fonts

Two Google Font families are loaded in `layout/theme.liquid`: **Cormorant Garamond** (headings/body italic) and **DM Sans** (body). These are in addition to Shopify's theme font system variables.

## Key conventions

- All MyLab-specific CSS classes are prefixed `ml-`.
- MyLab JS is wrapped in an IIFE with `'use strict'` — no ES modules, no bundler.
- Sense native components use custom HTML elements (e.g. `<cart-drawer>`, `<product-info>`, `<variant-selects>`).
- Section schemas define Theme Editor settings; snippets have no schema and accept only passed variables.
- The native Sense cart drawer JS (`cart-drawer.js`) is commented out in `theme.liquid` — do not re-enable it without removing the MyLab override logic.
