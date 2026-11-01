const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.VERCEL_ENV = "preview";
delete process.env.READONLY_PREVIEW;
const { app, loadProducts, productsFile, READONLY_PREVIEW } = require("./index");
const vercelEntry = require("./index");

test("Vercel CommonJS entry exports the callable Express handler", () => {
  assert.equal(require("./package.json").type, "commonjs");
  assert.equal(typeof vercelEntry, "function");
  assert.equal(vercelEntry.app, app);
  assert.equal(vercelEntry.loadProducts, loadProducts);
  assert.equal(vercelEntry.productsFile, productsFile);
});

test("Express entry serves the homepage and products API without a runtime error", async () => {
  const server = require("node:http").createServer(vercelEntry).listen(0);
  try {
    const { port } = server.address();
    const home = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /View Deal|TechKjop/i);

    const products = await fetch(`http://127.0.0.1:${port}/api/products`);
    assert.equal(products.status, 200);
    assert.deepEqual(await products.json(), JSON.parse(fs.readFileSync(productsFile, "utf8")));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("Preview eBay Function is a CommonJS handler and remains disabled", async () => {
  const ebayHandler = require("./api/ebay-search");
  assert.equal(typeof ebayHandler, "function");
  const originalEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  let statusCode;
  let payload;
  try {
    await ebayHandler({ query: {} }, {
      status(code) { statusCode = code; return this; },
      json(value) { payload = value; return this; }
    });
  } finally {
    if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnvironment;
  }
  assert.equal(statusCode, 404);
  assert.deepEqual(payload, { error: "Not found" });
});

test("Preview is read-only and loads the public catalogue", async () => {
  assert.equal(READONLY_PREVIEW, true);
  assert.equal(productsFile, path.join(__dirname, "public", "products.json"));
  assert.deepEqual(loadProducts(), JSON.parse(fs.readFileSync(productsFile, "utf8")));

  const stack = app.router.stack;
  const readonlyLayer = stack.find(layer => layer.handle.toString().includes("req.method !== \"GET\""));
  assert.ok(readonlyLayer, "Preview installs the method restriction middleware");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    let status;
    let nextCalled = false;
    readonlyLayer.handle({ method }, { sendStatus: value => { status = value; } }, () => { nextCalled = true; });
    assert.equal(status, 405, method);
    assert.equal(nextCalled, false, method);
  }
  let getNextCalled = false;
  readonlyLayer.handle({ method: "GET" }, {}, () => { getNextCalled = true; });
  assert.equal(getNextCalled, true);
});

test("Production reads the root production catalogue", () => {
  const script = `
    const assert = require("node:assert/strict");
    const fs = require("node:fs");
    const path = require("node:path");
    process.env.VERCEL_ENV = "production";
    delete process.env.READONLY_PREVIEW;
    const { loadProducts, productsFile, READONLY_PREVIEW } = require("./index");
    assert.equal(READONLY_PREVIEW, false);
    assert.equal(productsFile, path.join(process.cwd(), "products.json"));
    assert.deepEqual(loadProducts(), JSON.parse(fs.readFileSync(productsFile, "utf8")));
  `;
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: __dirname,
    encoding: "utf8",
    env: { ...process.env, VERCEL_ENV: "production", READONLY_PREVIEW: "" }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
