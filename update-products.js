const fs = require("fs");

const EBAY_API = "https://techkjop.no/api/ebay-search";

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
        image:
          item.image ||
          item.imageUrl ||
          "/images/placeholder.jpg",
        description: item.title || query,
        specifications: {},
        offers: [
          {
            store: "eBay",
            country: "NO",
            condition: "New",
            price: Number(item.price || 0),
            currency: "NOK",
            shipping: null,
            inStock: true,
            affiliate: true,
            affiliateNetwork: "eBay Partner Network",
            url: item.url || item.itemWebUrl || "",
            updatedAt: new Date().toISOString().slice(0, 10)
          }
        ],
        lowestPrice: Number(item.price || 0),
        lowestStore: "eBay",
        updatedAt: new Date().toISOString().slice(0, 10)
      });
    }
  }

  fs.writeFileSync(
    "ebay-products.json",
    JSON.stringify(allProducts, null, 2)
  );

  console.log(`Saved ${allProducts.length} eBay products.`);
}

main().catch(console.error);
