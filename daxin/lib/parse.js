// Parsers for HKEX documents. Input is plain text extracted with pdf.js
// (items joined by " ", line ends by "\n"). Pure functions, no I/O, so the same code
// can be pasted into a browser console for testing.

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const DATE_RE = '(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2}),?\\s+(\\d{4})';

function isoDate(mon, d, y) {
  const m = MONTHS[String(mon).toLowerCase()];
  if (!m) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
// Also accepts "27 November 2026"
function findDate(s) {
  if (!s) return null;
  let m = s.match(new RegExp(DATE_RE));
  if (m) return isoDate(m[1], m[2], m[3]);
  m = s.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/);
  if (m) return isoDate(m[2], m[1], m[3]);
  return null;
}
const num = s => (s == null ? null : (v => (isFinite(v) ? v : null))(parseFloat(String(s).replace(/,/g, ''))));
const norm = t => t.replace(/[ \s]+/g, ' ').replace(/(?:\.\s?){4,}/g, ' … ').replace(/…(\s*…)+/g, '…');

function parseAllotment(txt) {
  const t = norm(txt);
  const r = {};
  let m;
  if ((m = t.match(/Stock code\s*:?\s*(\d{3,5})/i))) r.code = m[1].padStart(5, '0');
  if ((m = t.match(/Stock short name\s*:?\s*(.+?)\s+Dealings/i))) r.shortName = m[1].trim();
  if ((m = t.match(/Dealings commencement date\s*:?\s*(.{0,40})/i))) r.listDate = findDate(m[1]);
  if ((m = t.match(/(?:Final\s+)?Offer Price\s*:?\s*HK\$\s?([\d,]+(?:\.\d+)?)/i))) r.offerPrice = num(m[1]);
  if ((m = t.match(/No\.? of valid applications\s*:?\s*([\d,]+)/i))) r.hkApps = num(m[1]);
  if ((m = t.match(/No\.? of successful applications\s*:?\s*([\d,]+)/i))) r.hkSuccessful = num(m[1]);
  const subs = [...t.matchAll(/Subscription\s+level\s*:?\s*([\d,]+(?:\.\d+)?)\s*times/gi)].map(x => num(x[1]));
  if (subs.length) r.hkSubscription = subs[0];
  if (subs.length > 1) r.intlSubscription = subs[1];
  if ((m = t.match(/No\.? of placees\s*:?\s*([\d,]+)/i))) r.placees = num(m[1]);
  if ((m = t.match(/Number of Offer Shares \(before exercise of (?:the )?Over-allotment Option\)\s*:?\s*([\d,]+)/i))) r.offerShares = num(m[1]);
  if ((m = t.match(/Final no\.? of Offer Shares under the Hong Kong Public Offering\s*:?\s*([\d,]+)/i))) r.hkShares = num(m[1]);
  if ((m = t.match(/% of Offer Shares under the Hong Kong Public Offering to the Global Offering[^%]{0,120}?\)?\s*([\d.]+)%/i))) r.hkPct = num(m[1]);

  // Basis of allocation, first row of pool A = one board lot
  const b = t.search(/BASIS OF ALLO(?:CATION|TMENT) UNDER THE HONG KONG PUBLIC OFFER/i);
  if (b >= 0) {
    const seg = t.slice(b, b + 6000);
    const pa = seg.search(/POOL A/i);
    const rows = seg.slice(pa >= 0 ? pa : 0);
    m = rows.match(/(?:POOL A\s+)?([\d,]+)\s+([\d,]+)\s+(.{3,160}?)\s+([\d.]+)\s*%/i);
    if (m) {
      r.boardLot = num(m[1]);
      r.oneLotApps = num(m[2]);
      const basis = m[3];
      const o = basis.match(/([\d,]+)\s+out of\s+([\d,]+)/i);
      if (o) r.oneLotRate = num(o[1]) / num(o[2]);
      else if (/Shares/i.test(basis)) r.oneLotRate = 1;
      r.oneLotBasis = basis.trim();
    }
  }
  return r;
}

function parseFormalNotice(txt) {
  const t = norm(txt);
  const r = {};
  let m;
  if ((m = t.match(/Stock code\s*:?\s*(\d{3,5})/i))) r.code = m[1].padStart(5, '0');
  if ((m = t.match(/issued by\s+(.{2,120}?)\s*\(\s*\)?\s*\(?the\s*["“]\s*Company/i))) r.nameEn = m[1].replace(/[\s(]+$/, '').trim();
  if ((m = t.match(/Maximum Offer Price\s*:?\s*HK\$\s?([\d,]+(?:\.\d+)?)/i))) r.priceMax = num(m[1]);
  if ((m = t.match(/not (?:be )?(?:expected to be )?less than HK\$\s?([\d,]+(?:\.\d+)?)/i))) r.priceMin = num(m[1]);
  if (!r.priceMax && (m = t.match(/Offer Price\s*:\s*HK\$\s?([\d,]+(?:\.\d+)?)/i))) { r.priceMax = num(m[1]); r.priceMin = r.priceMax; }
  if ((m = t.match(/board lots? of\s+([\d,]+)/i))) r.boardLot = num(m[1]);
  if ((m = t.match(/total of HK\$\s?([\d,]+(?:\.\d+)?)\s+for one board lot/i))) r.entryFee = num(m[1]);
  if ((m = t.match(/Number of Hong Kong Offer Shares\s*:?\s*([\d,]+)/i))) r.hkShares = num(m[1]);
  if ((m = t.match(/Number of (?:the )?Offer Shares under the Global Offering\s*:?\s*([\d,]+)/i))) r.offerShares = num(m[1]);
  if ((m = t.match(/Public Offering commences.{0,80}/i))) r.openDate = findDate(m[0]);
  if ((m = t.match(/Application lists (?:of the Hong Kong Public Offering )?close.{0,80}/i))) r.closeDate = findDate(m[0]);
  if (!r.closeDate && (m = t.match(/Application lists (?:of the Hong Kong Public Offering )?open.{0,80}/i))) r.closeDate = findDate(m[0]);
  if ((m = t.match(/(?:Announcement of the final Offer Price|results of allocations?).{0,400}?(?:on|before)\s+\w+day,?\s+.{0,25}/i))) r.resultDate = findDate(m[0].slice(-40));
  m = t.match(/[Dd]ealings in (?:our |the )?(?:H )?Shares on the (?:Hong Kong )?Stock Exchange (?:are )?(?:will |expected to )?commence.{0,120}/);
  if (m) r.listDate = findDate(m[0]);
  if (!r.listDate && (m = t.match(/will commence at .{0,40}?on\s+\w+day,?\s+.{0,25}/i))) r.listDate = findDate(m[0]);
  return r;
}

if (typeof module !== 'undefined') module.exports = { parseAllotment, parseFormalNotice, findDate, norm };
