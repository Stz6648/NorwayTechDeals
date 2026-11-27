#!/usr/bin/env node
// Builds the static site hkdaxinbang.com from data/ipos.json into public/. No dependencies.
const fs = require('fs');
const path = require('path');
const cfg = require('./site.config.json');
const guides = require('./content/guides.js');

const OUT = path.join(__dirname, 'public');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ipos.json'), 'utf8'));
const TODAY = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Hong Kong date
const ipos = data.ipos.filter(x => x.code && x.listDate);

// ---------- helpers ----------
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n, d = 2) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const int = n => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (n, d = 1) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(d) + '%');
const cnDate = d => (d ? `${+d.slice(0, 4)}年${+d.slice(5, 7)}月${+d.slice(8, 10)}日` : '—');
const md = d => (d ? `${+d.slice(5, 7)}月${+d.slice(8, 10)}日` : '—');
const yi = n => (n == null || !n ? '—' : n >= 1e8 ? (n / 1e8).toFixed(2) + ' 亿港元' : (n / 1e4).toFixed(0) + ' 万港元');
const times = n => (n == null ? '—' : n >= 100 ? int(n) + ' 倍' : fmt(n, 2) + ' 倍');
const nameOf = x => x.nameS || x.name || x.shortEn || x.code;
const shortName = x => {
  let n = nameOf(x).replace(/\s*-\s*[A-Z]\s*(?=-|$)/g, '').replace(/\s*-\s*H\s*股\s*$/i, '').replace(/\s*-\s*H\s*股/i, '');
  n = n.replace(/(股份有限公司|有限责任公司|有限公司|股份有限公司|集团股份有限公司)$/, '').replace(/[（(].*?[)）]/g, '').trim();
  if (/^[\x00-\x7f]+$/.test(n)) n = n.replace(/,?\s*\b(Co\.?,?\s*Ltd\.?|Company Limited|Limited|Ltd\.?|Inc\.?|Corporation|Corp\.?|Holdings?|Group)(?=\s|$|,)/gi, '').replace(/[\s,.]+$/, '').replace(/\s+/g, ' ').trim();
  return n || x.code;
};
const tags = x => {
  const t = [], n = x.name || '';
  if (/-\s*B\b/.test(n)) t.push(['B', '生物科技']);
  if (/-\s*W\b/.test(n)) t.push(['W', '同股不同权']);
  if (/-\s*P\b/.test(n)) t.push(['P', '未商业化']);
  if (/-\s*S\b/.test(n)) t.push(['S', '第二上市']);
  if (/H\s*股/.test(n)) t.push(['H', 'H股']);
  if (x.board === 'gem') t.push(['GEM', '创业板']);
  return t;
};
const firstChg = x => (x.firstClose != null && x.offerPrice ? x.firstClose / x.offerPrice - 1 : null);
const lastChg = x => (x.lastPrice != null && x.offerPrice ? (x.lastPrice * (x.splitFactor || 1)) / x.offerPrice - 1 : null);
const chg = (v, d = 1) => (v == null ? '<span class="mut">—</span>' : `<span class="${v > 0.0005 ? 'up' : v < -0.0005 ? 'dn' : 'flat'}">${v > 0.0005 ? '▲' : v < -0.0005 ? '▼' : ''}${(Math.abs(v) * 100).toFixed(d)}%</span>`);
const slug = x => `${x.code}-${(x.listDate || '').slice(0, 4)}`;
const url = x => `/ipo/${slug(x)}/`;
const sponsorsOf = x => (x.sponsorsS && x.sponsorsS.length ? x.sponsorsS : x.sponsors || []).filter(s => !/^(不適用|不适用)$/.test(s));
const entryFee = x => x.entryFee || (x.boardLot && (x.priceMax || x.offerPrice) ? x.boardLot * (x.priceMax || x.offerPrice) * 1.010085 : null);
const priceRange = x => (x.priceMin && x.priceMax && x.priceMin !== x.priceMax ? `${fmt(x.priceMin)} – ${fmt(x.priceMax)}` : fmt(x.priceMax || x.priceMin || x.offerPrice));

function write(rel, html) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}

