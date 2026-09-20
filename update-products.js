const fs = require("fs");
const zlib = require("zlib");

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
        parsePrice(row.price) ||
        parsePrice(row.search_price);

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

  const acerProducts =
    await fetchAcerProducts();

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

    return !isAcer;
  });

  const finalProducts = [
    ...preserved,
    ...acerProducts
  ];

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
