const fs = require("fs");
const zlib = require("zlib");

const EBAY_CLIENT_ID =
  process.env.EBAY_CLIENT_ID || "";

const EBAY_CLIENT_SECRET =
  process.env.EBAY_CLIENT_SECRET || "";

const EBAY_CAMPAIGN_ID =
  process.env.EBAY_CAMPAIGN_ID || "5339206505";


/* =========================================================
   eBay Products
   ========================================================= */

async function fetchEbayProducts() {

  if (
    !EBAY_CLIENT_ID ||
    !EBAY_CLIENT_SECRET
  ) {
    console.log(
      "eBay credentials missing - skip eBay update"
    );

    return [];
  }

  const credentials =
    Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");


  const tokenResponse =
    await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope"
      }
    );


  const tokenData =
    await tokenResponse.json();


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

    "RTX 5090":
      "Graphics Card",

    "RTX 5080":
      "Graphics Card",

    "RTX 5070 Ti":
      "Graphics Card",

    "RTX 5070":
      "Graphics Card",

    "Gaming PC":
      "Gaming PC",

    "Gaming Laptop":
      "Gaming Laptop",

    "Laptop":
      "Laptop",

    "Intel Core i7":
      "CPU",

    "AMD Ryzen 7":
      "CPU",

    "DDR5 RAM":
      "RAM",

    "NVMe SSD":
      "SSD",

    "Gaming Monitor":
      "Monitor"
  };


  /*
   * USD → NOK
   *
   * This is only used for the
   * product-level lowestPrice.
   *
   * The original eBay offer price
   * remains USD.
   */
  let usdToNok = 9.44;


  try {

    const rateResponse =
      await fetch(
        "https://open.er-api.com/v6/latest/USD"
      );

    const rateData =
      await rateResponse.json();

    const liveRate =
      Number(
        rateData?.rates?.NOK
      );

    if (liveRate > 0) {
      usdToNok = liveRate;
    }

    console.log(
      `USD → NOK rate: ${usdToNok}`
    );

  } catch (error) {

    console.log(
      `USD rate failed - using ${usdToNok}`
    );
  }


  for (const q of queries) {

    try {

      const url =
        "https://api.ebay.com/buy/browse/v1/item_summary/search?" +
        new URLSearchParams({
          q,
          limit: "50"
        });


      const response =
        await fetch(
          url,
          {
            headers: {

              Authorization:
                `Bearer ${tokenData.access_token}`,

              "X-EBAY-C-MARKETPLACE-ID":
                "EBAY_US",

              "X-EBAY-C-ENDUSERCTX":
                `affiliateCampaignId=${EBAY_CAMPAIGN_ID}`,

              "Accept-Language":
                "en-US"
            }
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        console.log(
          `eBay search failed: ${q}`
        );

        continue;
      }


      for (
        const item
        of data.itemSummaries || []
      ) {

        if (
          !item.itemId ||
          !item.title
        ) {
          continue;
        }


        const price =
          Number(
            item.price?.value || 0
          );


        if (price <= 0 || !item.itemAffiliateWebUrl || !String(item.itemAffiliateWebUrl).includes("campid=")) {
          continue;
        }


        const currency =
          String(
            item.price?.currency ||
            "USD"
          ).toUpperCase();


        /*
         * eBay offer price.
         *
         * Keep this as the original
         * eBay currency.
         */
        const offerPrice =
          price;
       const ebayBrand = item.brand || "";
       const ebayGtin = item.gtin || "";
       const ebayMpn = item.mpn || "";

        /*
         * Product-level lowest price.
         *
         * IMPORTANT:
         * lowestPrice is now ALWAYS NOK.
         */
        const lowestPriceNok =
          currency === "USD"
            ? price * usdToNok
            : price;


        allProducts.push({

          id:
            item.itemId,
          store: "eBay",

          name:
            item.title,
          brand:
  ebayBrand,

gtin:
  ebayGtin,

mpn:
  ebayMpn,

          category:
            ebayCategoryMap[q] ||
            "eBay",

          image:
            item.image?.imageUrl ||
            "",

          description:
            item.shortDescription ||
            item.title,

          specifications:
            {},


          offers: [

            {

              store:
                "eBay",

              country:
                item.itemLocationCountry || "US",

              condition:
                item.condition ||
                "New",

              /*
               * Original eBay price.
               * Example:
               * 257 USD
               */
              price:
                offerPrice,

              currency:
                currency,

              shipping:
                item.shippingOptions?.[0]
                  ?.shippingCost?.value ||
                null,

              inStock:
                true,

              affiliate:
                true,

              affiliateNetwork:
                "eBay Partner Network",

              url:
                item.itemAffiliateWebUrl ||
                "",

              updatedAt:
                new Date()
                  .toISOString()
                  .slice(0, 10)
            }

          ],


          /*
           * IMPORTANT:
           * This is now NOK.
           *
           * Example:
           * 257 USD
           * → approximately 2426 NOK
           */
          lowestPrice:
            lowestPriceNok,

          lowestStore:
            "eBay",

          /*
           * Explicitly tell the frontend
           * what currency lowestPrice uses.
           */
          lowestCurrency:
            "NOK",

          /*
           * Keep original USD price too.
           */
          originalPrice:
            offerPrice,

          originalCurrency:
            currency,

          updatedAt:
            new Date()
              .toISOString()
              .slice(0, 10)
        });
      }


      console.log(
        `eBay "${q}": ${
          data.itemSummaries?.length || 0
        } products`
      );


    } catch (error) {

      console.log(
        `eBay query error "${q}": ${error.message}`
      );
    }
  }


  const unique =
    Array.from(
      new Map(
        allProducts.map(
          product => [
            product.id,
            product
          ]
        )
      ).values()
    );


  console.log(
    `eBay products fetched: ${unique.length}`
  );


  return unique;
}


