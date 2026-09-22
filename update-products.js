const fs = require("fs");
const zlib = require("zlib");
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || "";
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || "";
const EBAY_CAMPAIGN_ID = process.env.EBAY_CAMPAIGN_ID || "5339206505";

async function fetchEbayProducts() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    console.log("eBay credentials missing - skip eBay update");
    return [];
  }

  const credentials = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const tokenResponse = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body:
        "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope"
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error(
      `eBay OAuth failed: ${JSON.stringify(tokenData)}`
    );
  }

  const queries = [
    "RTX 5090",
    "RTX 5080",
    "RTX 5070 Ti",
    "RTX 5070",
    "Gaming PC",
    "Gaming Laptop",
    "Laptop",
    "Intel Core i7",
    "AMD Ryzen 7",
    "DDR5 RAM",
    "NVMe SSD",
    "Gaming Monitor"
  ];

  const allProducts = [];

  const ebayCategoryMap = {
    "RTX 5090": "Graphics Card",
    "RTX 5080": "Graphics Card",
    "RTX 5070 Ti": "Graphics Card",
    "RTX 5070": "Graphics Card",
    "Gaming PC": "Gaming PC",
    "Gaming Laptop": "Gaming Laptop",
    "Laptop": "Laptop",
    "Intel Core i7": "CPU",
    "AMD Ryzen 7": "CPU",
    "DDR5 RAM": "RAM",
    "NVMe SSD": "SSD",
    "Gaming Monitor": "Monitor"
  };

  for (const q of queries) {

    try {
      const url =
        "https://api.ebay.com/buy/browse/v1/item_summary/search?" +
        new URLSearchParams({
          q,
          limit: "50"
        });

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
          "X-EBAY-C-ENDUSERCTX":
            `affiliateCampaignId=${EBAY_CAMPAIGN_ID}`,
          "Accept-Language": "en-US"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(`eBay search failed: ${q}`);
        continue;
      }

      for (const item of data.itemSummaries || []) {
        if (!item.itemId || !item.title) continue;

        const price = Number(item.price?.value || 0);

        if (price <= 0) continue;

        allProducts.push({
          id: item.itemId,
          name: item.title,
          category: ebayCategoryMap[q] || "eBay",
          image:
            item.image?.imageUrl ||
            "",
          description:
            item.shortDescription ||
            item.title,
          specifications: {},
          offers: [
            {
              store: "eBay",
              country: "NO",
              condition:
                item.condition || "New",
              price,
              currency:
                item.price?.currency ||
                "USD",
              shipping:
                item.shippingOptions?.[0]
                  ?.shippingCost?.value || null,
              inStock: true,
              affiliate: true,
              affiliateNetwork:
                "eBay Partner Network",
              url:
                item.itemWebUrl ||
                `https://www.ebay.com/itm/${item.itemId}`,
              updatedAt:
                new Date().toISOString().slice(0, 10)
            }
          ],
          lowestPrice: price,
          lowestStore: "eBay",
          updatedAt:
            new Date().toISOString().slice(0, 10)
        });
      }

      console.log(
        `eBay "${q}": ${data.itemSummaries?.length || 0} products`
      );
    } catch (error) {
      console.log(
        `eBay query error "${q}": ${error.message}`
      );
    }
  }

  const unique = Array.from(
    new Map(
      allProducts.map(product => [
        product.id,
        product
      ])
    ).values()
  );

  console.log(
    `eBay products fetched: ${unique.length}`
  );

  return unique;
}
const AWIN_ACER_FEED_URL = process.env.AWIN_ACER_FEED_URL || "";

