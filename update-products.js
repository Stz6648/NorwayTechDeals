const fs = require("fs");

const EBAY_API = "https://techkjop.no/api/ebay-search";
const FX_API = "https://api.frankfurter.dev/v2/rate/usd/nok";

const products = [
  "RTX 5090",
  "RTX 5080",
  "RTX 5070 Ti",
  "RTX 5070",
  "RTX 5060 Ti",
  "RTX 5060",
  "RX 9070",
  "DDR5 32GB",
  "DDR5 16GB",
  "gaming laptop",
  "gaming pc"
];

async function searchEbay(query) {
  try {
    const response = await fetch(
      `${EBAY_API}?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) return [];

    const data = await response.json();

    return Array.isArray(data) ? data : data.itemSummaries || [];
  } catch (error) {
    console.error("eBay error:", query, error.message);
    return [];
  }
}

async function main() {
  
  const allProducts = [];
  const fxResponse = await fetch(FX_API);
  const fxData = await fxResponse.json();
  const usdToNok = Number(fxData.rate || 0);

  
  for (const query of products) {
    console.log("Searching:", query);

    const items = await searchEbay(query);

    for (const item of items.slice(0, 10)) {
      allProducts.push({
        id: item.itemId || item.id || `${query}-${allProducts.length}`,
        name: item.title || query,
        category: query.toLowerCase().includes("laptop")
          ? "Laptop"
          : query.toLowerCase().includes("pc")
          ? "Gaming PC"
          : query.toLowerCase().includes("ddr")
          ? "RAM"
          : "Graphics Card",
        image: item.image?.imageUrl || "/images/placeholder.jpg",
        description: item.title || query,
        specifications: {},
        offers: [
          {
            store: "eBay",
            country: "NO",
            condition: "New",
            price: Math.round(Number(item.price?.value || 0) * usdToNok),
            currency: item.price?.currency || "USD",
            shipping: null,
            inStock: true,
            affiliate: true,
            affiliateNetwork: "eBay Partner Network",
            url: item.itemWebUrl || "",
            updatedAt: new Date().toISOString().slice(0, 10)
          }
        ],
        lowestPrice: Math.round(Number(item.price?.value || 0) * usdToNok),
        lowestStore: "eBay",
        updatedAt: new Date().toISOString().slice(0, 10)
      });
    }
  }

  const existing = JSON.parse(fs.readFileSync("products.json", "utf8"));

const merged = [
  ...existing.filter(p => !p.offers?.some(o => o.store === "eBay")),
  ...allProducts
];

fs.writeFileSync(
  "products.json",
  JSON.stringify(merged, null, 2)
);

fs.writeFileSync(
  "public/products.json",
  JSON.stringify(merged, null, 2)
);

  console.log(`Saved ${allProducts.length} eBay products.`);
}

main().catch(console.error);
