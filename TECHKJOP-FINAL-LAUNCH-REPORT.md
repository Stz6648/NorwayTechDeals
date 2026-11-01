# TechKjøp — Final Launch Report

**Date:** 2026-11-01 (Europe/Oslo)  
**Result:** **BLOCKED**

## 1. Product catalog

- Original `ebay-products.json`: **578** records; preserved unchanged.
- `products.json`: **0** public products. `public/products.json`: **0** public products.
- Candidate records have positive finite prices, explicit USD currency, item links, names, categories, and eBay merchant identity. All 578 are single-merchant eBay US offers; Norway delivery and current offer prices were not independently verified. They do not satisfy the current three-merchant publication rule, so none were restored or represented as verified.
- Candidate source category counts: Graphics Card **191**, Gaming Laptop **44**, Gaming PC **49**, Laptop **45**, CPU **99**, RAM **50**, SSD **50**, Monitor **50**. Public counts for each of the seven configured categories are **0**: Gaming PC, Gaming Laptop, Graphics Card, CPU, RAM, SSD, Monitor.
- Duplicate candidate IDs: **0**. Candidate records matching the 22 hidden IDs: **3**; matching the 35 price-protected IDs: **9**. All **22 hidden** and **35 price-protection** rules are retained in code. Protected listing prices and related currency/verification fields are removed from public output.
- No historical backups or `products_merged_proshop.json` data were used to repopulate either public catalog.

## 2. Automatic update safeguards

- Added catalog validation for non-empty results, a minimum of 25 products, seven supported categories, unique product IDs, positive finite prices, currency allowlist, merchant, URL, and required product fields.
- Updates use a lock, produce an add/update/remove diff report, reject catalog drops below half of the previous size, and validate before writing catalog files via temporary files and atomic rename. Empty or failed sources leave existing public catalogs untouched.
- The 22 hidden and 35 price-protected listing sets are applied before publication.
- GitHub Actions runs tests first, serializes update runs, and proposes catalog changes in a PR to `main`; it no longer pushes catalog updates directly to `main`.
- `npm test`: **13 passed, 0 failed**. Syntax checks for updater, safety module, and Preview eBay endpoint passed; `git diff --check` passed. No live product refresh was run. No build script is defined in `package.json`.

## 3. Preview and Production safety

- `VERCEL_ENV=preview` forces the Express app into read-only mode and reads only `public/products.json`. The app does not load a live updater or expose refresh/publish handlers.
- `/api/ebay-search` now returns 404 in Preview before accessing eBay credentials. Production without eBay credentials returns 503.
- `.vercelignore` now excludes environment files, raw candidate/history catalogs, tests, reports, backups, caches, logs, and updater code from deployment packaging.
- Vercel project settings were **not verified**: this workspace has no Vercel API/account connection. Production/Preview/Shared variable scopes, Upstash and eBay credential availability, `CRON_SECRET`, Cron task inventory, branch binding, and deployment protections remain unknown. No secret values were accessed.
- No Preview deployment was made. The empty public catalog does not meet the Preview deployment gate, and no approval for an empty-catalog Preview was supplied.

## 4. GitHub release

- Base ref available locally: `origin/main` at `6f87e22896d53d50e5679b2b2195f9bacc2d1add`; the existing release branch began at the user-provided `224d5f8b1fa68601627265fc03e494834fb4ec02`.
- Release-safety implementation commit: `feacaae` — **Harden catalog publication and Preview isolation**.
- No force push and no update to `main` were made. The implementation commit is ready on `codex/final-remote-main-integration`; Vercel Preview and Production deployments were not triggered.

## 5. Domain, HTTPS, and SEO

- A public web crawl reached `https://www.norwaytechdeals.no/` and rendered the TechKjøp home page; the result was crawled six days before this report, so this does not establish current deployment health. The HTTPS URL was served by that crawl.
- `/api/products`, `/robots.txt`, and `/sitemap.xml` could not be verified through the available public web reader. `sitemap.xml` exists in the repository; no `robots.txt` file was found. Current SEO and deployed product detail behavior remain unverified.
- No production deployment or domain/DNS changes were made.

## 6. Remaining launch blockers

1. There is no qualifying public product catalog. The 578 eBay offers are one merchant, in USD, and do not have verified Norway delivery/current pricing. Publishing them would violate the supplied rules.
2. Vercel Preview/Production/Shared settings and actual Cron tasks need verification through an authorized Vercel account. In particular, Preview must not receive Production Upstash, eBay, or `CRON_SECRET` credentials.
3. No eligible Preview deployment was made, so deployed read-only behavior, API responses, search/category/detail interactions, and JavaScript errors have not been smoke-tested.
4. The domain’s current HTTPS, `robots.txt`, `sitemap.xml`, and Production catalog behavior need live verification; this report’s web crawl is stale.

## 7. User actions needed

- Provide an authorized Vercel read-only connection or verify the listed environment scopes, secrets’ target scopes, Cron jobs, and Production branch in the Vercel dashboard. Do not expose secret values.
- Decide whether to approve a Preview with an empty catalog if no qualifying offers become available. Once the Preview gate is satisfied, review that Preview before Production.
- Approve Production deployment only after a qualifying catalog and the Vercel isolation checks are complete.

**Final conclusion: BLOCKED.**
