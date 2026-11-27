#!/usr/bin/env node
// Collects Hong Kong IPO data from official HKEX sources (and Yahoo Finance for prices)
// and writes daxin/data/ipos.json. Runs in GitHub Actions (needs network + npm deps).
//
// Sources:
//  1. HKEX New Listing Report (yearly .xlsx): code, name, dates, sponsors, funds raised, offer price
//  2. HKEXnews title search: "Allotment Results" announcements -> subscription level, one-lot success rate
//  3. HKEXnews title search: "Formal Notice" -> price range, board lot, timetable of upcoming IPOs
//  4. HKEX daily quotations (last ~2 months) and Yahoo Finance chart API -> first-day and latest prices
const fs = require('fs');
const path = require('path');
const { readSheet, excelDate } = require('./lib/xlsx');
const { parseAllotment, parseFormalNotice } = require('./lib/parse');

const DATA = path.join(__dirname, 'data');
const CACHE = path.join(DATA, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

const UA = 'Mozilla/5.0 (compatible; daxinbang-bot/1.0; +https://hkdaxinbang.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
const YEARS = (process.env.DAXIN_YEARS || '2024,2025,' + today.slice(0, 4)).split(',').map(Number);
const log = (...a) => console.log('[daxin]', ...a);

async function get(url, type = 'text', tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-HK,en;q=0.8' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (type === 'buf') return Buffer.from(await r.arrayBuffer());
      if (type === 'json') return await r.json();
      return await r.text();
    } catch (e) {
      if (i === tries) { log('FAIL', url, e.message); return null; }
      await sleep(1500 * i);
    }
  }
}
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));

// ---------- PDF text ----------
let pdfjs;
async function pdfText(url, maxPages = 999) {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buf = await get(url, 'buf');
  if (!buf) return null;
  const base = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf), cMapUrl: path.join(base, 'cmaps') + '/', cMapPacked: true,
    standardFontDataUrl: path.join(base, 'standard_fonts') + '/', useSystemFonts: false, verbosity: 0,
  }).promise;
  let txt = '';
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    txt += '\n=== P' + i + '\n' + c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('');
  }
  await doc.destroy();
  return txt;
}

// ---------- 1. New Listing Report ----------
const parseDMY = s => { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const toDate = v => excelDate(v) || parseDMY(v);

async function newListingReport(year) {
  const out = [];
  for (const [board, dir] of [['main', 'Main'], ['gem', 'GEM']]) {
    const url = `https://www2.hkexnews.hk/-/media/HKEXnews/Homepage/New-Listings/New-Listing-Information/New-Listing-Report/${dir}/NLR${year}_Chi.xlsx`;
    const buf = await get(url, 'buf');
    if (!buf) { log('no NLR', board, year); continue; }
    let rows;
    try { rows = readSheet(buf); } catch (e) { log('bad NLR', board, year, e.message); continue; }
    let cur = null;
    for (const r of rows) {
      if (/^\d+$/.test(String(r.A || '').trim()) && /\d/.test(r.B || '')) {
        cur = {
          code: String(r.B).trim().padStart(5, '0'), board,
          name: String(r.C || '').replace(/\s+/g, ' ').trim(),
          prospectusDate: toDate(r.D), listDate: toDate(r.E),
          sponsors: String(r.F || '').split(/\s*\/\s*|\r?\n/).map(s => s.trim()).filter(Boolean),
          auditor: String(r.G || '').replace(/\s+/g, ' ').trim(),
          fundsHK: 0, fundsIntl: 0, offerPrice: parseFloat(r.J) || null,
        };
        const f = parseFloat(r.I) || 0;
        if (/\(b\)/.test(r.K || '')) cur.fundsIntl = f; else cur.fundsHK = f;
        out.push(cur);
      } else if (cur && /^["”]?$/.test(String(r.B || '').trim()) && r.I) {
        const f = parseFloat(r.I) || 0;
        if (/\(b\)/.test(r.K || '')) cur.fundsIntl = f; else if (/\(a\)/.test(r.K || '')) cur.fundsHK = f;
      }
    }
    log('NLR', board, year, out.filter(x => x.board === board).length);
  }
  for (const x of out) x.offerPrice = x.offerPrice ? +x.offerPrice.toFixed(4) : null;
  return out;
}

// ---------- 2/3. HKEXnews title search ----------
const ymd = d => d.replace(/-/g, '');
async function titleSearch(t2code, from, to) {
  const res = [];
  // query month by month to keep result pages small
  let start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (start <= end) {
    const stop = new Date(Math.min(end, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))));
    const url = 'https://www1.hkexnews.hk/search/titleSearchServlet.do?sortDir=0&sortByOptions=DateTime&category=0&market=SEHK&stockId=-1&documentType=-1'
      + `&fromDate=${ymd(start.toISOString().slice(0, 10))}&toDate=${ymd(stop.toISOString().slice(0, 10))}&title=&searchType=1&t1code=10000&t2Gcode=5&t2code=${t2code}&rowRange=500&lang=en`;
    const j = await get(url, 'json');
    if (j && j.result && j.result !== 'null') res.push(...JSON.parse(j.result));
    await sleep(400);
    start = new Date(Date.UTC(stop.getUTCFullYear(), stop.getUTCMonth() + 1, 1));
  }
  return res.map(x => ({
    id: x.NEWS_ID, code: String(x.STOCK_CODE || '').split(/<br\s*\/?>/)[0].trim().padStart(5, '0'), short: String(x.STOCK_NAME || '').split(/<br\s*\/?>/)[0].trim(),
    title: String(x.TITLE || '').replace(/\s+/g, ' ').trim(), date: x.DATE_TIME,
    url: 'https://www1.hkexnews.hk' + x.FILE_LINK,
  }));
}

