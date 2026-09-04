const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const productsFile = path.join(__dirname, "products.json");

app.use(express.json());
app.use(express.static(__dirname));

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
    const products = loadProducts();
    res.json(products);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log("================================");
    console.log("NorwayTechDeals running!");
    console.log("http://localhost:" + PORT);
    console.log("Products file:");
    console.log(productsFile);
    console.log("================================");
});