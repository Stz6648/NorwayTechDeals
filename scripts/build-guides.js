// Generates Norwegian buying-guide pages from content/guides/*.json and products.json.
// Safe by design: writes only public/<slug>.html and the sitemaps, never products.json.
// Guards: merchant must be 'approved' in data/merchants.json, link must be a tracked eBay link,
// every guide page needs a disclosure, and no page may present a USD price as NOK.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const SITE = "https://norwaytechdeals.no";
const CAMPID = "5339206505";
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const merchants = JSON.parse(fs.readFileSync(path.join(root, "data", "merchants.json"), "utf8"));
const guideFiles = fs.readdirSync(path.join(root, "content", "guides")).filter(f => f.endsWith(".json")).sort();

let catalogueDate = new Date().toISOString().slice(0, 10);
try {
  catalogueDate = execFileSync("git", ["log", "-1", "--format=%cs", "--", "products.json"], { cwd: root, encoding: "utf8" }).trim() || catalogueDate;
} catch (_) { /* keep fallback */ }
const dateNb = new Date(catalogueDate + "T12:00:00Z").toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const usd = n => "US$ " + Number(n).toLocaleString("nb-NO", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
const BAD = /\b(for parts|not working|broken|untested|empty box|box only|lot of|bundle|read description|as[- ]is|no returns)\b/i;
const condMatch = (cond, wanted) => {
  const c = String(cond || "").toLowerCase();
  return wanted.some(w => (w === "new" ? c === "new" : c.includes(w)));
};

function selectPicks(spec) {
  const match = new RegExp(spec.match, "i");
  const exclude = spec.exclude ? new RegExp(spec.exclude, "i") : null;
  const brand = spec.brand ? new RegExp(spec.brand, "i") : null;
  const out = [];
  for (const p of products) {
    if (p.category !== spec.category) continue;
    const o = (p.offers || [])[0];
    if (!o || o.affiliate !== true || Number(o.price) <= 0) continue;
    if (!match.test(p.name) || BAD.test(p.name)) continue;
    if (exclude && exclude.test(p.name)) continue;
    if (brand && !brand.test(p.name)) continue;
    if (!condMatch(o.condition, spec.conditions || ["new"])) continue;
    if (spec.minPrice && Number(o.price) < spec.minPrice) continue;
    if (spec.maxPrice && Number(o.price) > spec.maxPrice) continue;
    out.push({ p, o });
  }
  out.sort((a, b) => Number(a.o.price) - Number(b.o.price));
  return out.slice(0, spec.count || 1);
}

const CSS = `:root{--bg:#0b1020;--panel:#141f31;--line:#293851;--text:#f4f7fb;--muted:#a6b4c7;--lime:#c5f36b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.7}a{color:inherit}.shell{max-width:860px;margin:auto;padding:0 20px}header{border-bottom:1px solid #ffffff16;background:#090d17}.nav{height:64px;display:flex;align-items:center;justify-content:space-between}.logo{font-size:22px;font-weight:900;letter-spacing:-1px;text-decoration:none}.logo span{color:var(--lime)}.back{color:#b8c6d8;font-size:13px;text-decoration:none}main{padding:30px 0 60px}.crumb{font-size:12px;color:#94a5bb;margin-bottom:14px}h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-1px;margin:0 0 16px}h2{font-size:23px;margin:36px 0 10px;letter-spacing:-.4px}h3{font-size:16px;line-height:1.4;margin:6px 0 8px}p{color:#cfd9e6}.updated{font-size:12px;color:var(--muted)}.notice{background:#4b321a;color:#ffd99b;border-radius:10px;padding:13px 15px;font-size:14px;margin:18px 0}.picks{display:grid;gap:16px;margin-top:14px}.pick{background:linear-gradient(145deg,#17243a,#111a29);border:1px solid var(--line);border-radius:14px;padding:18px;display:grid;grid-template-columns:120px 1fr;gap:16px}.pick img{width:120px;height:120px;object-fit:contain;background:#f4f6f8;border-radius:10px;padding:6px}.label{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--lime);font-weight:800}.meta{font-size:12px;color:var(--muted);margin:0 0 6px}.price{font-size:22px;font-weight:900;margin:4px 0}.price small{display:block;font-size:11px;font-weight:400;color:var(--muted)}ul{margin:6px 0 10px;padding-left:20px;color:#cfd9e6;font-size:14px}.cta{display:inline-block;background:var(--lime);color:#111827;font-weight:900;font-size:13px;padding:11px 15px;border-radius:8px;text-decoration:none}.empty{border:1px dashed #43516a;border-radius:10px;padding:14px;color:var(--muted);font-size:14px}.disclosure{background:#111a2a;border:1px solid var(--line);border-radius:12px;padding:16px 18px;font-size:13px;color:#aab8cb;margin-top:32px}footer{border-top:1px solid #ffffff16;padding:22px 0;color:#8392a7;font-size:12px}@media(max-width:620px){.pick{grid-template-columns:1fr}.pick img{width:100%;height:170px}}`;

const CHECKLIST = [
  "Se at selgeren sender til Norge, og hva frakten koster.",
  "Sjekk om MVA (normalt 25 %) og eventuelle gebyrer er med i totalprisen i kassen, eller om de kommer ved levering. Bekreft gjeldende regler hos Tolletaten.",
  "Les selgerens vurderinger og returvilkår. Retur til utlandet kan bli dyrt.",
  "Ved brukt eller åpnet eske: be om bilder av serienummer og se etter beskrivelse av testing. Garantien følger ikke alltid med.",
  "Norske forbrukerrettigheter gjelder ikke nødvendigvis når du kjøper fra en selger i USA. Les eBays kjøperbeskyttelse og vilkårene i annonsen."
];

function renderPick(spec, hit, i) {
  const { p, o } = hit;
  const pros = (spec.pros || []).map(x => "<li>" + esc(x) + "</li>").join("");
  const cons = (spec.cons || []).map(x => "<li>" + esc(x) + "</li>").join("");
  return `<article class="pick"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)}"><div><div class="label">${esc(spec.label)}</div><h3>${esc(p.name)}</h3><p class="meta">Stand: ${esc(o.condition)} · Selges på eBay.com</p><div class="price">${usd(o.price)}<small>Annonsepris på eBay.com i USD per ${esc(dateNb)}. Ikke en norsk pris: frakt, MVA og gebyrer kommer i tillegg.</small></div><strong>Fordeler</strong><ul>${pros}</ul><strong>Ulemper</strong><ul>${cons}</ul><a class="cta" href="${esc(o.url)}" target="_blank" rel="nofollow sponsored noopener">Se annonsen på eBay ↗</a></div></article>`;
}

function render(g, picksHtml) {
  const robots = g.publish ? "index,follow" : "noindex,follow";
  const sections = (g.sections || []).map(s => `<h2>${esc(s.h2)}</h2>` + s.paragraphs.map(t => `<p>${esc(t)}</p>`).join("")).join("\n");
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(g.title)} | TechKjop</title>
<meta name="description" content="${esc(g.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${SITE}/${g.slug}.html">
<meta property="og:title" content="${esc(g.title)}">
<meta property="og:description" content="${esc(g.description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/${g.slug}.html">
<meta name="theme-color" content="#090d17">
<style>${CSS}</style>
</head>
<body>
<header><div class="shell nav"><a class="logo" href="/">Tech<span>Kjop</span></a><a class="back" href="/">← Til forsiden</a></div></header>
<main class="shell">
<div class="crumb"><a href="/">Forsiden</a> / Kjøpeguider</div>
<h1>${esc(g.h1)}</h1>
<p class="updated">Katalogen sist oppdatert: ${esc(dateNb)}</p>
${g.intro.map(t => `<p>${esc(t)}</p>`).join("\n")}
<div class="notice"><strong>Prisinformasjon:</strong> Alle priser på denne siden er annonsepriser på eBay.com i amerikanske dollar, hentet fra vår katalog. De er ikke norske butikkpriser og er ikke omregnet til kroner. Frakt, MVA og gebyrer kommer i tillegg, og levering til Norge er ikke verifisert.</div>
${sections}
<h2>${esc(g.picksHeading || "Utvalgte annonser")}</h2>
<div class="picks">
${picksHtml}
</div>
<h2>Slik har vi valgt</h2>
<p>${esc(g.howWeChoose)}</p>
<h2>Slik kjøper du fra eBay til Norge</h2>
<ul>${CHECKLIST.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>Sammenlign med norske butikker</h2>
<p>Når MVA og frakt er lagt til, kan en norsk butikk ofte bli like billig eller billigere for nye varer. Sjekk prisen på samme modell hos norske forhandlere før du bestiller. eBay kan være mest aktuelt for brukte, åpnede eller utgåtte varer.</p>
<div class="disclosure"><strong>Annonselenker:</strong> TechKjop kan tjene provisjon på kvalifiserte kjøp gjort via lenkene på denne siden, uten ekstra kostnad for deg. Vi er ikke selger og styrer ikke eBay-annonsene. Les mer under <a href="/affiliate.html">affiliate-informasjon</a>.</div>
</main>
<footer><div class="shell">© 2026 TechKjop · <a href="/about.html">Om</a> · <a href="/privacy.html">Personvern</a> · <a href="/affiliate.html">Affiliate</a> · <a href="/terms.html">Vilkår</a></div></footer>
</body>
</html>
`;
}

const errors = [];
const published = [];
for (const f of guideFiles) {
  const g = JSON.parse(fs.readFileSync(path.join(root, "content", "guides", f), "utf8"));
  let picksHtml = "";
  let total = 0;
  for (const spec of g.picks) {
    const hits = selectPicks(spec);
    if (!hits.length) { picksHtml += `<div class="empty">Ingen passende annonser i katalogen akkurat nå for: ${esc(spec.label)}.</div>\n`; continue; }
    for (const hit of hits) {
      total++;
      const store = hit.o.store;
      if (!merchants[store] || merchants[store].status !== "approved") errors.push(`${g.slug}: merchant ${store} is not approved`);
      if (!String(hit.o.url).includes("campid=" + CAMPID)) errors.push(`${g.slug}: ${hit.p.id} link is missing the eBay campaign id`);
      if (hit.o.currency !== "USD") errors.push(`${g.slug}: ${hit.p.id} unexpected currency ${hit.o.currency}`);
      picksHtml += renderPick(spec, hit) + "\n";
    }
  }
  if (!total) errors.push(`${g.slug}: no listings found at all`);
  const html = render(g, picksHtml);
  // Case-sensitive on purpose: Norwegian "nok" (= enough) is a normal word. Flags "NOK" or an amount followed by "kr".
  if (/\bNOK\b|\d[\s ]?kr\b/.test(html)) errors.push(`${g.slug}: page mentions NOK/kr amounts; prices must stay in USD`);
  if (!html.includes('rel="nofollow sponsored noopener"')) errors.push(`${g.slug}: no sponsored links rendered`);
  if (!html.includes("Annonselenker")) errors.push(`${g.slug}: missing disclosure`);
  if (g.publish) published.push(g.slug);
  fs.writeFileSync(path.join(root, "public", g.slug + ".html"), html);
  console.log(`${g.publish ? "PUBLISHED " : "draft     "} ${g.slug}: ${total} listings`);
}
if (errors.length) { console.error("Guide build failed:\n - " + errors.join("\n - ")); process.exit(1); }

const base = ["", "beste-gaming-pc.html", "beste-gaming-laptop.html", "beste-billige-gaming-laptop.html", ...published.map(s => s + ".html")];
const lastmod = catalogueDate;
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  base.map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n") + "\n</urlset>\n";
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "public", "sitemap.xml"), sitemap);
console.log("Sitemap URLs:", base.length);
