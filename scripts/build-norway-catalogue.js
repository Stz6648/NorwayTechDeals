// Builds data/norway-catalogue.json from the raw merchant feed snapshot.
// Safe by design: reads products_merged_proshop.json, never touches products.json,
// writes to a temp file first and only replaces the output if all checks pass.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "products_merged_proshop.json");
const outPath = path.join(root, "data", "norway-catalogue.json");
const reportPath = path.join(root, "data", "norway-catalogue-report.json");
const merchants = JSON.parse(fs.readFileSync(path.join(root, "data", "merchants.json"), "utf8"));

// Consumer price ceilings (NOK). Anything above is treated as enterprise/workstation or a feed error.
const MAX_PRICE = {
  "Graphics Card": 45000, CPU: 15000, RAM: 12000, SSD: 12000, Motherboard: 15000,
  Laptop: 70000, "Gaming Laptop": 70000, "Gaming PC": 90000, Monitor: 30000,
  "PC Components": 20000, Electronics: 70000
};
const ENTERPRISE = /\b(registered|rdimm|lrdimm|ecc|xeon|epyc|threadripper pro|quadro|rtx pro|rtx a\d|tesla|instinct|firepro|server|workstation|smartmemory|proliant|powervault)\b/i;

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(raw) || raw.length < 1000) throw new Error("Feed snapshot missing or too small; refusing to build.");

const rejects = {};
const reject = (why) => { rejects[why] = (rejects[why] || 0) + 1; };
const seen = new Set();
const kept = [];

for (const x of raw) {
  if (Array.isArray(x.offers)) { reject("legacy nested placeholder entry"); continue; }
  const m = merchants[x.store];
  if (!m) { reject("unknown merchant"); continue; }
  if (String(x.currency).toUpperCase() !== "NOK") { reject("not NOK"); continue; }
  const price = Number(x.price);
  if (!(price > 0)) { reject("no positive price"); continue; }
  if (!x.url || !/^https:\/\//.test(x.url)) { reject("missing link"); continue; }
  const tracked = /partner-ads\.com|awin1\.com|adtraction\.com|adtr\.co/i.test(x.url);
  if (!tracked) { reject("link not affiliate-tracked"); continue; }
  if (x.inStock !== true) { reject("not confirmed in stock"); continue; }
  if (String(x.condition).toLowerCase() !== "new") { reject("not new"); continue; }
  if (!x.updatedAt) { reject("no updatedAt"); continue; }
  const cap = MAX_PRICE[x.category];
  if (!cap) { reject("category not in scope"); continue; }
  if (price > cap) { reject("price above consumer ceiling"); continue; }
  if (ENTERPRISE.test(x.name || "")) { reject("enterprise/server product"); continue; }
  const key = x.gtin ? "g:" + x.gtin + "|" + x.store : "i:" + x.id;
  if (seen.has(key)) { reject("duplicate"); continue; }
  seen.add(key);
  kept.push({
    id: x.id, name: x.name, brand: x.brand || "", category: x.category,
    gtin: x.gtin || "", mpn: x.mpn || "", image: x.image || "",
    store: x.store, network: x.affiliateNetwork, merchantStatus: m.status,
    price, currency: "NOK", url: x.url, updatedAt: x.updatedAt
  });
}

if (kept.length < 500) throw new Error("Only " + kept.length + " products survived filtering; refusing to write.");

const byCat = {}, byStore = {};
for (const k of kept) { byCat[k.category] = (byCat[k.category] || 0) + 1; byStore[k.store] = (byStore[k.store] || 0) + 1; }
const newest = kept.map(k => k.updatedAt).sort().at(-1);
const report = { input: raw.length, kept: kept.length, rejects, byCategory: byCat, byStore, newestFeedTimestamp: newest,
  ageDays: Math.round((Date.now() - Date.parse(newest)) / 864e5) };

fs.writeFileSync(outPath + ".tmp", JSON.stringify(kept) + "\n");
fs.renameSync(outPath + ".tmp", outPath);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
