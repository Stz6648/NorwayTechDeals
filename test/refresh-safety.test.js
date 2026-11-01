const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const safety = require("../refresh-safety");

function product(id = "p1", overrides = {}) {
  return { id, name: "Sample product", category: "Graphics Card", offers: [{ store: "Shop", price: 100, currency: "NOK", updatedAt: "2026-11-01", url: "https://example.no/item/1" }], ...overrides };
}

test("a single real merchant offer is sufficient and below-minimum catalogs are rejected", () => {
  assert.throws(() => safety.validateCatalog([]), /minimum/);
  assert.throws(() => safety.validateCatalog([product()], { minimum: 2 }), /minimum/);
  assert.equal(safety.validateCatalog([product()], { minimum: 1 }), true);
});

test("invalid prices and currencies are rejected", () => {
  assert.throws(() => safety.validateCatalog([product("p", { offers: [{ store: "Shop", price: Infinity, currency: "NOK", url: "https://x" }] })], { minimum: 1 }), /price/);
  assert.throws(() => safety.validateCatalog([product("p", { offers: [{ store: "Shop", price: 10, currency: "XXX", url: "https://x" }] })], { minimum: 1 }), /currency/);
});

test("a listing may omit price but cannot claim stale or undated pricing", () => {
  assert.equal(safety.validateCatalog([product("no-price", { offers: [{ store: "Shop", url: "https://example.no/item/1" }] })], { minimum: 1 }), true);
  assert.throws(() => safety.validateCatalog([product("undated", { offers: [{ store: "Shop", price: 9, currency: "USD", url: "https://example.no/item/1" }] })], { minimum: 1 }), /update time/);
});

test("duplicate ids and malformed merchant/link fields are rejected", () => {
  assert.throws(() => safety.validateCatalog([product(), product()], { minimum: 1 }), /Duplicate/);
  assert.throws(() => safety.validateCatalog([product("x", { offers: [{ price: 1, currency: "NOK", updatedAt: "2026-11-01", store: "Shop", url: "javascript:bad" }] })], { minimum: 1 }), /URL/);
});

test("hidden listing ids are removed and price protected ids are redacted", () => {
  const hiddenId = [...safety.HIDDEN_LISTING_IDS][0];
  const protectedId = [...safety.PRICE_PROTECTED_LISTING_IDS][0];
  const result = safety.filterProtectedListings([
    product("hidden", { offers: [{ itemId: hiddenId, store: "eBay", price: 10, currency: "USD", url: `https://www.ebay.com/itm/${hiddenId}` }] }),
    product("protected", { price: 10, lowestPrice: 10, lowestCurrency: "USD", originalPrice: 10, originalCurrency: "USD", priceVerified: true, offers: [{ itemId: protectedId, store: "eBay", price: 10, currency: "USD", url: `https://www.ebay.com/itm/${protectedId}`, priceVerified: true }] })
  ]);
  assert.equal(result.length, 1);
  assert.equal("price" in result[0].offers[0], false);
  assert.equal("currency" in result[0].offers[0], false);
  assert.equal("priceVerified" in result[0].offers[0], false);
  for (const key of ["price", "lowestPrice", "lowestCurrency", "originalPrice", "originalCurrency", "priceVerified"]) assert.equal(key in result[0], false);
});

test("catalog writes are atomic and preserve previous data after validation failure", () => {
  const dir = fs.mkdtempSync(path.join(__dirname, "catalog-safety-"));
  try {
    const file = path.join(dir, "products.json");
    safety.atomicWriteJSON(file, [product("old")]);
    const previous = fs.readFileSync(file, "utf8");
    assert.throws(() => safety.validateCatalog([]));
    assert.equal(fs.readFileSync(file, "utf8"), previous);
    safety.atomicWriteJSON(file, [product("new")]);
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8"))[0].id, "new");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("lock rejects overlapping update processes and releases for the next run", () => {
  const dir = fs.mkdtempSync(path.join(__dirname, "catalog-lock-"));
  try {
    const lock = path.join(dir, "update.lock");
    const release = safety.acquireLock(lock);
    assert.throws(() => safety.acquireLock(lock), /already running/);
    release();
    assert.doesNotThrow(() => safety.acquireLock(lock)());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("diff report captures additions, changes, and removals", () => {
  const result = safety.diffCatalog([product("keep"), product("remove")], [product("keep", { name: "Changed" }), product("add")]);
  assert.deepEqual(result.added, ["add"]);
  assert.deepEqual(result.updated, ["keep"]);
  assert.deepEqual(result.removed, ["remove"]);
});

test("normal validated update passes", () => {
  assert.equal(safety.validateCatalog([product()], { minimum: 1 }), true);
});

test("Preview eBay search rejects before reading credentials", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "ebay-search.js"), "utf8");
  assert.ok(source.indexOf('process.env.VERCEL_ENV === "preview"') < source.indexOf("process.env.EBAY_CLIENT_ID"));
  assert.match(source, /return res\.status\(404\)/);
});

test("Actions updates are serialized and create a pull request against main", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "update-products.yml"), "utf8");
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /create-pull-request/);
  assert.match(workflow, /base: main/);
  assert.doesNotMatch(workflow, /git push/);
});

test("current raw candidate and publication catalogs have valid JSON and matching copies", () => {
  const root = path.join(__dirname, "..");
  const raw = JSON.parse(fs.readFileSync(path.join(root, "ebay-products.json"), "utf8"));
  const production = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
  const preview = JSON.parse(fs.readFileSync(path.join(root, "public", "products.json"), "utf8"));
  assert.ok(Array.isArray(raw) && raw.length > 0);
  const ids = new Set();
  for (const item of raw) {
    assert.ok(item.id && item.name && item.category);
    assert.ok(!ids.has(String(item.id)), `duplicate candidate id ${item.id}`);
    ids.add(String(item.id));
    assert.equal(item.offers.length, 1);
    const offer = item.offers[0];
    assert.ok(Number.isFinite(Number(offer.price)) && Number(offer.price) > 0);
    assert.ok(safety.ALLOWED_CURRENCIES.has(offer.currency));
    assert.ok(offer.store && /^https?:\/\//i.test(offer.url));
  }
  assert.deepEqual(production, preview);
});

test("updater has no multi-merchant publication threshold", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "update-products.js"), "utf8");
  assert.doesNotMatch(source, /storeProducts\.size\s*<\s*3/);
  assert.match(source, /storeProducts\.size === 0/);
});
