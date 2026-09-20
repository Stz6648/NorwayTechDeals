const fs = require("fs");
const zlib = require("zlib");

const EBAY_API = "https://techkjop.no/api/ebay-search";
const FX_API = "https://api.frankfurter.dev/v2/rate/usd/nok";

const AWIN_ACER_FEED_URL = process.env.AWIN_ACER_FEED_URL || "";

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

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;

      row.push(value);
      value = "";

      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
    } else {
      value += char;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);

    if (row.some(cell => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h =>
    h.replace(/^\uFEFF/, "").trim().toLowerCase()
  );

  return rows.slice(1).map(values => {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = (values[index] || "").trim();
    });

    return obj;
  });
}

function getField(row, fields) {
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== "") {
      return row[field];
    }
  }

  return "";
}

function parsePrice(value) {
  if (!value) return 0;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function parseStock(value) {
  const v = String(value || "").toLowerCase().trim();

  if (!v) return true;

  return [
    "1",
    "true",
    "yes",
    "y",
    "in stock",
    "instock",
    "available",
    "på lager"
  ].includes(v);
}

function acerCategory(name, category) {
  const text = `${name} ${category}`.toLowerCase();

  if (
    text.includes("laptop") ||
    text.includes("notebook") ||
    text.includes("chromebook")
  ) {
    return "Laptop";
  }

  if (
    text.includes("monitor") ||
    text.includes("display") ||
    text.includes("screen")
  ) {
    return "Monitor";
  }

  if (
    text.includes("desktop") ||
    text.includes("gaming pc") ||
    text.includes("stationary")
  ) {
    return "Gaming PC";
  }

  return "Electronics";
}

async function fetchAcerProducts() {
  if (!AWIN_ACER_FEED_URL) {
    console.log("Acer Awin feed not configured. Skipping Acer.");
    return [];
  }

  try {
    console.log("Downloading Acer Awin product feed...");

    const response = await fetch(AWIN_ACER_FEED_URL);

    if (!response.ok) {
      throw new Error(`Awin HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    let dataBuffer = buffer;

    if (
      buffer.length >= 2 &&
      buffer[0] === 0x1f &&
      buffer[1] === 0x8b
    ) {
      dataBuffer = zlib.gunzipSync(buffer);
    }

    const csvText = dataBuffer.toString("utf8");

    const rows = parseCSV(csvText);

    console.log(`Acer feed rows: ${rows.length}`);

    const result = [];

    for (const row of rows) {
      const id = getField(row, [
        "aw_product_id",
        "merchant_product_id",
        "product_id"
      ]);

      const name = getField(row, [
        "product_name",
        "name",
        "title"
      ]);

      const price = parsePrice(
        getField(row, [
          "search_price",
          "price",
          "store_price"
        ])
      );

      const currency =
        getField(row, ["currency"]) || "NOK";

      const image = getField(row, [
        "merchant_image_url",
        "aw_image_url",
        "large_image",
        "image_url"
      ]);

      const url = getField(row, [
        "aw_deep_link",
        "deep_link",
        "merchant_deep_link",
        "purl"
      ]);

      const brand =
        getField(row, ["brand_name", "brand"]) || "Acer";

      const condition =
        getField(row, ["condition"]) || "New";

      const category = getField(row, [
        "category_name",
        "merchant_category",
        "category"
      ]);

      const model = getField(row, [
        "model_number",
        "product_model",
        "mpn"
      ]);

      const description =
        getField(row, [
          "description",
          "product_short_description"
        ]) || name;

      const shipping = parsePrice(
        getField(row, [
          "delivery_cost",
          "delcost"
        ])
      );

      const inStock = parseStock(
        getField(row, [
          "in_stock",
          "instock",
          "stock_status"
        ])
      );

      if (!id || !name || price <= 0) {
        continue;
      }

      result.push({
        id: `acer-${id}`,
        brand: brand,
        name: name,
        model: model,
        category: acerCategory(name, category),
        subcategory: category || "Acer",
        condition: condition,
        image: image || "/images/placeholder.jpg",
        description: description,
        specifications: {},
        offers: [
          {
            store: "Acer",
            country: "NO",
            condition: condition,
            price: price,
            currency: currency,
            shipping: shipping,
            inStock: inStock,
            affiliate: true,
            affiliateNetwork: "Awin",
            url: url,
            updatedAt: new Date().toISOString().slice(0, 10)
          }
        ],
        lowestPrice: price,
        lowestStore: "Acer",
        updatedAt: new Date().toISOString().slice(0, 10)
      });
    }

    console.log(`Acer products imported: ${result.length}`);

    return result;
  } catch (error) {
    console.error("Acer Awin feed error:", error.message);
    return [];
  }
}

async function main() {
  const allProducts = [];

  /*
   * =========================
   * eBay
   * =========================
   */

  const fxResponse = await fetch(FX_API);
  const fxData = await fxResponse.json();
  const usdToNok = Number(fxData.rate || 0);

  for (const query of products) {
    console.log("Searching:", query);

    const items = await searchEbay(query);

    for (const item of items.slice(0, 10)) {
      const priceNok = Math.round(
        Number(item.price?.value || 0) * usdToNok
      );

      allProducts.push({
        id:
          item.itemId ||
          item.id ||
          `${query}-${allProducts.length}`,

        name: item.title || query,

        category: query.toLowerCase().includes("laptop")
          ? "Laptop"
          : query.toLowerCase().includes("pc")
          ? "Gaming PC"
          : query.toLowerCase().includes("ddr")
          ? "RAM"
          : "Graphics Card",

        image:
          item.image?.imageUrl ||
          "/images/placeholder.jpg",

        description: item.title || query,

        specifications: {},

        offers: [
          {
            store: "eBay",
            country: "NO",
            condition: "New",
            price: priceNok,
            currency: "NOK",
            shipping: null,
            inStock: true,
            affiliate: true,
            affiliateNetwork: "eBay Partner Network",
            url: item.itemWebUrl || "",
            updatedAt: new Date().toISOString().slice(0, 10)
          }
        ],

        lowestPrice: priceNok,
        lowestStore: "eBay",
        updatedAt: new Date().toISOString().slice(0, 10)
      });
    }
  }

  /*
   * =========================
   * Acer / Awin
   * =========================
   */

  const acerProducts = await fetchAcerProducts();

  /*
   * =========================
   * Existing products
   * =========================
   */

  const existing = JSON.parse(
    fs.readFileSync("products.json", "utf8")
  );

  /*
   * Remove only old standalone eBay products
   * and old Acer products.
   *
   * Other existing merchants are preserved.
   */

  const preserved = existing.filter(product => {
    const offers = product.offers || [];

    const isOldEbay =
      offers.length > 0 &&
      offers.every(offer => offer.store === "eBay");

    const isOldAcer =
      product.id?.startsWith("acer-") ||
      (
        offers.length > 0 &&
        offers.every(offer => offer.store === "Acer")
      );

    return !isOldEbay && !isOldAcer;
  });

  const merged = [
    ...preserved,
    ...allProducts,
    ...acerProducts
  ];

  fs.writeFileSync(
    "products.json",
    JSON.stringify(merged, null, 2)
  );

  fs.writeFileSync(
    "public/products.json",
    JSON.stringify(merged, null, 2)
  );

  console.log(
    `Saved ${allProducts.length} eBay products + ${acerProducts.length} Acer products.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
