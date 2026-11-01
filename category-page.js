(() => {
  const label = document.body.dataset.category;
  const key = label.toLowerCase();
  const grid = document.getElementById("categoryProducts");
  const status = document.getElementById("categoryStatus");
  const search = document.getElementById("categorySearch");
  let products = [];
  const categoryAliases = {
    cpu: ["cpu", "processor"], ram: ["ram", "memory"], ssd: ["ssd", "storage"],
    monitors: ["monitor", "monitors"], laptop: ["laptop"], motherboards: ["motherboard", "motherboards"]
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render() {
    const matches = products.filter(p => (categoryAliases[key] || [key]).includes(String(p.category || "").toLowerCase()) && JSON.stringify(p).toLowerCase().includes(search.value.trim().toLowerCase()));
    status.textContent = matches.length ? `${matches.length} ${label} product${matches.length === 1 ? "" : "s"}` : `No ${label} products are available yet.`;
    grid.innerHTML = matches.map(p => {
      const offer = (Array.isArray(p.offers) ? p.offers : []).find(o => o && /^https?:\/\//i.test(o.url || ""));
      const priced = offer && Number(offer.price) > 0 && offer.currency;
      const price = priced ? `${escapeHtml(offer.price)} ${escapeHtml(offer.currency)}` : "See price at merchant";
      const image = p.image || "/images/techkjop-placeholder.svg";
      const rel = offer?.affiliate === true ? "nofollow sponsored noopener" : "nofollow noopener";
      return `<article class="product-card"><img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='/images/techkjop-placeholder.svg'"><div><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description || "")}</p><strong>${price}</strong><p>Merchant: ${escapeHtml(offer?.store || p.store || "")}</p>${offer ? `<a href="${escapeHtml(offer.url)}" target="_blank" rel="${rel}">View Deal</a>` : ""}</div></article>`;
    }).join("");
  }
  search.addEventListener("input", render);
  fetch("/products.json", {cache:"no-store"}).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { products = Array.isArray(data) ? data : []; render(); }).catch(() => { status.textContent = "Products could not be loaded. Please try again later."; });
})();
