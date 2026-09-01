const fs = require("fs");

const file = "products.json";

const products = [
  {
    name: "Lenovo LOQ 15",
    category: "laptop",
    description: '15.6" Gaming Laptop',
    gpu: "NVIDIA GeForce RTX 5060 8GB",
    ram: "16 GB DDR5",
    storage: "1 TB SSD",
    screen: '15.6" Full HD 144 Hz',
    offers: [
      {
        store: "Proshop",
        price: 12990,
        url: "https://www.proshop.no/"
      },
      {
        store: "Komplett",
        price: 22990,
        url: "https://www.komplett.no/"
      }
    ]
  },

  {
    name: "GIGABYTE Gaming A16",
    category: "laptop",
    description: '16" Gaming Laptop',
    gpu: "NVIDIA GeForce RTX 5070 8GB",
    ram: "16 GB DDR5",
    storage: "1 TB SSD",
    screen: '16" WUXGA 165 Hz',
    offers: [
      {
        store: "Proshop",
        price: 12990,
        url: "https://www.proshop.no/"
      }
    ]
  },

  {
    name: "ASUS ROG Strix G16",
    category: "laptop",
    description: '16" Premium Gaming Laptop',
    gpu: "NVIDIA GeForce RTX 5070 8GB",
    ram: "32 GB DDR5",
    storage: "1 TB SSD",
    screen: '16" WQXGA 240 Hz',
    offers: [
      {
        store: "Proshop",
        price: 24990,
        url: "https://www.proshop.no/"
      }
    ]
  },

  {
    name: "NVIDIA GeForce RTX 5070",
    category: "gpu",
    description: "Gaming Graphics Card",
    gpu: "RTX 5070 12GB",
    offers: [
      {
        store: "Proshop",
        price: 6990,
        url: "https://www.proshop.no/"
      }
    ]
  },

  {
    name: "NVIDIA GeForce RTX 5060",
    category: "gpu",
    description: "Gaming Graphics Card",
    gpu: "RTX 5060 8GB",
    offers: [
      {
        store: "Proshop",
        price: 3990,
        url: "https://www.proshop.no/"
      }
    ]
  }
];

fs.writeFileSync(
  file,
  JSON.stringify(products, null, 2),
  "utf8"
);

console.log("products.json updated successfully.");
console.log("Products:", products.length);