// ---------- layout ----------
const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mut:#6b7280;--line:#e5e7eb;--brand:#c8102e;--brand2:#8f0b20;--up:#0a8a4b;--dn:#d32f2f;--chip:#f1f2f4}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1115;--card:#171a20;--ink:#e8eaee;--mut:#9aa3af;--line:#2a2f38;--chip:#222730;--up:#2fbf71;--dn:#ff6b6b}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
header.top{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
header.top .wrap{display:flex;align-items:center;gap:18px;height:56px}
.logo{font-weight:800;font-size:20px;color:var(--ink);letter-spacing:.5px;white-space:nowrap}.logo b{color:var(--brand)}
nav.main{display:flex;gap:14px;overflow-x:auto;font-size:15px;scrollbar-width:none}nav.main a{color:var(--mut);white-space:nowrap}nav.main a.on,nav.main a:hover{color:var(--ink);text-decoration:none}
main{padding:22px 0 40px}
h1{font-size:26px;line-height:1.3;margin:6px 0 6px}h2{font-size:20px;margin:30px 0 12px}h3{font-size:17px;margin:0 0 6px}
.lead{color:var(--mut);margin:0 0 18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.stat .k{font-size:13px;color:var(--mut)}.stat .v{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.ipo-card h3 a{color:var(--ink)}.ipo-card .code{color:var(--mut);font-size:13px;margin-left:6px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:14px;margin-top:8px}.kv dt{color:var(--mut)}.kv dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.badge{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;background:var(--chip);color:var(--mut);margin-right:4px;vertical-align:2px}
.badge.live{background:var(--brand);color:#fff}.badge.wait{background:#f59e0b;color:#fff}
.tbl-wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left;position:sticky;left:0;background:var(--card)}
th{font-weight:600;color:var(--mut);font-size:13px;background:var(--card);cursor:default}th[data-k]{cursor:pointer}
tr:last-child td{border-bottom:0}td .sub{display:block;color:var(--mut);font-size:12px}
.up{color:var(--up);font-weight:600}.dn{color:var(--dn);font-weight:600}.flat,.mut{color:var(--mut)}
.note{font-size:13px;color:var(--mut)}
.disc{font-size:13px;color:var(--mut);border-top:1px solid var(--line);margin-top:28px;padding-top:14px}
footer{border-top:1px solid var(--line);background:var(--card);padding:20px 0;font-size:13px;color:var(--mut)}footer a{color:var(--mut)}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.filters button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:4px 12px;font:inherit;font-size:14px;cursor:pointer}.filters button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.article{max-width:760px}.article blockquote{margin:12px 0;padding:10px 14px;background:var(--chip);border-radius:8px}
.crumb{font-size:13px;color:var(--mut)}.crumb a{color:var(--mut)}
.para{font-size:16px}
.more{display:inline-block;margin-top:10px;font-size:14px}
@media (max-width:600px){h1{font-size:22px}.stat .v{font-size:20px}}
`;

function layout({ title, desc, canonical, body, active = '', jsonld = null }) {
  const nav = [['/', '首页'], ['/history/', '历史战绩'], ['/sponsors/', '保荐人排行'], ['/guide/', '打新教程']];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.domain}${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${cfg.domain}${canonical}"><meta property="og:locale" content="zh_CN">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23c8102e'/%3E%3Ctext x='32' y='45' font-size='36' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'%3E%E6%96%B0%3C/text%3E%3C/svg%3E">
<style>${CSS}</style>${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">港股<b>打新榜</b></a><nav class="main">${nav.map(([h, t]) => `<a href="${h}"${active === h ? ' class="on"' : ''}>${t}</a>`).join('')}</nav></div></header>
<main><div class="wrap">${body}
<p class="disc">本站数据来自香港交易所披露易的官方公告（招股章程、正式通告、配发结果公告）及公开行情，每天自动更新，可能有延迟或误差，请以官方公告为准。本站只提供资料参考，<strong>不构成任何投资建议</strong>。新股投资有风险，可能损失本金。</p>
</div></main>
<footer><div class="wrap">© ${TODAY.slice(0, 4)} ${cfg.siteNameFull} · <a href="/about/">关于本站</a> · <a href="/guide/">打新教程</a> · 数据更新：${esc((data.updated || '').slice(0, 10))}</div></footer>
</body></html>`;
}

// ---------- pieces ----------
const statusOf = x => {
  if (x.listDate > TODAY) {
    if (x.closeDate && x.closeDate >= TODAY && (!x.openDate || x.openDate <= TODAY)) return 'subscribing';
    if (x.openDate && x.openDate > TODAY) return 'soon';
    return 'pending';
  }
  return 'listed';
};
const upcoming = ipos.filter(x => x.listDate > TODAY).sort((a, b) => a.listDate.localeCompare(b.listDate));
const listed = ipos.filter(x => x.listDate <= TODAY).sort((a, b) => b.listDate.localeCompare(a.listDate) || a.code.localeCompare(b.code));

function upcomingCard(x) {
  const s = statusOf(x);
  const badge = s === 'subscribing' ? '<span class="badge live">招股中</span>' : s === 'soon' ? '<span class="badge">即将招股</span>' : '<span class="badge wait">等待上市</span>';
  return `<div class="card ipo-card"><div>${badge}${tags(x).map(t => `<span class="badge" title="${t[1]}">${t[0]}</span>`).join('')}</div>
<h3 style="margin-top:6px"><a href="${url(x)}">${esc(shortName(x))}</a><span class="code">${x.code}</span></h3>
<dl class="kv"><dt>招股价</dt><dd>${priceRange(x)} 港元</dd><dt>一手</dt><dd>${int(x.boardLot)} 股</dd><dt>入场费</dt><dd>${fmt(entryFee(x))} 港元</dd>
<dt>截止认购</dt><dd>${md(x.closeDate)}</dd><dt>上市日期</dt><dd>${md(x.listDate)}</dd>${x.hkSubscription != null ? `<dt>公开认购</dt><dd>${times(x.hkSubscription)}</dd><dt>一手中签率</dt><dd>${pct(x.oneLotRate, 2)}</dd>` : ''}</dl></div>`;
}

function listedRow(x, withYear = false) {
  return `<tr data-y="${x.listDate.slice(0, 4)}"><td><a href="${url(x)}">${esc(shortName(x))}</a><span class="sub">${x.code}${tags(x).length ? ' · ' + tags(x).map(t => t[0]).join(' ') : ''}</span></td>
<td data-v="${x.listDate}">${withYear ? x.listDate : md(x.listDate)}</td><td data-v="${x.offerPrice || ''}">${fmt(x.offerPrice)}</td>
<td data-v="${x.hkSubscription ?? ''}">${times(x.hkSubscription)}</td><td data-v="${x.oneLotRate ?? ''}">${pct(x.oneLotRate, 2)}</td>
<td data-v="${firstChg(x) ?? ''}">${chg(firstChg(x))}</td><td data-v="${lastChg(x) ?? ''}">${chg(lastChg(x))}</td></tr>`;
}
const listedHead = sortable => `<thead><tr><th${sortable ? ' data-k="0" data-t="s"' : ''}>新股</th><th${sortable ? ' data-k="1" data-t="s"' : ''}>上市日期</th><th${sortable ? ' data-k="2"' : ''}>发售价</th><th${sortable ? ' data-k="3"' : ''}>公开认购倍数</th><th${sortable ? ' data-k="4"' : ''}>一手中签率</th><th${sortable ? ' data-k="5"' : ''}>首日涨跌</th><th${sortable ? ' data-k="6"' : ''}>至今涨跌</th></tr></thead>`;

function yearStats(list) {
  const withFirst = list.filter(x => firstChg(x) != null);
  const ups = withFirst.filter(x => firstChg(x) > 0.0005).length;
  const breaks = withFirst.filter(x => firstChg(x) < -0.0005).length;
  const avg = withFirst.length ? withFirst.reduce((s, x) => s + firstChg(x), 0) / withFirst.length : null;
  const funds = list.reduce((s, x) => s + (x.fundsHK || 0) + (x.fundsIntl || 0), 0);
  return { n: list.length, nFirst: withFirst.length, upRate: withFirst.length ? ups / withFirst.length : null, breakRate: withFirst.length ? breaks / withFirst.length : null, avg, funds };
}

// ---------- home ----------
function home() {
  const y = TODAY.slice(0, 4);
  const st = yearStats(listed.filter(x => x.listDate.startsWith(y)));
  const recent = listed.slice(0, 20);
  const body = `<h1>港股打新榜</h1><p class="lead">${cfg.tagline}。正在招股的新股、认购倍数、一手中签率、首日表现，全部来自港交所官方公告。</p>
<h2>正在招股 / 即将上市</h2>
${upcoming.length ? `<div class="grid">${upcoming.map(upcomingCard).join('')}</div>` : '<div class="card">目前没有正在招股的新股。新股公告一般在招股第一天早上刊发，本站每天自动更新。</div>'}
<h2>${y}年港股新股概况</h2>
<div class="stats"><div class="card stat"><div class="k">已上市新股</div><div class="v">${st.n} 只</div></div>
<div class="card stat"><div class="k">首日上涨比例</div><div class="v">${pct(st.upRate, 0)}</div></div>
<div class="card stat"><div class="k">首日破发比例</div><div class="v">${pct(st.breakRate, 0)}</div></div>
<div class="card stat"><div class="k">平均首日涨幅</div><div class="v">${chg(st.avg)}</div></div>
<div class="card stat"><div class="k">总集资额</div><div class="v">${st.funds ? (st.funds / 1e8).toFixed(0) + ' 亿' : '—'}</div></div></div>
<p class="note">首日涨跌按首日收市价对比发售价计算，统计其中有首日行情数据的 ${st.nFirst} 只新股。</p>
<h2>最近上市</h2>
<div class="tbl-wrap"><table>${listedHead(false)}<tbody>${recent.map(x => listedRow(x)).join('')}</tbody></table></div>
<a class="more" href="/history/">查看全部历史战绩 →</a>
<h2>打新教程</h2><div class="grid">${guides.map(g => `<div class="card"><h3><a href="/guide/${g.slug}/">${esc(g.title)}</a></h3><div class="note">${esc(g.desc)}</div></div>`).join('')}</div>`;
  write('index.html', layout({ title: '港股打新榜 - 港股新股认购倍数、一手中签率、首日表现', desc: '港股新股数据每天自动更新：正在招股的新股、招股价和入场费、公开认购倍数、一手中签率、首日涨跌和历史打新战绩。', canonical: '/', body, active: '/',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteNameFull, url: cfg.domain + '/', inLanguage: 'zh-CN' } }));
}

