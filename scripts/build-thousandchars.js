#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let XLSX;
try { XLSX = require('xlsx'); } catch {}

const repoRoot = process.cwd();
const sources = [
  'codefree/1000ja.xlsx',
  'codefree/1000ja.xls',
  'codefree/1000ja.csv',
  'codefree/thousandChars_v1.json',
];

const outPath = path.join(repoRoot, 'codefree', 'thousandChars_v1.json');
const LS_KEY = 'thousandChars_v1';

function fileExists(p) { try { return fs.statSync(path.join(repoRoot, p)).isFile(); } catch { return false; } }
function readJson(p) { return JSON.parse(fs.readFileSync(path.join(repoRoot, p), 'utf-8')); }
function sha(s) { return crypto.createHash('sha1').update(s).digest('hex'); }

function normalizeRow(r) {
  const get = (...keys) => {
    for (const k of keys) { if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim(); }
    return '';
  };
  return {
    ch: get('ch','char','hanja','한자','자','character','Character',0),
    read: get('read','kor','ko','음','독음','음/훈','훈음','reading','Reading',1),
    mean: get('mean','desc','뜻','설명','훈','의미','meaning','Meaning',2),
    group: get('group','grp','묶음','그룹','group','Group',3) || 'import',
  };
}

function readFromExcel(p) {
  if (!XLSX) throw new Error('xlsx module not installed');
  const wb = XLSX.read(fs.readFileSync(path.join(repoRoot, p)), { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) {
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).map(a => ({ 0:a[0],1:a[1],2:a[2],3:a[3] }));
  }
  return rows.map(normalizeRow).filter(x => x.ch && (x.read || x.mean));
}

function readFromCsv(p) { return readFromExcel(p); }

function readFromJson(p) {
  const j = readJson(p);
  const items = Array.isArray(j) ? j : (j.items || j.data || []);
  if (!Array.isArray(items)) return [];
  return items.map(x => normalizeRow(x)).filter(x => x.ch && (x.read || x.mean));
}

function pickSource() {
  for (const s of sources) if (fileExists(s)) return s;
  return null;
}

(async function main(){
  const src = pickSource();
  if (!src) {
    console.log('No source file found; skipping.');
    process.exit(0);
  }
  let items = [];
  try {
    if (/\.xlsx?$/.test(src)) items = readFromExcel(src);
    else if (/\.csv$/.test(src)) items = readFromCsv(src);
    else items = readFromJson(src);
  } catch (e) {
    console.error('Failed to read source', src, e.message);
    process.exit(1);
  }
  if (!items.length) { console.log('No items parsed; skipping.'); process.exit(0); }
  const payload = { key: LS_KEY, items, generatedAt: new Date().toISOString() };
  const next = JSON.stringify(payload, null, 2);
  let prev = '';
  if (fileExists('codefree/thousandChars_v1.json')) prev = fs.readFileSync(outPath, 'utf-8');
  if (sha(prev) === sha(next)) { console.log('No changes in JSON.'); process.exit(0); }
  fs.writeFileSync(outPath, next);
  console.log(`Wrote ${outPath} with ${items.length} items.`);
})();
