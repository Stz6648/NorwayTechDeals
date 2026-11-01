const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Vercel's deployment environment is authoritative: a Preview deployment must
// remain read-only even when READONLY_PREVIEW was not set in its environment.
const READONLY_PREVIEW = process.env.VERCEL_ENV === "preview"
  || process.env.READONLY_PREVIEW === "1";
const productsFile = READONLY_PREVIEW
  ? path.join(__dirname, "public", "products.json")
  : path.join(__dirname, "products.json");

app.use(express.json());

// Retire legacy pages built around local-store price comparisons.
app.get("/beste-gaming-laptop.html", (req, res) => res.redirect(301, "/gaming-laptops.html"));
app.get("/beste-billige-gaming-laptop.html", (req, res) => res.redirect(301, "/gaming-laptops.html"));
app.get("/beste-gaming-pc.html", (req, res) => res.redirect(301, "/gaming-pc.html"));
app.get("/index-backup.html", (req, res) => res.redirect(301, "/"));

if (READONLY_PREVIEW) {
  // Only safe read methods are accepted in Preview. There are no refresh,
  // publish, or mutation routes in this entry point.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.sendStatus(405);
    }
    next();
  });

  app.use(express.static(path.join(__dirname, "public")));
  // The site entry point is at the repository root. Explicitly pin the JSON
  // URL to the public catalogue before serving other root assets, so the root
  // production catalogue can never become a Preview fallback.
  app.get("/products.json", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "products.json"));
  });
  app.use(express.static(__dirname));
} else {
  // Keep the existing Production and local development file behavior.
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.static(__dirname));
}

function loadProducts() {
  try {
    const data = fs.readFileSync(productsFile, "utf8");
    const products = JSON.parse(data);

    console.log("Products loaded:", products.length);
    return products;
  } catch (error) {
    console.error("ERROR reading products.json:");
    console.error(error.message);
    return [];
  }
}

app.get("/api/products", (req, res) => {
  res.json(loadProducts());
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("================================");
    console.log("NorwayTechDeals running!");
    console.log("http://localhost:" + PORT);
    console.log("Products file:");
    console.log(productsFile);
    console.log("================================");
  });
}

// Vercel detects this root Express entry and invokes its CommonJS export as
// the serverless request handler. Keep the existing test/local helpers on the
// callable Express app while exporting the app itself to the runtime.
Object.assign(app, { app, loadProducts, productsFile, READONLY_PREVIEW });
module.exports = app;