/* =========================================================
   Acer
   ========================================================= */

const AWIN_ACER_FEED_URL =
  process.env.AWIN_ACER_FEED_URL || "";
const ADTRACTION_API_TOKEN = process.env.ADTRACTION_API_TOKEN || "";
const ADTRACTION_CHANNEL_ID = process.env.ADTRACTION_CHANNEL_ID || "";
const ADTRACTION_PROSHOP_PROGRAM_ID = process.env.ADTRACTION_PROSHOP_PROGRAM_ID || "1870470286";

function parseCSV(text) {

  const firstLine =
    text.split(/\r?\n/)[0] || "";


  const candidates = [
    ",",
    ";",
    "|",
    "\t"
  ];


  function countDelimiter(
    line,
    delimiter
  ) {

    let count = 0;
    let quoted = false;


    for (
      let i = 0;
      i < line.length;
      i++
    ) {

      const c =
        line[i];


      if (c === '"') {

        if (
          quoted &&
          line[i + 1] === '"'
        ) {

          i++;

        } else {

          quoted =
            !quoted;
        }

      } else if (
        c === delimiter &&
        !quoted
      ) {

        count++;
      }
    }


    return count;
  }


  let delimiter = ",";
  let bestCount = 0;


  for (
    const candidate
    of candidates
  ) {

    const count =
      countDelimiter(
        firstLine,
        candidate
      );


    if (count > bestCount) {

      bestCount =
        count;

      delimiter =
        candidate;
    }
  }


  const rows = [];

  let row = [];
  let value = "";
  let quoted = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c =
      text[i];

    const next =
      text[i + 1];


    if (
      c === '"' &&
      quoted &&
      next === '"'
    ) {

      value += '"';

      i++;

      continue;
    }


    if (c === '"') {

      quoted =
        !quoted;

      continue;
    }


    if (
      c === delimiter &&
      !quoted
    ) {

      row.push(value);

      value = "";

      continue;
    }


    if (
      (c === "\n" ||
       c === "\r") &&
      !quoted
    ) {

      if (
        c === "\r" &&
        next === "\n"
      ) {
        i++;
      }


      row.push(value);

      value = "";


      if (
        row.some(
          v => v.trim() !== ""
        )
      ) {

        rows.push(row);
      }


      row = [];

      continue;
    }


    value += c;
  }


  if (
    value !== "" ||
    row.length > 0
  ) {

    row.push(value);


    if (
      row.some(
        v => v.trim() !== ""
      )
    ) {

      rows.push(row);
    }
  }


  if (!rows.length) {
    return [];
  }


  const headers =
    rows[0].map(
      header =>
        header
          .replace(
            /^\uFEFF/,
            ""
          )
          .trim()
          .toLowerCase()
    );


  return rows
    .slice(1)
    .map(values => {

      const obj = {};


      headers.forEach(
        (
          header,
          index
        ) => {

          obj[header] =
            (
              values[index] ||
              ""
            ).trim();
        }
      );


      return obj;
    });
}


