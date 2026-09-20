const fs = require("fs");
const zlib = require("zlib");

const EBAY_API = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const FX_API = "https://open.er-api.com/v6/latest/USD";
const AWIN_ACER_FEED_URL = process.env.AWIN_ACER_FEED_URL || "";

const products = [
  "RTX 5070",
  "RTX 5060",
  "RTX 5090",
  "RTX 5080",
  "gaming laptop",
  "gaming pc",
  "laptop",
  "mini pc",
  "desktop pc",
  "RAM DDR5",
  "SSD 1TB"
];

async function searchEbay(query, accessToken, usdToNok) {
  try {
    const url =
      `${EBAY_API}?q=${encodeURIComponent(query)}` +
      `&limit=10&filter=buyingOptions%3D%7BFIXED_PRICE%7D`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.log(`eBay search failed for ${query}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.itemSummaries || []).map(item => {
      const usd = Number(item.price?.value || 0);

      return {
        id: `ebay-${item.itemId}`,
        name: item.title || query,
        price: usd,
        currency: "USD",
        priceNOK: usdToNok
          ? Math.round(usd * usdToNok)
          : null,
        image:
          item.image?.imageUrl ||
          item.thumbnailImages?.[0]?.imageUrl ||
          "",
        url: item.itemWebUrl || "",
        store: "eBay",
        affiliateNetwork: "eBay Partner Network",
        condition: item.condition || "New",
        category: query,
        country: "US",
        updatedAt: new Date().toISOString()
      };
    });
  } catch (error) {
    console.log(`eBay error for ${query}:`, error.message);
    return [];
  }
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const candidates = [",", ";", "|", "\t"];

  let bestDelimiter = ",";
  let bestCount = -1;

  for (const delimiter of candidates) {
    let count = 0;
    let insideQuotes = false;

    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];

      if (char === '"') {
        if (insideQuotes && firstLine[i + 1] === '"') {
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        count++;
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCSV(text) {
  const delimiter = detectDelimiter(text);

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
    } else if (char === delimiter && !insideQuotes) {
      row.push(value);
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

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

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(header =>
    header
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  );

  return rows.slice(1).map(values => {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = (values[index] || "").trim();
    });

    return obj;
  });
}

function parsePrice(value) {
  if (!value) {
    return 0;
  }

  let text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!text) {
    return 0;
  }

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    const parts = text.split(",");
    const lastPart = parts[parts.length - 1];

    if (lastPart.length === 2) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function parseStock(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  const text = String(value).trim().toLowerCase();

  if (
    [
      "0",
      "false",
      "no",
      "out of stock",
      "outofstock",
      "ikke på lager"
    ].includes(text)
  ) {
    return false;
  }

  return true;
}

function getCategory(name, category) {
  const text =
    `${name || ""} ${category || ""}`.toLowerCase();

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
    console.log("AWIN_ACER_FEED_URL is not set.");
    return [];
  }

  try {
    console.log("Downloading Acer Awin product feed...");

    const infoResponse = await fetch(AWIN_ACER_FEED_URL);

    if (!infoResponse.ok) {
      console.log(`Acer feed info failed: ${infoResponse.status}`);
      return [];
    }

    const metadataText = await infoResponse.text();
    const metadataRows = parseCSV(metadataText);
    const feedInfo = metadataRows[0] || {};

    console.log("Awin feed info:", JSON.stringify(feedInfo));

    const feedUrl = feedInfo.url;

    if (!feedUrl) {
      console.log("Acer feed URL not found.");
      return [];
    }

    console.log("Downloading actual Acer product file...");

    const response = await fetch(feedUrl);

    if (!response.ok) {
      console.log(`Acer product file failed: ${response.status}`);
      return [];
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    let text;

    if (
      buffer.length >= 2 &&
      buffer[0] === 0x1f &&
      buffer[1] === 0x8b
    ) {
      text = zlib.gunzipSync(buffer).toString("utf8");
    } else {
      text = buffer.toString("utf8");
    }

    const rows = parseCSV(text);

    console.log(`Acer product rows: ${rows.length}`);

    const acerProducts = [];

    for (const row of rows) {
      const id =
        row.aw_product_id ||
        row.merchant_product_id ||
        row.product_id ||
        "";

      const name =
        row.product_name ||
        row.name ||
        row.title ||
        "";

      const price = parsePrice(
        row.search_price ||
        row.price ||
        row.product_price ||
        ""
      );

      if (!id || !name || price <= 0) {
        continue;
      }

      const currency = (
        row.currency || "NOK"
      ).toUpperCase();

      if (currency !== "NOK") {
        continue;
      }

      acerProducts.push({
        id: `acer-${id}`,
        name,
        description: row.description || "",
        brand: row.brand_name || "Acer",
        price,
        currency: "NOK",
        priceNOK: Math.round(price),
        image:
          row.merchant_image_url ||
          row.image_url ||
          row.image ||
          "",
        url:
          row.aw_deep_link ||
          row.deep_link ||
          row.product_url ||
          row.url ||
          "",
        store: "Acer",
        affiliateNetwork: "Awin",
        category: getCategory(
          name,
          row.merchant_category ||
          row.category_name ||
          ""
        ),
        condition: row.condition || "New",
        country: "NO",
        inStock: parseStock(
          row.in_stock ||
          row.stock ||
          row.availability ||
          ""
        ),
        updatedAt: new Date().toISOString()
      });
    }

    console.log(
      `Acer products imported: ${acerProducts.length}`
    );

    return acerProducts;

  } catch (error) {
    console.log(
      "Acer feed error:",
      error.message
    );

    return [];
  }
}
async function getEbayAccessToken() {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log("eBay credentials are missing.");
    return "";
  }

  try {
    const credentials = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body:
          "grant_type=client_credentials" +
          "&scope=https://api.ebay.com/oauth/api_scope"
      }
    );

    if (!response.ok) {
      console.log(
        `eBay token failed: ${response.status}`
      );
      return "";
    }

    const data = await response.json();

    return data.access_token || "";
  } catch (error) {
    console.log(
      "eBay token error:",
      error.message
    );

    return "";
  }
}

async function getUsdToNok() {
  try {
    const response = await fetch(FX_API);

    if (!response.ok) {
      return 9.3;
    }

    const data = await response.json();

    const rate = Number(
      data?.rates?.NOK
    );

    if (Number.isFinite(rate) && rate > 0) {
      return rate;
    }

    return 9.3;
  } catch (error) {
    console.log(
      "FX error:",
      error.message
    );

    return 9.3;
  }
}

async function main() {
  let existingProducts = [];

  if (fs.existsSync("products.json")) {
    try {
      existingProducts = JSON.parse(
        fs.readFileSync(
          "products.json",
          "utf8"
        )
      );
    } catch (error) {
      console.log(
        "Could not read existing products.json:",
        error.message
      );
      existingProducts = [];
    }
  }

  const accessToken =
    await getEbayAccessToken();

  const usdToNok =
    await getUsdToNok();

  let ebayProducts = [];

  if (accessToken) {
    for (const query of products) {
      console.log(`Searching eBay: ${query}`);

      const results =
        await searchEbay(
          query,
          accessToken,
          usdToNok
        );

      ebayProducts.push(...results);
    }
  }

  const acerProducts =
    await fetchAcerProducts();

  const preservedProducts =
    existingProducts.filter(product => {
      const id = String(
        product.id || ""
      );

      const offers =
        Array.isArray(product.offers)
          ? product.offers
          : [];

      const isOldEbay =
        offers.length > 0 &&
        offers.every(
          offer =>
            offer.store === "eBay"
        );

      const isOldAcer =
        id.startsWith("acer-") ||
        (
          offers.length > 0 &&
          offers.every(
            offer =>
              offer.store === "Acer"
          )
        );

      return !isOldEbay && !isOldAcer;
    });

  const allProducts = [
    ...preservedProducts,
    ...ebayProducts,
    ...acerProducts
  ];

  fs.writeFileSync(
    "products.json",
    JSON.stringify(
      allProducts,
      null,
      2
    )
  );

  fs.mkdirSync(
    "public",
    { recursive: true }
  );

  fs.writeFileSync(
    "public/products.json",
    JSON.stringify(
      allProducts,
      null,
      2
    )
  );

  console.log(
    `Saved ${ebayProducts.length} eBay products + ${acerProducts.length} Acer products.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