async function parsedDocs(kind, list, parser, maxPages) {
  const cacheFile = path.join(CACHE, kind + '.json');
  const cache = readJson(cacheFile, {});
  let n = 0;
  for (const d of list) {
    if (cache[d.id]) continue;
    try {
      const txt = await pdfText(d.url, maxPages);
      cache[d.id] = txt ? { ...parser(txt), _code: d.code, _short: d.short, _date: d.date, _url: d.url } : { _failed: true, _code: d.code };
      n++;
      if (n % 10 === 0) writeJson(cacheFile, cache);
    } catch (e) {
      log(kind, 'parse error', d.code, e.message);
    }
    await sleep(500);
  }
  writeJson(cacheFile, cache);
  log(kind, 'new docs parsed:', n, 'total cached:', Object.keys(cache).length);
  return cache;
}

// ---------- 4. Prices ----------
const quotePages = {};
async function dailyQuote(dateISO, code) {
  const cacheFile = path.join(CACHE, 'quotes.json');
  const cache = readJson(cacheFile, {});
  const key = dateISO + ':' + code;
  if (key in cache) return cache[key];
  const d = dateISO.slice(2).replace(/-/g, '');
  if (!(d in quotePages)) {
    const raw = await get(`https://www.hkex.com.hk/eng/stat/smstat/dayquot/d${d}e.htm`);
    quotePages[d] = raw ? raw.replace(/<[^>]+>/g, ' ') : null;
  }
  const html = quotePages[d];
  let q = null;
  if (html) {
    const c = String(Number(code));
    // Two-line record: CODE NAME CUR PRV.CLO ASK HIGH SHARES / CLOSING BID LOW TURNOVER
    const re = new RegExp('(?:^|\\n|\\s)\\*?\\s*' + c + '\\s+\\S.{0,24}?\\s+HKD\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+([\\d,]+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+([\\d,]+)');
    const m = html.match(re);
    if (m) {
      const f = s => (isFinite(parseFloat(s.replace(/,/g, ''))) ? parseFloat(s.replace(/,/g, '')) : null);
      q = { high: f(m[3]), close: f(m[5]), low: f(m[7]), volume: f(m[4]), turnover: f(m[8]), src: 'hkex' };
      if (q.close == null || q.close === 0) q = null;
    }
    cache[key] = q;
    writeJson(cacheFile, cache);
  }
  return q;
}

