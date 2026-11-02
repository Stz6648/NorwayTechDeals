const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const primary = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const publicCopy = JSON.parse(fs.readFileSync(path.join(root, "public", "products.json"), "utf8"));

const allowedCategories = new Set([
  "Graphics Cards", "Gaming PCs", "Desktop PCs", "Laptops",
  "Processors", "Memory", "Storage", "Monitors"
]);
const minimumProducts = 300;
const errors = [];
const counts = {};
const ids = new Set();

if (!Array.isArray(primary) || !Array.isArray(publicCopy)) {
  throw new Error("Both catalogue files must contain JSON arrays.");
}
if (primary.length < minimumProducts) errors.push(`Catalogue has only ${primary.length} products; minimum is ${minimumProducts}.`);
if (JSON.stringify(primary) !== JSON.stringify(publicCopy)) errors.push("products.json and public/products.json are not identical.");

for (const [index, product] of primary.entries()) {
  const label = `products.json[${index}]`;
  if (!product || typeof product !== "object") { errors.push(`${label} is not an object.`); continue; }
  if (!product.id || ids.has(product.id)) errors.push(`${label} has a missing or duplicate id.`);
  ids.add(product.id);
  if (!allowedCategories.has(product.category)) errors.push(`${label} has invalid category: ${product.category}.`);
  counts[product.category] = (counts[product.category] || 0) + 1;
  if (!/^https:\/\//.test(product.image || "")) errors.push(`${label} has no valid HTTPS image URL.`);
  if (product.marketplace !== "eBay US" || product.sourceMarket !== "EBAY_US") errors.push(`${label} is missing explicit source-market metadata.`);
  if (product.shippingToNorwayVerified !== false) errors.push(`${label} must not claim unverified Norway shipping.`);
  if (typeof product.priceReview !== "boolean") errors.push(`${label} must have a boolean priceReview flag.`);
  const validOffer = (product.offers || []).some(offer =>
    offer && offer.affiliate === true &&
    typeof offer.url === "string" &&
    offer.url.includes("campid=") &&
    Number(offer.price) > 0 &&
    typeof offer.currency === "string"
  );
  if (!validOffer) errors.push(`${label} has no valid affiliate offer with a campaign tracking parameter.`);
}
if (counts.Other) errors.push("Unclassified products are not allowed.");

if (errors.length) {
  console.error("Catalogue validation failed:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Catalogue validation passed.");
console.log(`Products: ${primary.length}`);
console.log("Categories:", counts);
console.log("Product copies: identical");
