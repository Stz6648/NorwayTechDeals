# Branch claude/content-seo-upgrade — round 1

Backup: local tag `backup-main-2026-11-02` marks main before these changes. Production `products.json` and `public/products.json` are untouched.

## Changes
- Primary domain unified to https://norwaytechdeals.no (canonicals, og:url, sitemap, robots). Added missing canonicals to about/contact/privacy/terms/affiliate.
- sitemap.xml (root and public) now lists only indexable pages: home + 3 guides. Removed URLs that vercel.json 301-redirects.
- robots.txt added to public/ as well (serving directory unconfirmed).
- Home page: new "Kjøpeguider" section and nav link to the existing guides.
- `data/merchants.json`: approval gate. Only status `approved` merchants may be published with affiliate links.
- `scripts/build-norway-catalogue.js`: cleans the Proshop/Acer feed snapshot into `data/norway-catalogue.json` (gitignored). Filters: NOK only, tracked link, confirmed in stock, new, consumer price ceilings, enterprise/server products, duplicates. Report in `data/norway-catalogue-report.json`.

## Manual checks before merging/deploying
1. Vercel dashboard: confirm whether apex or www is the primary domain. Do NOT add a www->apex redirect in vercel.json if the dashboard already redirects apex->www (redirect loop). Set the redirect in Domains.
2. Google Search Console: add the apex property, submit sitemap.
3. contact@techkjop.no addresses left unchanged (mailbox domain not verified).
4. Confirm merchant approvals, then update `data/merchants.json`.
5. Re-download a fresh feed (snapshot is dated 2026-09-27) before any price is published.

## Round 2 — eBay-only guide pages (drafts)
- `scripts/build-guides.js` + `content/guides/*.json` generate Norwegian guide pages from `products.json`.
- Two drafts, both `noindex` and left out of the sitemap until `"publish": true` is set in the JSON and the script is re-run:
  - `/beste-grafikkort-1440p.html`
  - `/beste-pc-oppgraderinger.html`
- Prices are shown as eBay.com USD listing prices with the catalogue date. No NOK conversion, no Norway delivery claim.
- Build fails if: merchant not approved in `data/merchants.json`, link lacks the eBay campaign id, currency is not USD, page shows NOK/kr amounts, disclosure or `rel="nofollow sponsored"` is missing.
- Not done: titles that need Norwegian merchant prices (gaming-PC/laptop under X kr) — blocked on affiliate approval and a fresh feed.