async function yahoo(code, fromISO, toISO) {
  const sym = String(Number(code)).padStart(4, '0') + '.HK';
  const p1 = Math.floor(new Date(fromISO + 'T00:00:00Z') / 1000), p2 = Math.floor(new Date(toISO + 'T23:59:59Z') / 1000);
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&period1=${p1}&period2=${p2}&events=split`, 'json', 2);
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r) return null;
  const q = (r.indicators.quote || [])[0] || {};
  const rows = (r.timestamp || []).map((t, i) => ({ date: new Date((t + 8 * 3600) * 1000).toISOString().slice(0, 10), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] })).filter(x => x.close != null);
  // Yahoo prices are split-adjusted; factor converts today's share count back to listing-day shares
  let splitFactor = 1;
  for (const s of Object.values((r.events && r.events.splits) || {})) {
    const d = new Date((s.date + 8 * 3600) * 1000).toISOString().slice(0, 10);
    if (d > fromISO && s.numerator && s.denominator) splitFactor *= s.numerator / s.denominator;
  }
  return { rows, splitFactor, last: r.meta && r.meta.regularMarketPrice, lastTime: r.meta && r.meta.regularMarketTime };
}

// ---------- merge ----------
async function main() {
  const prev = readJson(path.join(DATA, 'ipos.json'), { ipos: [] });
  const prevByKey = Object.fromEntries((prev.ipos || []).map(x => [x.code + '|' + (x.listDate || ''), x]));

  // 1. listed IPOs
  let listed = [];
  for (const y of YEARS) { listed.push(...await newListingReport(y)); await sleep(500); }
  // drop duplicates (same code + listDate)
  const seen = new Set();
  listed = listed.filter(x => { const k = x.code + '|' + x.listDate; if (seen.has(k)) return false; seen.add(k); return true; });

  // 2. allotment results (IPO ones only)
  const from = `${Math.min(...YEARS)}-01-01`;
  const allot = (await titleSearch(15100, from, today)).filter(d => /allotment results/i.test(d.title) && !/rights issue|open offer|placing of new|bonus/i.test(d.title));
  const allotCache = await parsedDocs('allotment', allot, parseAllotment, 999);
  const allotByCode = {};
  for (const [id, a] of Object.entries(allotCache)) {
    if (a._failed) continue;
    const code = a.code || a._code;
    (allotByCode[code] = allotByCode[code] || []).push({ id, ...a });
  }

  // 3. formal notices of the last 120 days (prices, timetable)
  const fromFN = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const fns = await titleSearch(15200, fromFN, today);
  const fnCache = await parsedDocs('formal', fns, parseFormalNotice, 14);
  const fnByCode = {};
  for (const [id, f] of Object.entries(fnCache)) {
    if (f._failed) continue;
    const code = f.code || f._code;
    const cur = fnByCode[code];
    if (!cur || Number(id) > Number(cur.id)) fnByCode[code] = { id, ...f };
  }

  // pick the allotment doc closest to the listing date
  const pickAllot = (code, listDate) => {
    const arr = allotByCode[code] || [];
    if (!arr.length) return null;
    if (!listDate) return arr.sort((a, b) => Number(b.id) - Number(a.id))[0];
    const t = new Date(listDate);
    return arr.slice().sort((a, b) => Math.abs(new Date(a.listDate || 0) - t) - Math.abs(new Date(b.listDate || 0) - t))[0];
  };

  const ipos = [];
  for (const x of listed) {
    const a = pickAllot(x.code, x.listDate);
    const ok = a && (!a.listDate || !x.listDate || Math.abs(new Date(a.listDate) - new Date(x.listDate)) < 20 * 86400000);
    const f = fnByCode[x.code];
    const fOk = f && f.listDate && x.listDate && Math.abs(new Date(f.listDate) - new Date(x.listDate)) < 20 * 86400000;
    const o = { ...x, status: 'listed' };
    if (ok) Object.assign(o, {
      shortEn: a.shortName || a._short, hkApps: a.hkApps, hkSuccessful: a.hkSuccessful, hkSubscription: a.hkSubscription,
      intlSubscription: a.intlSubscription, placees: a.placees, boardLot: a.boardLot, oneLotApps: a.oneLotApps,
      oneLotRate: a.oneLotRate, oneLotBasis: a.oneLotBasis, allotmentUrl: a._url,
    });
    if (fOk) Object.assign(o, { priceMin: f.priceMin, priceMax: f.priceMax || f.priceMin, boardLot: o.boardLot || f.boardLot, entryFee: f.entryFee, openDate: f.openDate, closeDate: f.closeDate, formalUrl: f._url, shortEn: o.shortEn || f._short });
    const old = prevByKey[o.code + '|' + o.listDate];
    if (old && old.firstSrc === 'hkex') for (const k of ['firstClose', 'firstHigh', 'firstLow', 'firstSrc']) if (o[k] == null && old[k] != null) o[k] = old[k];
    ipos.push(o);
  }

  // upcoming / subscribing: formal notices whose listing date is not yet in the report
  const listedCodes = new Set(ipos.filter(x => x.listDate && x.listDate >= fromFN).map(x => x.code));
  for (const f of Object.values(fnByCode)) {
    if (listedCodes.has(f.code || f._code)) continue;
    if (!f.listDate || f.listDate < new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)) continue;
    const code = f.code || f._code;
    const a = pickAllot(code, f.listDate);
    const aOk = a && a.listDate === f.listDate;
    const nm = String(f.nameEn || '');
    const zh = (nm.match(/[(（]\s*([\u3400-\u9fff][\u3400-\u9fff\s（）()]*?)\s*[)）]\s*$/) || [])[1];
    ipos.push({
      code, board: 'main', name: zh ? zh.replace(/\s+/g, '') : (nm.replace(/\s*[(（][^)）]*[)）]?\s*$/, '').trim() || f._short), nameEnFull: nm.replace(/\s*[(（][^)）]*[)）]?\s*$/, '').trim(), shortEn: f._short, listDate: f.listDate,
      priceMin: f.priceMin, priceMax: f.priceMax || f.priceMin, boardLot: f.boardLot, entryFee: f.entryFee,
      openDate: f.openDate, closeDate: f.closeDate, formalUrl: f._url, sponsors: [],
      status: f.listDate > today ? (f.closeDate && f.closeDate < today ? 'pending' : 'subscribing') : 'listed',
      ...(aOk ? { offerPrice: a.offerPrice, hkApps: a.hkApps, hkSubscription: a.hkSubscription, intlSubscription: a.intlSubscription, oneLotRate: a.oneLotRate, oneLotApps: a.oneLotApps, boardLot: a.boardLot || f.boardLot, allotmentUrl: a._url } : {}),
    });
  }

  // 4. prices
  let yq = 0;
  for (const o of ipos) {
    if (!o.listDate || o.listDate > today) continue;
    if (o.firstClose == null) {
      const q = await dailyQuote(o.listDate, o.code);
      if (q) Object.assign(o, { firstClose: q.close, firstHigh: q.high, firstLow: q.low, firstSrc: 'hkex' });
      await sleep(200);
    }
    if (o.firstClose == null || !o.lastDate || o.lastDate < today) {
      const y = await yahoo(o.code, o.listDate, today);
      yq++;
      if (y) {
        const f = y.splitFactor || 1;
        o.splitFactor = f !== 1 ? +f.toFixed(6) : undefined;
        const first = y.rows[0];
        const sane = v => v && o.offerPrice && v / o.offerPrice < 8 && v / o.offerPrice > 0.1;
        if (o.firstClose == null && first && first.date === o.listDate && sane(first.close * f))
          Object.assign(o, { firstClose: +(first.close * f).toFixed(3), firstHigh: +(first.high * f).toFixed(3), firstLow: +(first.low * f).toFixed(3), firstSrc: 'yahoo' });
        if (first && first.date === o.listDate && first.open && sane(first.open * f)) o.firstOpen = +(first.open * f).toFixed(3);
        if (y.last) { o.lastPrice = +(+y.last).toFixed(3); o.lastDate = y.lastTime ? new Date((y.lastTime + 8 * 3600) * 1000).toISOString().slice(0, 10) : today; }
      }
      await sleep(300);
    }
  }
  log('yahoo queries', yq);

  // simplified-Chinese names
  try {
    const OpenCC = require('opencc-js');
    const conv = OpenCC.Converter({ from: 'hk', to: 'cn' });
    for (const o of ipos) if (o.name && /[一-鿿]/.test(o.name)) o.nameS = conv(o.name);
    for (const o of ipos) if (o.sponsors) o.sponsorsS = o.sponsors.map(s => (/[一-鿿]/.test(s) ? conv(s) : s));
  } catch (e) { log('opencc unavailable', e.message); }

  ipos.sort((a, b) => String(b.listDate || '').localeCompare(String(a.listDate || '')));
  writeJson(path.join(DATA, 'ipos.json'), { updated: new Date().toISOString(), count: ipos.length, ipos });
  log('done', ipos.length, 'ipos;', ipos.filter(x => x.status !== 'listed').length, 'upcoming;', ipos.filter(x => x.hkSubscription != null).length, 'with allotment data;', ipos.filter(x => x.firstClose != null).length, 'with first-day price');
}

main().catch(e => { console.error(e); process.exit(1); });