function parseCSV(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";

  const candidates = [",", ";", "|", "\t"];

  function countDelimiter(line, delimiter) {
    let count = 0;
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];

      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (c === delimiter && !quoted) {
        count++;
      }
    }

    return count;
  }

  let delimiter = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = countDelimiter(firstLine, candidate);

    if (count > bestCount) {
      bestCount = count;
      delimiter = candidate;
    }
  }

  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && quoted && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if (c === delimiter && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") {
        i++;
      }

      row.push(value);
      value = "";

      if (row.some(v => v.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    value += c;
  }

  if (value !== "" || row.length > 0) {
    row.push(value);

    if (row.some(v => v.trim() !== "")) {
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
  if (!value) return 0;

  let s = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!s) return 0;

  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");

    if (parts[parts.length - 1].length === 2) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const number = Number(s);

  return Number.isFinite(number) ? number : 0;
}

function getCategory(row) {
  const text = (
    (row.product_type || "") +
    " " +
    (row.google_product_category || "") +
    " " +
    (row.title || "")
  ).toLowerCase();

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

  if (
    text.includes("graphics card") ||
    text.includes("gpu")
  ) {
    return "Graphics Card";
  }

  return "Electronics";
}

function getAvailability(value) {
  const text = String(value || "").toLowerCase().trim();

  if (!text) return true;

  if (
    text === "out_of_stock" ||
    text === "out of stock" ||
    text === "false" ||
    text === "0" ||
    text.includes("not available")
  ) {
    return false;
  }

  return true;
}

async function fetchAcerProducts() {
  if (!AWIN_ACER_FEED_URL) {
    console.log("AWIN_ACER_FEED_URL is not set.");
    return [];
  }

  try {
    console.log("Downloading Acer Awin product feed...");

    const response = await fetch(AWIN_ACER_FEED_URL);

    if (!response.ok) {
      console.log(
        `Acer feed download failed: ${response.status} ${response.statusText}`
      );

      return [];
    }

    const buffer = Buffer.from(await response.arrayBuffer());

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

    if (!rows.length) {
      console.log("No Acer products found.");
      return [];
    }

    console.log(
      "Acer columns:",
      Object.keys(rows[0])
    );

    console.log(
      "Acer sample:",
      JSON.stringify(rows[0]).slice(0, 3000)
    );

    const acerProducts = [];

    for (const row of rows) {
      const id =
        row.id ||
        row.aw_product_id ||
        row.merchant_product_id ||
        row.gtin ||
        row.mpn;

      const title =
        row.title ||
        row.product_name ||
        row.name;

      const link =
        row.aw_deep_link ||
        row.link ||
        row.url;

      const image =
        row.image_link ||
        row.merchant_image_url ||
        row.image;

      const price =
        parsePrice(row.sale_price) ||
        parsePrice(row.display_price) ||
        parsePrice(row.store_price) ||
        parsePrice(row.search_price) ||
        parsePrice(row.price);

      if (!id || !title || !link || price <= 0) {
        continue;
      }

      const currency =
        (row.currency || "NOK").toUpperCase();

      if (currency !== "NOK") {
        continue;
      }

      acerProducts.push({
        id: `acer-${id}`,
        name: title,
        description:
          row.description ||
          row.product_detail ||
          row.product_highlight ||
          "",

        category: getCategory(row),

        brand:
          row.brand ||
          "Acer",

        image: image || "",

        price: price,

        currency: "NOK",

        url: link,

        store: "Acer",

        affiliateNetwork: "Awin",

        country: "NO",

        condition:
          row.condition ||
          "new",

        inStock:
          getAvailability(row.availability),

        gtin:
          row.gtin || "",

        mpn:
          row.mpn || "",

        updatedAt:
          new Date().toISOString()
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

async function main() {
  const files = [
    "products.json",
    "public/products.json"
  ];

  let existing = [];

  try {
    existing = JSON.parse(
      fs.readFileSync("products.json", "utf8")
    );
  } catch (error) {
    console.log(
      "Could not read products.json:",
      error.message
    );

    existing = [];
  }

  if (!Array.isArray(existing)) {
    existing = [];
  }

 const acerProducts = await fetchAcerProducts();
 const ebayProducts = await fetchEbayProducts();

  /*
   * 保留所有现有产品。
   * 只删除旧的 Acer 产品，然后加入最新 Acer 数据。
   */
  const preserved = existing.filter(product => {
    if (!product) return false;

    const id = String(product.id || "").toLowerCase();

    const store = String(
      product.store || ""
    ).toLowerCase();

    const offers = Array.isArray(product.offers)
      ? product.offers
      : [];

    const isAcer =
      id.startsWith("acer-") ||
      store === "acer" ||
      offers.some(
        offer =>
          String(
            offer.store || ""
          ).toLowerCase() === "acer"
      );
    

    const isEbay =
      store === "ebay" ||
      offers.some(
        offer =>
          String(
            offer.store || ""
          ).toLowerCase() === "ebay"
      );

    return !isAcer && !isEbay;
  });
    

  const finalProducts = preserved.concat(
    acerProducts,
    ebayProducts
  );
  const ebayFile = "ebay-products.json";

  if (ebayProducts.length > 0) {
    fs.writeFileSync(
      ebayFile,
      JSON.stringify(ebayProducts, null, 2),
      "utf8"
  );

  console.log(
    `eBay products saved: ${ebayProducts.length}`
  );
} else {
  console.log(
    "No new eBay products - existing ebay-products.json preserved"
  );
}
  fs.writeFileSync(
    "products.json",
    JSON.stringify(
      finalProducts,
      null,
      2
    ),
    "utf8"
  );

  fs.writeFileSync(
    "public/products.json",
    JSON.stringify(
      finalProducts,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Existing products preserved: ${preserved.length}`
  );

  console.log(
    `Acer products added: ${acerProducts.length}`
  );

  console.log(
    `Total products saved: ${finalProducts.length}`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
