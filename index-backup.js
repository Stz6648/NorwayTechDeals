const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NorwayTechDeals</title>
<style>
body {
font-family: Arial, sans-serif;
margin: 0;
background: #f5f7fa;
color: #222;
}

header {
background: #111827;
color: white;
padding: 25px;
text-align: center;
}

h1 {
margin: 0;
font-size: 32px;
}

.subtitle {
margin-top: 8px;
color: #cbd5e1;
}

.container {
max-width: 1100px;
margin: 40px auto;
padding: 20px;
}

.search {
width: 100%;
padding: 15px;
font-size: 16px;
border: 1px solid #ddd;
border-radius: 8px;
box-sizing: border-box;
}

.products {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
gap: 20px;
margin-top: 30px;
}

.card {
background: white;
padding: 20px;
border-radius: 12px;
box-shadow: 0 2px 10px rgba(0,0,0,0.08);
}

.card h2 {
font-size: 20px;
}

.price {
font-size: 24px;
font-weight: bold;
margin: 15px 0;
}

button {
background: #16a34a;
color: white;
border: none;
padding: 12px 18px;
border-radius: 7px;
cursor: pointer;
}
</style>
</head>

<body>

<header>
<h1>NorwayTechDeals</h1>
<div class="subtitle">
Find the best computer & IT deals in Norway
</div>
</header>

<div class="container">

<input
class="search"
type="text"
placeholder="Search products..."
>

<div class="products">

<div class="card">
<h2>DDR5 RAM</h2>
<div class="price">From 699 kr</div>
<button>View Deal</button>
</div>

<div class="card">
<h2>Gaming GPU</h2>
<div class="price">From 3,999 kr</div>
<button>View Deal</button>
</div>

<div class="card">
<h2>Gaming Laptop</h2>
<div class="price">From 7,999 kr</div>
<button>View Deal</button>
</div>

<div class="card">
<h2>SSD</h2>
<div class="price">From 599 kr</div>
<button>View Deal</button>
</div>

</div>

</div>

</body>
</html>
`);
});

app.listen(PORT, () => {
console.log(`NorwayTechDeals is running at http://localhost:${PORT}`);
});
