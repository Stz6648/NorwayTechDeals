# US site (draft)

English, USD, eBay-focused. Separate from the Norwegian site; nothing here touches `products.json`, `public/` or `vercel.json` at the repo root.

- Build: `node us/build.js` → writes `us/public/`
- Config: `us/site.config.json` (brand, domain, contact email, publish flag)
- Content: `us/content/guides/*.json`
- While `publish` is false, every page is `noindex,nofollow`, robots.txt disallows everything and there is no sitemap.
- The build refuses to publish while `domain` or `contactEmail` are placeholders.

## Going live (after you decide)
1. Register a `.com`, put it and a real contact address in `site.config.json`, set `"publish": true`, rebuild.
2. Vercel: new project from this repo, **Root Directory = `us`**, no build command, output directory `public`. Attach the new domain to that project only.
3. Search Console: add the new property, submit `/sitemap.xml`.
4. Check eBay Partner Network program rules on price display and data freshness before publishing; refresh `products.json` first, since prices shown are a snapshot.
