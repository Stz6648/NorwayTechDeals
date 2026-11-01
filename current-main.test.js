const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.VERCEL_ENV = "preview";
delete process.env.READONLY_PREVIEW;
const { app, loadProducts, productsFile, READONLY_PREVIEW } = require("./index");

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
