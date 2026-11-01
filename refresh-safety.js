const fs = require("node:fs");
const path = require("node:path");

const MINIMUM_PUBLIC_PRODUCTS = 25;
const ALLOWED_CURRENCIES = new Set(["NOK", "USD", "EUR", "GBP", "SEK", "DKK", "CHF", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "CAD", "AUD", "NZD", "JPY", "SGD", "HKD", "INR", "AED", "ILS", "MXN"]);
const HIDDEN_LISTING_IDS = new Set([
  "840050139607", "227585874712", "198666805311", "800855864419", "920077901404",
  "880069574037", "287634527566", "287687470283", "287646043891", "287690345402",
  "407293066006", "377610331404", "366541111459", "800776599589", "820265313346",
  "117017547855", "117017531751", "387417004433", "168447817086", "256547414823",
  "397778323821", "326450627371"
]);
const PRICE_PROTECTED_LISTING_IDS = new Set([
  "136935928205", "136742542564", "257075445486", "267490948937", "237032671767",
  "117017547855", "840050139607", "117017531751", "366752733300", "227585874712",
  "225673429029", "206262000670", "198666805311", "168447817086", "125169508834",
  "800855864419", "387417004433", "920077901404", "880069574037", "800155738638",
  "287634527566", "287687470283", "287646043891", "287690345402", "407293066006",
  "365518306157", "377610331404", "366541111459", "366502160328", "366502165796",
  "800776599589", "256547414823", "820265313346", "397778323821", "326450627371"
]);
const CATEGORIES = ["Gaming PC", "Gaming Laptop", "Graphics Card", "CPU", "RAM", "SSD", "Monitor"];

function listingId(offer) {
  if (offer?.itemId) return String(offer.itemId);
  const match = String(offer?.url || "").match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i);
  return match?.[1] || "";
}

function validateCatalog(products, { minimum = MINIMUM_PUBLIC_PRODUCTS } = {}) {
  if (!Array.isArray(products)) throw new Error("Catalog must be a JSON array");
  if (products.length === 0) throw new Error("Refusing to publish an empty catalog");
  if (products.length < minimum) throw new Error(`Catalog has ${products.length} products; minimum is ${minimum}`);
  const ids = new Set();
  for (const [index, product] of products.entries()) {
    if (!product || typeof product !== "object" || !String(product.id || "").trim()) throw new Error(`Product ${index} has no id`);
    if (ids.has(String(product.id))) throw new Error(`Duplicate product id: ${product.id}`);
    ids.add(String(product.id));
    if (!String(product.name || "").trim() || !CATEGORIES.includes(String(product.category || "").trim())) throw new Error(`Product ${product.id} has an unsupported category`);
    const offers = Array.isArray(product.offers) ? product.offers : [product];
    if (!offers.length) throw new Error(`Product ${product.id} has no offers`);
    for (const offer of offers) {
      const id = listingId(offer);
      const protectedPrice = PRICE_PROTECTED_LISTING_IDS.has(id);
      const price = Number(offer?.price);
      if (!protectedPrice && (!Number.isFinite(price) || price <= 0)) throw new Error(`Product ${product.id} has invalid price`);
      if (!protectedPrice && !ALLOWED_CURRENCIES.has(String(offer.currency || "").toUpperCase())) throw new Error(`Product ${product.id} has invalid currency`);
      if (!String(offer.store || product.store || "").trim()) throw new Error(`Product ${product.id} has no merchant`);
      if (!/^https?:\/\//i.test(String(offer.url || ""))) throw new Error(`Product ${product.id} has invalid URL`);
    }
  }
  return true;
}

function filterProtectedListings(products) {
  return products.filter(product => {
    const offers = Array.isArray(product.offers) ? product.offers : [product];
    return !offers.some(offer => HIDDEN_LISTING_IDS.has(listingId(offer)));
  }).map(product => {
    const clone = structuredClone(product);
    const offers = Array.isArray(clone.offers) ? clone.offers : [clone];
    let protectedPriceFound = false;
    for (const offer of offers) {
      if (PRICE_PROTECTED_LISTING_IDS.has(listingId(offer))) {
        protectedPriceFound = true;
        delete offer.price;
        delete offer.currency;
        delete offer.priceVerified;
        delete offer.verified;
      }
    }
    if (protectedPriceFound) {
      for (const key of ["price", "lowestPrice", "lowestCurrency", "originalPrice", "originalCurrency", "priceVerified", "priceStatus"]) delete clone[key];
    }
    return clone;
  });
}

function atomicWriteJSON(file, value) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    JSON.parse(fs.readFileSync(temp, "utf8"));
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.rmSync(temp, { force: true }); } catch {}
    throw error;
  }
}

function diffCatalog(before, after) {
  const oldMap = new Map((Array.isArray(before) ? before : []).map(p => [String(p.id), p]));
  const newMap = new Map(after.map(p => [String(p.id), p]));
  const added = [...newMap.keys()].filter(id => !oldMap.has(id));
  const removed = [...oldMap.keys()].filter(id => !newMap.has(id));
  const updated = [...newMap.keys()].filter(id => oldMap.has(id) && JSON.stringify(oldMap.get(id)) !== JSON.stringify(newMap.get(id)));
  return { before: oldMap.size, after: newMap.size, added, updated, removed };
}

function acquireLock(lockFile) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  let fd;
  try { fd = fs.openSync(lockFile, "wx"); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("Another product update is already running");
    throw error;
  }
  fs.writeSync(fd, `${process.pid}\n`);
  return () => { try { fs.closeSync(fd); } finally { fs.rmSync(lockFile, { force: true }); } };
}

module.exports = { MINIMUM_PUBLIC_PRODUCTS, ALLOWED_CURRENCIES, HIDDEN_LISTING_IDS, PRICE_PROTECTED_LISTING_IDS, CATEGORIES, listingId, validateCatalog, filterProtectedListings, atomicWriteJSON, diffCatalog, acquireLock };
