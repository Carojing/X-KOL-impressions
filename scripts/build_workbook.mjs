#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
const artifactToolPath = requireFromCwd.resolve("@oai/artifact-tool");
const { SpreadsheetFile, Workbook } = await import(pathToFileURL(artifactToolPath).href);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const inputPath = argValue("--input");
const outputDir = argValue("--output-dir", process.cwd());
const owner = argValue("--owner", "Jessi");
const basename = argValue("--basename", "x_profiles");

if (!inputPath) {
  console.error("Usage: node build_workbook.mjs --input profiles.json --output-dir outputs --owner Jessi --basename x_profiles");
  process.exit(1);
}

const profiles = JSON.parse(await fs.readFile(inputPath, "utf8"));

function clean(value) {
  return value == null ? "" : String(value);
}

function parseCount(text) {
  const value = clean(text).replace(/,/g, "");
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
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

function region(profile) {
  return clean(profile.region || profile.account_based_in);
}

function displayName(profile) {
  return clean(profile.name).trim();
}

function profileUrl(profile) {
  if (profile.profile_url) return clean(profile.profile_url).replace(/\?.*$/, "");
  const handle = clean(profile.screen_name || profile.handle).replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : "";
}

function setHeader(range) {
  range.format.fill.color = "#1F4E78";
  range.format.font.color = "#FFFFFF";
  range.format.font.bold = true;
  range.format.wrapText = true;
  range.format.borders = { preset: "outside", style: "thin", color: "#B7C9D6" };
}

function setBody(range) {
  range.format.borders = {
    insideHorizontal: { style: "thin", color: "#E6EEF3" },
    top: { style: "thin", color: "#B7C9D6" },
    bottom: { style: "thin", color: "#B7C9D6" },
  };
  range.format.wrapText = true;
}

const enriched = profiles.map((profile) => {
  const avg = avgImpressions(profile);
  const sampleCount = samples(profile).length;
  return {
    ...profile,
    _name: displayName(profile),
    _url: profileUrl(profile),
    _owner: clean(profile.owner || owner),
    _bucket: clean(profile.follower_bucket || followerBucket(profile.followers)),
    _region: region(profile),
    _sampleCount: sampleCount,
    _status: sampleCount < 3 ? "PASS" : sampleCount === 5 ? "OK" : "PARTIAL",
    _avgImpressions: avg,
    _avgK: avg == null ? "" : Number((avg / 1000).toFixed(2)),
  };
});

await fs.mkdir(outputDir, { recursive: true });

const tsvHeaders = ["name", "Followers", "owner", "Link", "近5条平均曝光（k）", "Region"];
const tsvRows = enriched.map((profile) => [
  profile._name,
  profile._bucket,
  profile._owner,
  profile._url,
  profile._avgK === "" ? "" : profile._avgK.toFixed(2),
  profile._region,
]);
const tsv = [tsvHeaders, ...tsvRows]
  .map((row) => row.map((cell) => clean(cell).replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
  .join("\n");
await fs.writeFile(path.join(outputDir, `${basename}_feishu.tsv`), tsv, "utf8");

const workbook = Workbook.create();

const summary = workbook.worksheets.add("Feishu Table");
summary.showGridLines = false;
summary.getRange("A1:F1").values = [tsvHeaders];
summary.getRangeByIndexes(1, 0, tsvRows.length, tsvHeaders.length).values = tsvRows;
setHeader(summary.getRange("A1:F1"));
setBody(summary.getRangeByIndexes(1, 0, tsvRows.length, tsvHeaders.length));
summary.freezePanes.freezeRows(1);
summary.getRange("E2:E500").setNumberFormat("#,##0.00");
summary.getRange("A:A").format.columnWidth = 26;
summary.getRange("B:C").format.columnWidth = 16;
summary.getRange("D:D").format.columnWidth = 44;
summary.getRange("E:E").format.columnWidth = 20;
summary.getRange("F:F").format.columnWidth = 20;
summary.getRangeByIndexes(0, 0, tsvRows.length + 1, tsvHeaders.length).format.rowHeightPx = 32;

const profilesSheet = workbook.worksheets.add("Profiles Detail");
profilesSheet.showGridLines = false;
const profileHeaders = [
  "#",
  "Name",
  "Handle",
  "Profile URL",
  "Followers Raw",
  "Follower Bucket",
  "Owner",
  "Region",
  "Account Based In",
  "Verified Since",
  "Connected Via",
  "Joined",
  "Avg Impressions",
  "Avg K",
  "Sample Count",
  "Status",
  "Bio",
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
  profile._avgImpressions,
  profile._avgK === "" ? null : profile._avgK,
  profile._sampleCount,
  profile._status,
  clean(profile.bio),
]);
profilesSheet.getRangeByIndexes(0, 0, 1, profileHeaders.length).values = [profileHeaders];
profilesSheet.getRangeByIndexes(1, 0, profileRows.length, profileHeaders.length).values = profileRows;
setHeader(profilesSheet.getRangeByIndexes(0, 0, 1, profileHeaders.length));
setBody(profilesSheet.getRangeByIndexes(1, 0, profileRows.length, profileHeaders.length));
profilesSheet.freezePanes.freezeRows(1);
profilesSheet.getRange("M2:N500").setNumberFormat("#,##0.00");
profilesSheet.getRange("A:A").format.columnWidth = 5;
profilesSheet.getRange("B:D").format.columnWidth = 24;
profilesSheet.getRange("E:P").format.columnWidth = 16;
profilesSheet.getRange("Q:Q").format.columnWidth = 60;

const postsSheet = workbook.worksheets.add("Post Samples");
postsSheet.showGridLines = false;
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
      post.impressions,
      clean(post.view_label),
      clean(post.text_preview),
    ]);
  }
}
postsSheet.getRangeByIndexes(0, 0, 1, postHeaders.length).values = [postHeaders];
if (postRows.length) postsSheet.getRangeByIndexes(1, 0, postRows.length, postHeaders.length).values = postRows;
setHeader(postsSheet.getRangeByIndexes(0, 0, 1, postHeaders.length));
if (postRows.length) setBody(postsSheet.getRangeByIndexes(1, 0, postRows.length, postHeaders.length));
postsSheet.freezePanes.freezeRows(1);
postsSheet.getRange("G2:G1000").setNumberFormat("#,##0.00");
postsSheet.getRange("A:B").format.columnWidth = 22;
postsSheet.getRange("C:D").format.columnWidth = 12;
postsSheet.getRange("E:E").format.columnWidth = 46;
postsSheet.getRange("F:G").format.columnWidth = 14;
postsSheet.getRange("H:H").format.columnWidth = 52;
postsSheet.getRange("I:I").format.columnWidth = 70;