// ---------- IPO pages ----------
function describe(x) {
  const s = statusOf(x), n = shortName(x);
  const parts = [];
  if (s !== 'listed') {
    parts.push(`${n}（${x.code}）${x.openDate ? `于${cnDate(x.openDate)}开始` : ''}招股，招股价${priceRange(x)}港元，每手${int(x.boardLot)}股，入场费约${fmt(entryFee(x))}港元。`);
    if (x.closeDate) parts.push(`香港公开发售预计于${cnDate(x.closeDate)}中午截止，`);
    parts.push(`预计于${cnDate(x.listDate)}在港交所${x.board === 'gem' ? '创业板' : '主板'}上市。`);
    if (x.hkSubscription != null) parts.push(`配发结果已公布：香港公开发售获${times(x.hkSubscription).replace(' ', '')}认购，一手中签率约${pct(x.oneLotRate, 2)}。`);
    return parts.join('');
  }
  parts.push(`${n}（${x.code}）于${cnDate(x.listDate)}在港交所${x.board === 'gem' ? '创业板' : '主板'}上市，发售价${fmt(x.offerPrice)}港元`);
  const f = (x.fundsHK || 0) + (x.fundsIntl || 0);
  if (f) parts.push(`，集资额约${yi(f)}`);
  parts.push('。');
  if (x.hkSubscription != null) parts.push(`香港公开发售获${times(x.hkSubscription).replace(' ', '')}认购${x.intlSubscription != null ? `，国际配售获${times(x.intlSubscription).replace(' ', '')}认购` : ''}；一手（${int(x.boardLot)}股）中签率约${pct(x.oneLotRate, 2)}。`);
  const fc = firstChg(x);
  if (fc != null) parts.push(`首日收市价${fmt(x.firstClose, 3)}港元，较发售价${fc >= 0 ? '上涨' : '下跌'}${(Math.abs(fc) * 100).toFixed(1)}%。`);
  return parts.join('');
}

