const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const historyPath = path.join(root, "price-history.json");
const existing = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, "utf8"))
  : [];
if (!Array.isArray(products) || !Array.isArray(existing)) {
  throw new Error("Price-history input files must contain JSON arrays.");
}

const now = Date.now();
const freshnessWindowMs = 36 * 60 * 60 * 1000;
const observations = new Map();

for (const product of products) {
  for (const offer of (Array.isArray(product.offers) ? product.offers : [])) {
    if (offer.affiliate !== true || !offer.url || Number(offer.price) <= 0) continue;
    const updatedAt = Date.parse(offer.updatedAt || "");
    if (!Number.isFinite(updatedAt) || now - updatedAt > freshnessWindowMs || updatedAt > now + 5 * 60 * 1000) continue;

    const merchant = String(offer.store || "").trim();
    const currency = String(offer.currency || "").toUpperCase();
    const condition = String(offer.condition || "unknown");
    if (!merchant || !currency) continue;

    const day = new Date(updatedAt).toISOString().slice(0, 10);
    const key = [product.id, merchant.toLowerCase(), currency, condition.toLowerCase()].join("|");
    observations.set(key, {
      key,
      productId: String(product.id),
      productName: String(product.name || ""),
      category: String(product.category || ""),
      merchant,
      currency,
      price: Number(offer.price),
      priceNok: Number.isFinite(Number(offer.priceNok)) ? Number(offer.priceNok) : (currency === "NOK" ? Number(offer.price) : null),
      condition,
      date: day,
      sourceUpdatedAt: new Date(updatedAt).toISOString()
    });
  }
}

const byKeyAndDay = new Map();
for (const row of existing) {
  if (!row || !row.key || !row.date) continue;
  byKeyAndDay.set(row.key + "|" + row.date, row);
}
for (const row of observations.values()) {
  byKeyAndDay.set(row.key + "|" + row.date, row);
}

const cutoff = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const next = [...byKeyAndDay.values()]
  .filter(row => row.date >= cutoff)
  .sort((a, b) => a.key.localeCompare(b.key) || a.date.localeCompare(b.date));

const serialized = JSON.stringify(next, null, 2) + "\n";
fs.writeFileSync(historyPath, serialized, "utf8");
fs.writeFileSync(path.join(root, "public", "price-history.json"), serialized, "utf8");

console.log("Fresh verified price observations:", observations.size);
console.log("Retained 365-day observations:", next.length);
if (!observations.size) console.log("No fresh source prices found; stale listings were not recorded as new observations.");