function parsePrice(value) {

  if (!value) {
    return 0;
  }


  let s =
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(
        /[^\d,.-]/g,
        ""
      );


  if (!s) {
    return 0;
  }


  if (
    s.includes(",") &&
    s.includes(".")
  ) {

    if (
      s.lastIndexOf(",") >
      s.lastIndexOf(".")
    ) {

      s =
        s
          .replace(/\./g, "")
          .replace(",", ".");

    } else {

      s =
        s.replace(/,/g, "");
    }


  } else if (
    s.includes(",")
  ) {

    const parts =
      s.split(",");


    if (
      parts[
        parts.length - 1
      ].length === 2
    ) {

      s =
        s
          .replace(/\./g, "")
          .replace(",", ".");

    } else {

      s =
        s.replace(/,/g, "");
    }
  }


  const number =
    Number(s);


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function getCategory(row) {

  const text =
    (
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


  if (text.includes("gaming pc") || text.includes("gamingpc")) return "Gaming PC";
  if (text.includes("desktop pc") || text.includes("desktop computer") || text.includes("stationary pc")) return "Desktop PC";


  if (
    text.includes("graphics card") ||
    text.includes("gpu")
  ) {

    return "Graphics Card";
  }


  return "Electronics";
}


function getAvailability(value) {

  const text =
    String(value || "")
      .toLowerCase()
      .trim();


  if (!text) {
    return true;
  }


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

    console.log(
      "AWIN_ACER_FEED_URL is not set."
    );

    return [];
  }


  try {

    console.log(
      "Downloading Acer Awin product feed..."
    );


    const response =
      await fetch(
        AWIN_ACER_FEED_URL
      );


    if (!response.ok) {

      console.log(
        `Acer feed download failed: ${response.status} ${response.statusText}`
      );

      return [];
    }


    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );


    let text;


    if (
      buffer.length >= 2 &&
      buffer[0] === 0x1f &&
      buffer[1] === 0x8b
    ) {

      text =
        zlib
          .gunzipSync(buffer)
          .toString("utf8");

    } else {

      text =
        buffer.toString("utf8");
    }


    const rows =
      parseCSV(text);


    console.log(
      `Acer product rows: ${rows.length}`
    );


    if (!rows.length) {

      console.log(
        "No Acer products found."
      );

      return [];
    }


    console.log(
      "Acer columns:",
      Object.keys(rows[0])
    );


    console.log(
      "Acer sample:",
      JSON.stringify(
        rows[0]
      ).slice(0, 3000)
    );


    const acerProducts = [];


    for (
      const row
      of rows
    ) {

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


      const link = row.aw_deep_link || "";


      const image =
        row.image_link ||
        row.merchant_image_url ||
        row.image;


      const price =
        parsePrice(
          row.sale_price
        ) ||
        parsePrice(
          row.display_price
        ) ||
        parsePrice(
          row.store_price
        ) ||
        parsePrice(
          row.search_price
        ) ||
        parsePrice(
          row.price
        );


      if (
        !id ||
        !title ||
        !link ||
        !/^https:\/\//i.test(link) ||
        !/awin[1-9]\.com/i.test(link) ||
        price <= 0
      ) {

        continue;
      }


      const currency =
        (
          row.currency ||
          "NOK"
        ).toUpperCase();


      if (
        currency !== "NOK"
      ) {

        continue;
      }


      acerProducts.push({

        id:
          `acer-${id}`,

        name:
          title,

        description:
          row.description ||
          row.product_detail ||
          row.product_highlight ||
          "",

        category:
          getCategory(row),

        brand:
          row.brand ||
          "Acer",

        image:
          image || "",

        price:
          price,

        currency:
          "NOK",

        url:
          link,

        store:
          "Acer",

        affiliateNetwork:
          "Awin",

        country:
          "NO",

        shippingToNorwayVerified:
          true,

        shipping:
          0,

        shippingCostKnown:
          true,

        condition:
          row.condition ||
          "new",

        inStock:
          getAvailability(
            row.availability
          ),

        gtin:
          row.gtin ||
          "",

        mpn:
          row.mpn ||
          "",

        updatedAt:
          new Date()
            .toISOString()
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


/* =========================================================
   Main
   ========================================================= */
async function fetchProshopProducts() {
  if (!ADTRACTION_API_TOKEN || !ADTRACTION_CHANNEL_ID) { console.log("Adtraction Proshop feed skipped: API token or channel ID missing."); return []; }
  const response = await fetch("https://api.adtraction.net/v3/partner/products/feed/", { method: "POST", headers: { "X-Token": ADTRACTION_API_TOKEN, "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ programId: Number(ADTRACTION_PROSHOP_PROGRAM_ID), channelId: Number(ADTRACTION_CHANNEL_ID) }) });
  if (!response.ok) throw new Error("Adtraction Proshop feed failed: " + response.status + " " + response.statusText);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload.products) ? payload.products : []);
  if (!rows.length) throw new Error("Adtraction returned an empty Proshop feed; catalogue write is blocked.");
  const products = [];
  for (const row of rows) {
    const market = String(row.market || "").toUpperCase(); const currency = String(row.currency || "").toUpperCase();
    const trackingUrl = String(row.trackingUrl || ""); const productUrl = String(row.productUrl || "");
    const price = parsePrice(row.productPrice); const image = String(row.imageUrl || "");
    const sku = String(row.sku || row.ean || ""); const name = String(row.productName || "").trim();
    let tracked = false; try { const host = new URL(trackingUrl).hostname.toLowerCase(); tracked = trackingUrl.startsWith("https://") && (host === "adtraction.com" || host.endsWith(".adtraction.com") || host === "adtr.co" || host.endsWith(".adtr.co")); } catch (_) {}
    if (market !== "NO" || currency !== "NOK" || Number(row.approvalStatus) !== 1 || !sku || !name || !image || !productUrl || !tracked || price <= 0 || row.inStock === false) continue;
    const t = (String(row.productCategory || "") + " " + name).toLowerCase(); let category = null;
    if (/grafikkort|graphics card|gpu|geforce|radeon/.test(t)) category = "Graphics Card"; else if (/gaming.?pc|stasjonær|desktop pc/.test(t)) category = "Gaming PC"; else if (/bærbar|laptop|notebook|chromebook/.test(t)) category = "Laptop"; else if (/prosessor|processor|cpu|ryzen|intel core/.test(t)) category = "CPU"; else if (/ram|minne|ddr[45]/.test(t)) category = "RAM"; else if (/ssd|nvme|harddisk|lagring/.test(t)) category = "SSD"; else if (/skjerm|monitor|display/.test(t)) category = "Monitor"; else if (/hovedkort|motherboard/.test(t)) category = "Motherboard";
    if (!category) continue;
    products.push({ id: "proshop-" + sku, name, description: row.productDescription || "", category, brand: row.manufacturer || "", image, price, currency: "NOK", url: trackingUrl, productUrl, store: "Proshop", affiliateNetwork: "Adtraction", country: "NO", condition: "new", inStock: true, shipping: row.shipping == null ? null : Number(row.shipping), shippingToNorwayVerified: true, shippingCostKnown: row.shipping != null, trackingVerified: true, gtin: row.ean || "", mpn: row.manufacturerArticleNumber || "", updatedAt: new Date().toISOString() });
  }
  console.log("Adtraction Proshop NO products accepted: " + products.length + " / " + rows.length);
  if (!products.length) throw new Error("No valid tracked Proshop NO/NOK products; catalogue write is blocked.");
  return products;
}
async function main() {

  const files = [
    "products.json",
    "public/products.json"
  ];


  let existing = [];


  try {

    existing =
      JSON.parse(
        fs.readFileSync(
          "products.json",
          "utf8"
        )
      );

  } catch (error) {

    console.log(
      "Could not read products.json:",
      error.message
    );

    existing = [];
  }


  if (
    !Array.isArray(existing)
  ) {

    existing = [];
  }


  const acerProducts =
    await fetchAcerProducts();


  const ebayProducts =
    await fetchEbayProducts();
  const proshopProducts = await fetchProshopProducts();

  /*
   * 保留现有产品。
   * 删除旧 Acer、eBay 和 Proshop，
   * 然后加入最新数据。
   */

  const preserved =
    existing.filter(
      product => {

        if (!product) {
          return false;
        }


        const id =
          String(
            product.id || ""
          ).toLowerCase();


        const store =
          String(
            product.store || ""
          ).toLowerCase();


        const offers =
          Array.isArray(
            product.offers
          )
            ? product.offers
            : [];


        const isAcer =
          id.startsWith(
            "acer-"
          ) ||
          store === "acer" ||
          offers.some(
            offer =>
              String(
                offer.store || ""
              ).toLowerCase() ===
              "acer"
          );


        const isEbay =
          store === "ebay" ||
          offers.some(
            offer =>
              String(
                offer.store || ""
              ).toLowerCase() ===
              "ebay"
          );
        const isProshop =
          store === "proshop" ||
          store === "Proshop" ||
          offers.some(
            offer =>
              String(
                offer.store || ""
              ).toLowerCase() === "proshop"
          );

        return (
          !isAcer &&
          !isEbay &&
          !isProshop
        );
      }
    );


  const finalProducts =
    preserved.concat(
      acerProducts,
      ebayProducts,
      proshopProducts,
    );
  const allowedCategories = new Set([
  "Graphics Card",
  "CPU",
  "RAM",
  "SSD",
  "Gaming Laptop",
  "Laptop",
  "Gaming PC",
  "Desktop PC",
  "Monitor",
  "Monitors",
  "Motherboard",
  "Motherboards"
]);

const excludedKeywords = [
  "case",
  "bag",
  "backpack",
  "sleeve",
  "cover",
  "license",
  "software",
  "operating system",
  "windows",
  "server",
  "keyboard",
  "mouse",
  "headset",
  "headphone",
  "webcam",
  "cable",
  "adapter",
  "hub",
  "docking station",
  "dock",
  "charger",
  "power adapter",
  "printer",
  "toner",
  "ink cartridge",
  "stand",
"holder",
"desk",
"workstation",
"laptopboard",
"table",
"support"
];

const filteredProducts = finalProducts.filter(product => {
  const category = String(product.category || "").trim();

  if (!allowedCategories.has(category)) {
    return false;
  }

  const text = [
    product.name,
    product.description,
    product.brand
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return !excludedKeywords.some(keyword =>
    text.includes(keyword)
  );
});
  const normalizedProducts = filteredProducts.map(product => ({
  ...product,
  price:
    product.price !== null &&
    product.price !== undefined &&
    Number.isFinite(Number(product.price))
      ? Math.round(Number(product.price))
      : product.price
}));

const allowedStores = new Set([
  "proshop",
  "ebay",
  "acer"
]);

function createOffer(product) {
  const existingOffer = Array.isArray(product.offers)
    ? product.offers.find(o => o && Number(o.price) > 0 && o.url)
    : null;
    if (existingOffer) {
    const network = String(existingOffer.affiliateNetwork || "").toLowerCase();
    const trackedUrl = String(existingOffer.url || "");
    const tracked = network.includes("ebay") ? trackedUrl.includes("campid=") : network.includes("awin") ? /awin[1-9]\.com/i.test(trackedUrl) : network.includes("adtraction") ? /adtraction\.com|adtr\.co/i.test(trackedUrl) : false;
    if (!tracked) throw new Error("Unverified affiliate tracking URL for " + (product.name || product.id));
    return { ...existingOffer, trackingVerified: true };
  }

  const price = Number(product.price);
  const url = String(product.url || "");
  const network = String(product.affiliateNetwork || "").toLowerCase();
  const tracked = network.includes("ebay") ? url.includes("campid=") : network.includes("awin") ? /awin[1-9]\.com/i.test(url) : network.includes("adtraction") ? /adtraction\.com|adtr\.co/i.test(url) : false;
  if (!Number.isFinite(price) || price <= 0 || !url || !tracked) {
    throw new Error("Cannot create offer from incomplete product source");
  }

  return {
    store: product.store || "Unknown",
    condition: product.condition || "new",
    price,
    currency: String(product.currency || "NOK").toUpperCase(),
    url,
    affiliate: true,
    affiliateNetwork: product.affiliateNetwork || "Unknown affiliate network",
    country: product.country || "NO",
    inStock: product.inStock !== false,
    shipping: product.shipping ?? null,\n    shippingToNorwayVerified: product.shippingToNorwayVerified === true,\n    trackingVerified: true,
    updatedAt: product.updatedAt || new Date().toISOString()
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(new|used|refurbished|refurb|open box)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function getProductKeys(product) {
  const keys = [];

  const gtin = String(
    product.gtin || product.ean || ""
  ).replace(/\D/g, "");

  const brand = normalizeText(product.brand);

  const mpn = normalizeText(
    product.mpn ||
    product.model_number ||
    product.model
  );

  const name = normalizeText(
    product.name || product.title
  );

  // 1. 商品条码：优先匹配
  if (gtin.length >= 8) {
    keys.push(`gtin:${gtin}`);
  }

  // 2. 厂商型号：不要求品牌字段完全一致
  if (mpn.length >= 4) {
    keys.push(`mpn:${mpn}`);
  }

  if (brand && mpn.length >= 4) {
    keys.push(`mpn-brand:${brand}:${mpn}`);
  }

  // 3. 从标题提取具体型号编码
  const rawName = String(
    product.name || product.title || ""
  );

  const pattern =
    /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/gi;

  for (const match of rawName.matchAll(pattern)) {
    const token = normalizeText(match[0])
      .replace(/\s+/g, "");

    if (token.length >= 5) {
      keys.push(`title-model:${token}`);

      if (brand) {
        keys.push(
          `title-model-brand:${brand}:${token}`
        );
      }
    }
  }

  // 4. 完整品牌名称作为后备匹配
  if (brand && name.length >= 8) {
    keys.push(`name:${brand}:${name}`);
  }

  return [...new Set(keys)];
}
const productGroups = new Map();

for (const product of normalizedProducts) {
  const store = String(product.store || "").toLowerCase();

  if (!allowedStores.has(store)) {
    continue;
  }

  const keys = getProductKeys(product);

  let group = null;

  for (const key of keys) {
    if (productGroups.has(key)) {
      group = productGroups.get(key);
      break;
    }
  }

  if (!group) {
    group = [];
  }

  group.push(product);

  for (const key of keys) {
    productGroups.set(key, group);
  }
}

const mergedProducts = [];
const processedGroups = new Set();

for (const group of productGroups.values()) {
  if (processedGroups.has(group)) {
    continue;
  }

  processedGroups.add(group);

  const storeProducts = new Map();

  for (const product of group) {
    const store = String(product.store || "").toLowerCase();

    if (!allowedStores.has(store)) {
      continue;
    }

    if (!storeProducts.has(store)) {
      storeProducts.set(store, product);
    }
  }

  // 至少 3 家商家才保留
  if (storeProducts.size < 3) {
    continue;
  }

  const products = [...storeProducts.values()];

  const base =
    products.find(
      product =>
        String(product.store || "").toLowerCase() === "proshop"
    ) || products[0];

  const offers = products.map(createOffer);

  offers.sort((a, b) => {
    const priceA = Number(a.price);
    const priceB = Number(b.price);

    if (!Number.isFinite(priceA)) return 1;
    if (!Number.isFinite(priceB)) return -1;

    return priceA - priceB;
  });

  const cheapest = offers[0];

  const categoryMap = {
    "Graphics Card": "Graphics Cards",
    "CPU": "Processors",
    "RAM": "Memory",
    "SSD": "Storage",
    "Laptop": "Laptops",
    "Gaming Laptop": "Laptops",
    "Gaming PC": "Gaming PCs",
    "Desktop PC": "Desktop PCs",
    "Monitor": "Monitors",
    "Monitors": "Monitors"
  };

  mergedProducts.push({
    ...base,
    category: categoryMap[String(base.category || "").trim()] || base.category,
    price:
      Number.isFinite(Number(cheapest.price))
        ? Math.round(Number(cheapest.price))
        : cheapest.price,
    store: cheapest.store,
    offers,
    lowestStore: cheapest.store,
    lowestPrice:
      Number.isFinite(Number(cheapest.price))
        ? Math.round(Number(cheapest.price))
        : cheapest.price,
    lowestCurrency: cheapest.currency || "NOK"
  });
}

const categoryLimits = {
  "Graphics Card": 40,
  "CPU": 40,
  "RAM": 40,
  "SSD": 40,
  "Gaming Laptop": 40,
  "Laptop": 40,
  "Gaming PC": 40,
  "Desktop PC": 40,
  "Monitor": 40,
  "Monitors": 40,
  "Motherboard": 40,
  "Motherboards": 40
};

const selectedProducts = [];

for (const category of Object.keys(categoryLimits)) {
  const products = mergedProducts
    .filter(
      product =>
        String(product.category || "").trim() === category
    )
    .sort(
      (a, b) =>
        (b.offers?.length || 0) -
        (a.offers?.length || 0)
    )
    .slice(0, categoryLimits[category]);

  selectedProducts.push(...products);
}

const compactProducts = selectedProducts;

  const minimumSafeCount = Math.max(
    Number(process.env.MIN_CATALOGUE_PRODUCTS || 30),
    Math.ceil(existing.length * 0.25)
  );

  const validProducts = compactProducts.filter(product =>
    product &&
    product.id &&
    product.name &&
    product.image &&
    Array.isArray(product.offers) &&
    product.offers.length >= 3 &&
    product.offers.every(offer =>
      offer &&
      Number(offer.price) > 0 &&
      offer.currency &&
      offer.url &&
      offer.affiliate === true && offer.trackingVerified === true
    )
  );

  if (
    !Array.isArray(existing) ||
    existing.length === 0 ||
    compactProducts.length < minimumSafeCount ||
    compactProducts.some(product => new Set(product.offers.map(offer => String(offer.store || "").toLowerCase())).size < 3) ||
    validProducts.length !== compactProducts.length
  ) {
    throw new Error(
      `SAFE MODE: refusing to replace catalogue. Existing=${existing.length}, candidate=${compactProducts.length}, valid=${validProducts.length}, minimum=${minimumSafeCount}. Existing products.json files remain untouched.`
    );
  }


  const ebayFile =
    "ebay-products.json";


  if (
    ebayProducts.length > 0
  ) {

    fs.writeFileSync(
      ebayFile,

      JSON.stringify(
        ebayProducts,
        null,
        2
      ),

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
      compactProducts,
      null,
      2
    ),

    "utf8"
  );


  fs.writeFileSync(
    "public/products.json",

    JSON.stringify(
      compactProducts,
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
    `eBay products added: ${ebayProducts.length}`
  );


  console.log(
    `Total products saved: ${finalProducts.length}`
  );
}


main().catch(
  error => {

    console.error(error);

    process.exit(1);
  }
);