function ipoPage(x) {
  const s = statusOf(x);
  const sp = sponsorsOf(x);
  const peers = sp.length ? listed.filter(o => o !== x && sponsorsOf(o).some(p => sp.includes(p))).slice(0, 8) : [];
  const rows = [
    ['股份代号', x.code], ['上市板块', x.board === 'gem' ? '创业板' : '主板'], ['公司名称', esc(nameOf(x))],
    ...(x.shortEn ? [['英文简称', esc(x.shortEn)]] : []),
    ['招股价', priceRange(x) + ' 港元'], ...(x.offerPrice ? [['最终发售价', fmt(x.offerPrice) + ' 港元']] : []),
    ['每手股数', int(x.boardLot) + ' 股'], ['一手入场费', fmt(entryFee(x)) + ' 港元'],
    ['招股日期', x.openDate ? cnDate(x.openDate) : (x.prospectusDate ? cnDate(x.prospectusDate) : '—')], ['截止认购', cnDate(x.closeDate)], ['上市日期', cnDate(x.listDate)],
    ['集资额', yi((x.fundsHK || 0) + (x.fundsIntl || 0))],
  ];
  const res = [
    ['公开认购倍数', times(x.hkSubscription)], ['有效申请人数', int(x.hkApps)], ['中签人数', int(x.hkSuccessful)],
    ['一手中签率', pct(x.oneLotRate, 2)], ['申请一手人数', int(x.oneLotApps)], ['国际配售认购倍数', times(x.intlSubscription)], ['承配人数目', int(x.placees)],
  ];
  const perf = [
    ['首日收市价', x.firstClose != null ? fmt(x.firstClose, 3) + ' 港元' : '—'], ['首日涨跌', chg(firstChg(x), 2)],
    ...(x.firstHigh != null ? [['首日最高 / 最低', `${fmt(x.firstHigh, 3)} / ${fmt(x.firstLow, 3)}`]] : []),
    ['最新价', x.lastPrice != null ? `${fmt(x.lastPrice, 3)} 港元 <span class="note">(${x.lastDate})</span>` : '—'], ['较发售价', chg(lastChg(x), 2)],
  ];
  const kv = arr => `<dl class="kv">${arr.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const docs = [['正式通告', x.formalUrl], ['配发结果公告', x.allotmentUrl]].filter(d => d[1]);
  const title = `${shortName(x)}（${x.code}）新股：${s === 'listed' ? '认购倍数、一手中签率、首日表现' : '招股价、入场费、招股日期'}`;
  const body = `<p class="crumb"><a href="/">首页</a> › <a href="/history/">新股</a> › ${x.code}</p>
<h1>${esc(shortName(x))}（${x.code}）</h1>
<p>${s === 'subscribing' ? '<span class="badge live">招股中</span>' : s === 'pending' ? '<span class="badge wait">等待上市</span>' : s === 'soon' ? '<span class="badge">即将招股</span>' : '<span class="badge">已上市</span>'}${tags(x).map(t => `<span class="badge">${t[0]} · ${t[1]}</span>`).join('')}</p>
<p class="para">${esc(describe(x))}</p>
<div class="grid"><div class="card"><h3>招股资料</h3>${kv(rows)}</div>
<div class="card"><h3>配发结果</h3>${x.hkSubscription != null ? kv(res) : `<p class="note">配发结果一般在上市前一个工作日晚上公布，公布后本页自动更新。</p>`}</div>
<div class="card"><h3>上市表现</h3>${s === 'listed' ? kv(perf) : '<p class="note">上市后显示首日收市价和涨跌。</p>'}</div></div>
${sp.length ? `<h2>保荐人</h2><div class="card">${sp.map(p => `<div>${esc(p)}</div>`).join('')}</div>` : ''}
${docs.length ? `<h2>官方文件</h2><div class="card">${docs.map(d => `<div><a href="${esc(d[1])}" rel="nofollow noopener" target="_blank">${d[0]}（港交所披露易，英文 PDF）</a></div>`).join('')}<p class="note" style="margin:8px 0 0">完整招股章程可在港交所披露易按股份代号 ${x.code} 搜寻。</p></div>` : ''}
${peers.length ? `<h2>同保荐人的其他新股</h2><div class="tbl-wrap"><table>${listedHead(false)}<tbody>${peers.map(o => listedRow(o, true)).join('')}</tbody></table></div>` : ''}`;
  write(`ipo/${slug(x)}/index.html`, layout({ title, desc: describe(x).slice(0, 150), canonical: url(x), body }));
}

// ---------- history ----------
const SORT_JS = `<script>
(function(){var t=document.querySelector('table.sortable');if(!t)return;var tb=t.tBodies[0];
document.querySelectorAll('.filters button').forEach(function(b){b.onclick=function(){document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var y=b.dataset.y;[].forEach.call(tb.rows,function(r){r.style.display=(y==='all'||r.dataset.y===y)?'':'none'});};});
t.querySelectorAll('th[data-k]').forEach(function(th){th.onclick=function(){var k=+th.dataset.k,s=th.dataset.t==='s',d=th.dataset.d=th.dataset.d==='1'?'-1':'1';var rows=[].slice.call(tb.rows);
rows.sort(function(a,b){var x=a.cells[k].dataset.v||a.cells[k].textContent,y=b.cells[k].dataset.v||b.cells[k].textContent;if(!s){x=x===''?-1e18:+x;y=y===''?-1e18:+y;return (x-y)*d}return x.localeCompare(y)*d});rows.forEach(function(r){tb.appendChild(r)});};});})();
</script>`;
function history() {
  const years = [...new Set(listed.map(x => x.listDate.slice(0, 4)))].sort().reverse();
  const statRows = years.map(y => { const s = yearStats(listed.filter(x => x.listDate.startsWith(y))); return `<tr><td>${y}年</td><td>${s.n}</td><td>${pct(s.upRate, 0)}</td><td>${pct(s.breakRate, 0)}</td><td>${chg(s.avg)}</td><td>${s.funds ? (s.funds / 1e8).toFixed(0) + ' 亿' : '—'}</td></tr>`; }).join('');
  const body = `<h1>港股新股历史打新战绩</h1><p class="lead">${years[years.length - 1]}年以来全部港股新股：发售价、公开认购倍数、一手中签率、首日涨跌和至今涨跌。点击表头可以排序。</p>
<div class="tbl-wrap"><table><thead><tr><th>年份</th><th>新股数目</th><th>首日上涨</th><th>首日破发</th><th>平均首日涨幅</th><th>集资额（港元）</th></tr></thead><tbody>${statRows}</tbody></table></div>
<h2>全部新股</h2><div class="filters"><button class="on" data-y="all">全部</button>${years.map(y => `<button data-y="${y}">${y}</button>`).join('')}</div>
<div class="tbl-wrap"><table class="sortable">${listedHead(true)}<tbody>${listed.map(x => listedRow(x, true)).join('')}</tbody></table></div>
<p class="note">首日涨跌 = 首日收市价 ÷ 发售价 − 1；至今涨跌按最近收市价计算。“—”表示暂时没有数据。</p>${SORT_JS}`;
  write('history/index.html', layout({ title: '港股新股历史战绩：认购倍数、一手中签率、首日涨跌一览', desc: '全部港股新股的历史打新数据：发售价、公开认购倍数、一手中签率、首日涨跌、至今涨跌，按年份筛选，可排序。', canonical: '/history/', body, active: '/history/' }));
}

// ---------- sponsors ----------
function sponsors() {
  const map = {};
  for (const x of listed) for (const p of sponsorsOf(x)) (map[p] = map[p] || []).push(x);
  const rows = Object.entries(map).map(([p, list]) => ({ p, list, ...yearStats(list) })).filter(r => r.n >= 3)
    .sort((a, b) => (b.nFirst >= 3) - (a.nFirst >= 3) || (b.upRate ?? -1) - (a.upRate ?? -1) || b.n - a.n);
  const body = `<h1>港股新股保荐人排行</h1><p class="lead">按保荐人统计他们保荐的新股首日表现（只列出保荐 3 只或以上的保荐人）。一只新股可能有多个联席保荐人，会同时计入。</p>
<div class="tbl-wrap"><table class="sortable"><thead><tr><th data-k="0" data-t="s">保荐人</th><th data-k="1">保荐新股</th><th data-k="2">首日上涨比例</th><th data-k="3">首日破发比例</th><th data-k="4">平均首日涨幅</th></tr></thead><tbody>
${rows.map(r => `<tr><td>${esc(r.p)}<span class="sub">最近：${r.list.slice(0, 3).map(x => `<a href="${url(x)}">${esc(shortName(x))}</a>`).join('、')}</span></td><td data-v="${r.n}">${r.n}</td><td data-v="${r.upRate ?? ''}">${pct(r.upRate, 0)}</td><td data-v="${r.breakRate ?? ''}">${pct(r.breakRate, 0)}</td><td data-v="${r.avg ?? ''}">${chg(r.avg)}</td></tr>`).join('')}
</tbody></table></div><p class="note">统计范围：本站收录的全部已上市新股中有首日行情数据的部分。过往表现不代表将来。</p>${SORT_JS}`;
  write('sponsors/index.html', layout({ title: '港股新股保荐人排行：首日上涨比例和平均涨幅', desc: '港股新股保荐人排行榜：每家保荐人保荐的新股数目、首日上涨比例、破发比例和平均首日涨幅。', canonical: '/sponsors/', body, active: '/sponsors/' }));
}

// ---------- guides / about ----------
function guidePages() {
  write('guide/index.html', layout({ title: '港股打新教程', desc: '港股打新入门、一手中签率、暗盘、孖展认购风险，新手必看。', canonical: '/guide/', active: '/guide/',
    body: `<h1>港股打新教程</h1><p class="lead">第一次打新？先把这几篇看完。</p><div class="grid">${guides.map(g => `<div class="card"><h3><a href="/guide/${g.slug}/">${esc(g.title)}</a></h3><div class="note">${esc(g.desc)}</div></div>`).join('')}</div>` }));
  for (const g of guides) write(`guide/${g.slug}/index.html`, layout({ title: g.title, desc: g.desc, canonical: `/guide/${g.slug}/`, active: '/guide/',
    body: `<p class="crumb"><a href="/">首页</a> › <a href="/guide/">打新教程</a></p><article class="article"><h1>${esc(g.title)}</h1>${g.body}</article>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, inLanguage: 'zh-CN' } }));
  write('about/index.html', layout({ title: '关于港股打新榜', desc: '港股打新榜是一个自动更新的港股新股数据网站。', canonical: '/about/',
    body: `<article class="article"><h1>关于本站</h1><p>港股打新榜是一个独立的港股新股数据网站，面向全球的中文投资者。</p>
<h2>数据来源</h2><ul><li>新股名单、上市日期、发售价、保荐人、集资额：香港交易所《新上市报告》</li><li>招股价区间、每手股数、招股时间表：各公司在港交所披露易刊发的正式通告</li><li>认购倍数、中签率：各公司刊发的配发结果公告</li><li>首日及最新股价：港交所每日报价表及公开行情数据</li></ul>
<p>数据由程序每天自动收集整理，可能有延迟或误差。一切以港交所披露易的官方公告为准。</p>
<h2>免责声明</h2><p>本站内容只供参考，不构成任何投资建议或买卖任何证券的邀约。投资涉及风险，新股价格可升可跌，过往表现不代表将来。</p></article>` }));
}

// ---------- sitemap ----------
function sitemap() {
  const urls = ['/', '/history/', '/sponsors/', '/guide/', '/about/', ...guides.map(g => `/guide/${g.slug}/`), ...ipos.map(url)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${cfg.domain}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${cfg.domain}/sitemap.xml\n`);
  write('404.html', layout({ title: '找不到页面 - 港股打新榜', desc: '找不到页面', canonical: '/404.html', body: '<h1>找不到这个页面</h1><p><a href="/">回到首页</a> 或 <a href="/history/">查看历史战绩</a>。</p>' }));
}

fs.rmSync(OUT, { recursive: true, force: true });
home(); history(); sponsors(); guidePages(); for (const x of ipos) ipoPage(x); sitemap();
console.log('[daxin] built', ipos.length, 'IPO pages;', upcoming.length, 'upcoming');