const notes = workbook.worksheets.add("Method Notes");
notes.showGridLines = false;
const noteRows = [
  ["Post sample rule", "Recent original or quote posts by the target account; reposts and old pinned posts excluded."],
  ["Average rule", "Target 5 posts. 3-4 posts are averaged if exhaustive deep scroll cannot find 5. Fewer than 3 is PASS."],
  ["Feishu exposure", "近5条平均曝光（k） = raw average impressions / 1000, rounded to two decimals."],
  ["Follower buckets", "5-10k, 10k-50k, 50k-100k, 100k-200k, 200k-300k, more than 300k."],
  ["Volatility", "X view counts change over time; values reflect extraction time."],
];
notes.getRange("A1:B1").values = [["Item", "Detail"]];
notes.getRangeByIndexes(1, 0, noteRows.length, 2).values = noteRows;
setHeader(notes.getRange("A1:B1"));
setBody(notes.getRangeByIndexes(1, 0, noteRows.length, 2));
notes.getRange("A:A").format.columnWidth = 24;
notes.getRange("B:B").format.columnWidth = 100;

const preview = await workbook.render({ sheetName: "Feishu Table", range: `A1:F${Math.min(tsvRows.length + 1, 30)}`, scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, `${basename}_preview.png`), new Uint8Array(await preview.arrayBuffer()));

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, `${basename}.xlsx`));

console.log(JSON.stringify({
  xlsx: path.join(outputDir, `${basename}.xlsx`),
  tsv: path.join(outputDir, `${basename}_feishu.tsv`),
  preview: path.join(outputDir, `${basename}_preview.png`),
  rows: enriched.length,
  ok: enriched.filter((profile) => profile._status === "OK").length,
  partial: enriched.filter((profile) => profile._status === "PARTIAL").length,
  pass: enriched.filter((profile) => profile._status === "PASS").length,
}, null, 2));
