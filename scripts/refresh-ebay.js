// Refreshes products.json (and public/products.json) from the eBay Browse API.
// Safe by design: builds the new catalogue in memory, validates it, writes to temp files, then renames.
// If anything fails, the existing catalogue is left untouched and the process exits non-zero.
//
// Usage:
//   EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=... node scripts/refresh-ebay.js
//   node scripts/refresh-ebay.js --fixture path/to/search-responses.json   (offline test, no network)
//   add --dry-run to validate and report without writing products.json
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const fixturePath = args.includes("--fixture") ? args[args.indexOf("--fixture") + 1] : null;
const dryRun = args.includes("--dry-run");
const CAMPAIGN = process.env.EBAY_CAMPAIGN_ID || "5339206505";
const MAX_PER_BUCKET = Number(process.env.MAX_PER_BUCKET || 60);
const plan = JSON.parse(fs.readFileSync(path.join(root, "data", "ebay-queries.json"), "utf8"));
const productsPath = path.join(root, "products.json");
const previous = fs.existsSync(productsPath) ? JSON.parse(fs.readFileSync(productsPath, "utf8")) : [];

const ALLOWED = new Set(["Graphics Cards", "Gaming PCs", "Desktop PCs", "Laptops", "Processors", "Memory", "Storage", "Monitors"]);
const REVIEW_LIMIT_USD = { "Graphics Cards": 2200, "Gaming PCs": 10000, "Desktop PCs": 10000, Laptops: 8000, Processors: 2500, Memory: 2000, Storage: 2500, Monitors: 3000 };
const BAD_TITLE = /\b(for parts|not working|broken|untested|empty box|box only|lot of|read description|as[- ]is|no returns|defective|cracked)\b/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error("Refresh aborted: " + msg); process.exit(1); };

let token = null;
async function getToken() {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) fail("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope")
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) fail("eBay OAuth failed with HTTP " + res.status);
  return data.access_token;
}

const fixture = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : null;
async function search(q, conditionIds, offset) {
  if (fixture) return { itemSummaries: fixture };
  const url = "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" + encodeURIComponent(q) +
    "&limit=50&offset=" + offset + "&filter=conditionIds:{" + conditionIds + "}";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: {
      Authorization: "Bearer " + token, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      "X-EBAY-C-ENDUSERCTX": "affiliateCampaignId=" + CAMPAIGN, "Accept-Language": "en-US" } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * attempt); continue; }
    throw new Error("HTTP " + res.status);
  }
  throw new Error("gave up after retries");
}

(async () => {
  if (!fixture) token = await getToken();
  const nowIso = new Date().toISOString();
  const seen = new Set(), buckets = new Map(), failures = [];
  let calls = 0, rawItems = 0;

  for (const spec of plan.queries) {
    const must = new RegExp(spec.mustMatch, "i"), ex = spec.exclude ? new RegExp(spec.exclude, "i") : null;
    for (const pass of plan.passes) {
      for (let page = 0; page < (spec.pages || 1); page++) {
        let data;
        try { calls++; data = await search(spec.q, pass.conditionIds, page * 50); }
        catch (e) { failures.push(`${spec.q} [${pass.name}] page ${page}: ${e.message}`); break; }
        if (!fixture) await sleep(250);
        const items = data.itemSummaries || [];
        rawItems += items.length;
        for (const it of items) {
          const price = Number(it.price && it.price.value), title = String(it.title || "");
          if (!it.itemId || !title || seen.has(it.itemId)) continue;
          if (!(price > 0) || String(it.price.currency).toUpperCase() !== "USD") continue;
          if (!String(it.itemAffiliateWebUrl || "").includes("campid=" + CAMPAIGN)) continue;
          const image = (it.image && it.image.imageUrl) || (it.thumbnailImages && it.thumbnailImages[0] && it.thumbnailImages[0].imageUrl);
          if (!/^https:\/\//.test(image || "")) continue;
          if (Array.isArray(it.buyingOptions) && !it.buyingOptions.includes("FIXED_PRICE")) continue; // skip auction-only (price = current bid)
          if (!must.test(title) || (ex && ex.test(title)) || BAD_TITLE.test(title)) continue;
          if (spec.minPrice && price < spec.minPrice) continue;
          if (spec.maxPrice && price > spec.maxPrice) continue;
          const key = spec.category + "|" + pass.name;
          const list = buckets.get(key) || [];
          if (list.length >= MAX_PER_BUCKET) continue;
          seen.add(it.itemId);
          const review = price > (REVIEW_LIMIT_USD[spec.category] || 5000);
          list.push({
            id: it.itemId, name: title, description: title, image,
            offers: [{ store: "eBay", condition: it.condition || "Unspecified", price, currency: "USD", url: it.itemAffiliateWebUrl,
              affiliate: true, affiliateNetwork: "eBay Partner Network", updatedAt: nowIso }],
            category: spec.category, marketplace: "eBay US", sourceMarket: "EBAY_US", shippingToNorwayVerified: false,
            priceReview: review,
            priceReviewReason: review ? "High listing price for this category; compare the exact model and condition before purchase." : ""
          });
          buckets.set(key, list);
        }
      }
    }
  }

  const next = [...buckets.values()].flat();
  const byCategory = {}, byCondition = {};
  for (const p of next) { byCategory[p.category] = (byCategory[p.category] || 0) + 1; byCondition[p.offers[0].condition] = (byCondition[p.offers[0].condition] || 0) + 1; }
  const report = { fetchedAt: nowIso, mode: fixture ? "fixture" : "live", apiCalls: calls, rawItems, kept: next.length, previous: previous.length, byCategory, byCondition, failures };

  const problems = [];
  const minCount = Number(process.env.MIN_PRODUCTS || Math.max(150, Math.floor(previous.length * 0.5)));
  if (next.length < minCount) problems.push(`only ${next.length} products; minimum is ${minCount}`);
  if (failures.length > Math.floor(plan.queries.length * plan.passes.length * 0.25)) problems.push(`too many failed API calls (${failures.length})`);
  if (Object.values(byCategory).filter(n => n >= 10).length < 4) problems.push("fewer than 4 categories have at least 10 products");
  for (const p of next) if (!ALLOWED.has(p.category)) problems.push("bad category " + p.category);

  console.log(JSON.stringify(report, null, 2));
  if (problems.length) fail(problems.join("; ") + ". Existing catalogue left untouched.");
  if (dryRun) { console.log("Dry run: nothing written."); return; }

  const json = JSON.stringify(next, null, 2) + "\n";
  for (const target of [productsPath, path.join(root, "public", "products.json")]) {
    fs.writeFileSync(target + ".tmp", json);
    fs.renameSync(target + ".tmp", target);
  }
  fs.writeFileSync(path.join(root, "data", "ebay-refresh-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Wrote ${next.length} products.`);
})().catch(e => fail(e.message));
