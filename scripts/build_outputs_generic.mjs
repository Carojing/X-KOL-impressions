#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const inputPath = argValue("--input");
const outputDir = argValue("--output-dir", process.cwd());
const owner = argValue("--owner", "Jessi");
const basename = argValue("--basename", "x_profiles");

if (!inputPath) {
  console.error("Usage: node scripts/build_outputs_generic.mjs --input profiles.json --output-dir outputs --owner Jessi --basename x_profiles");
  process.exit(1);
}

const profiles = JSON.parse(await fs.readFile(inputPath, "utf8"));

function clean(value) {
  return value == null ? "" : String(value);
}

function parseCount(text) {
  const match = clean(text).replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return null;
  const multiplier = !match[2] ? 1 : match[2].toUpperCase() === "K" ? 1e3 : match[2].toUpperCase() === "M" ? 1e6 : 1e9;
  return parseFloat(match[1]) * multiplier;
}

function followerBucket(followersText) {
  const n = parseCount(followersText);
  if (n == null) return "";
  if (n < 10000) return "5-10k";
  if (n < 50000) return "10k-50k";
  if (n < 100000) return "50k-100k";
  if (n < 200000) return "100k-200k";
  if (n < 300000) return "200k-300k";
  return "more than 300k";
}

function samples(profile) {
  return (profile.posts || []).slice(0, 5);
}

function avgImpressions(profile) {
  const nums = samples(profile)
    .map((post) => post.impressions)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));
  return nums.length >= 3 ? nums.reduce((sum, n) => sum + n, 0) / nums.length : null;
}

function profileUrl(profile) {
  if (profile.profile_url) return clean(profile.profile_url).replace(/\?.*$/, "");
  const handle = clean(profile.screen_name || profile.handle).replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : "";
}

function enrich(profile) {
  const avg = avgImpressions(profile);
  const sampleCount = samples(profile).length;
  return {
    ...profile,
    _name: clean(profile.name).trim(),
    _url: profileUrl(profile),
    _owner: clean(profile.owner || owner),
    _bucket: clean(profile.follower_bucket || followerBucket(profile.followers)),
    _region: clean(profile.region || profile.account_based_in),
    _sampleCount: sampleCount,
    _status: sampleCount < 3 ? "PASS" : sampleCount === 5 ? "OK" : "PARTIAL",
    _avgImpressions: avg,
    _avgK: avg == null ? "" : Number((avg / 1000).toFixed(2)),
  };
}

const enriched = profiles.map(enrich);

function tsvEscape(value) {
  return clean(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

const feishuHeaders = ["name", "Followers", "owner", "Link", "近5条平均曝光（k）", "Region"];
const feishuRows = enriched.map((profile) => [
  profile._name,
  profile._bucket,
  profile._owner,
  profile._url,
  profile._avgK === "" ? "" : profile._avgK.toFixed(2),
  profile._region,
]);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
  path.join(outputDir, `${basename}_feishu.tsv`),
  [feishuHeaders, ...feishuRows].map((row) => row.map(tsvEscape).join("\t")).join("\n"),
  "utf8",
);

const profileHeaders = [
  "#", "Name", "Handle", "Profile URL", "Followers Raw", "Follower Bucket", "Owner", "Region",
  "Account Based In", "Verified Since", "Connected Via", "Joined", "Avg Impressions", "Avg K",
  "Sample Count", "Status", "Bio",
];
const profileRows = enriched.map((profile, index) => [
  index + 1,
  profile._name,
  clean(profile.screen_name || profile.handle),
  profile._url,
  clean(profile.followers),
  profile._bucket,
  profile._owner,
  profile._region,
  clean(profile.account_based_in),
  clean(profile.verified_since),
  clean(profile.connected_via),
  clean(profile.joined),
  profile._avgImpressions == null ? "" : Number(profile._avgImpressions.toFixed(2)),
  profile._avgK === "" ? "" : profile._avgK,
  profile._sampleCount,
  profile._status,
  clean(profile.bio),
]);

const postHeaders = ["Handle", "Name", "Sample Order", "Date", "Post URL", "Views Raw", "Impressions", "View Label", "Text Preview"];
const postRows = [];
for (const profile of enriched) {
  for (const [index, post] of samples(profile).entries()) {
    postRows.push([
      clean(profile.screen_name || profile.handle),
      profile._name,
      index + 1,
      clean(post.date),
      clean(post.status_url),
      clean(post.views_raw),
      post.impressions == null ? "" : post.impressions,
      clean(post.view_label),
      clean(post.text_preview),
    ]);
  }
}

const noteRows = [
  ["Post sample rule", "Recent original or quote posts by the target account; reposts and old pinned posts excluded."],
  ["Average rule", "Target 5 posts. 3-4 posts are averaged if exhaustive deep scroll cannot find 5. Fewer than 3 is PASS."],
  ["Feishu exposure", "近5条平均曝光（k） = raw average impressions / 1000, rounded to two decimals."],
  ["Follower buckets", "5-10k, 10k-50k, 50k-100k, 100k-200k, 200k-300k, more than 300k."],
];

function xmlEscape(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const xmlRows = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${colName(c)}${r + 1}`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

function workbookXml(sheetNames) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetNames) {
  const rels = sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function contentTypesXml(sheetNames) {
  const overrides = sheetNames.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`;
}

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function makeCrc32Table() {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrc32Table();
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dt = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(dt.time), u16(dt.date), u32(crc),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dt.time), u16(dt.date),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

const sheetNames = ["Feishu Table", "Profiles Detail", "Post Samples", "Method Notes"];
const files = [
  { name: "[Content_Types].xml", data: contentTypesXml(sheetNames) },
  { name: "_rels/.rels", data: rootRelsXml },
  { name: "xl/workbook.xml", data: workbookXml(sheetNames) },
  { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(sheetNames) },
  { name: "xl/worksheets/sheet1.xml", data: sheetXml([feishuHeaders, ...feishuRows]) },
  { name: "xl/worksheets/sheet2.xml", data: sheetXml([profileHeaders, ...profileRows]) },
  { name: "xl/worksheets/sheet3.xml", data: sheetXml([postHeaders, ...postRows]) },
  { name: "xl/worksheets/sheet4.xml", data: sheetXml([["Item", "Detail"], ...noteRows]) },
];

await fs.writeFile(path.join(outputDir, `${basename}.xlsx`), zipStore(files));

console.log(JSON.stringify({
  xlsx: path.join(outputDir, `${basename}.xlsx`),
  tsv: path.join(outputDir, `${basename}_feishu.tsv`),
  rows: enriched.length,
  ok: enriched.filter((profile) => profile._status === "OK").length,
  partial: enriched.filter((profile) => profile._status === "PARTIAL").length,
  pass: enriched.filter((profile) => profile._status === "PASS").length,
}, null, 2));
