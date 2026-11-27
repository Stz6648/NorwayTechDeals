// Minimal .xlsx reader (first sheet only), no dependencies.
const zlib = require('zlib');

function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip file');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const files = {};
  for (let i = 0; i < n; i++) {
    const meth = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20);
    const fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + fl).toString('utf8');
    files[name] = () => {
      const lfl = buf.readUInt16LE(off + 26), lxl = buf.readUInt16LE(off + 28);
      const d = buf.slice(off + 30 + lfl + lxl, off + 30 + lfl + lxl + cs);
      return (meth === 0 ? d : zlib.inflateRawSync(d)).toString('utf8');
    };
    p += 46 + fl + xl + cl;
  }
  return files;
}

const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Returns array of rows; each row is {A: value, B: value, ...}
function readSheet(buf) {
  const f = unzip(buf);
  const strs = f['xl/sharedStrings.xml']
    ? [...f['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')))
    : [];
  const sheetName = Object.keys(f).find(k => /^xl\/worksheets\/sheet1\.xml$/.test(k)) || Object.keys(f).find(k => /^xl\/worksheets\/.*\.xml$/.test(k));
  const sh = f[sheetName]();
  const rows = [];
  for (const m of sh.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/);
      let val = v ? v[1] : '';
      if (/t="s"/.test(c[2])) val = strs[+val];
      else if (/t="inlineStr"/.test(c[2])) val = dec(((c[3] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
      else val = dec(val);
      row[c[1]] = val;
    }
    rows.push(row);
  }
  return rows;
}

// Excel serial date -> YYYY-MM-DD
function excelDate(n) {
  n = Number(n);
  if (!isFinite(n) || n < 1000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
}

module.exports = { readSheet, excelDate };
