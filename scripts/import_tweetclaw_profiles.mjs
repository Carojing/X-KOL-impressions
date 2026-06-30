#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const inputPath = argValue("--input");
const outputPath = argValue("--output", "tweetclaw_profiles.json");
const owner = argValue("--owner", "Jessi");

if (!inputPath) {
  console.error("Usage: node scripts/import_tweetclaw_profiles.mjs --input tweetclaw.csv --output profiles.json --owner Jessi");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function normaliseKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function pick(row, names) {
  for (const name of names) {
    const value = row[name];
    if (clean(value)) return clean(value);
  }
  return "";
}

function profileUrlFrom(row) {
  const existing = pick(row, ["profile_url", "profile", "url", "x_url", "twitter_url"]);
  if (existing) return existing.replace(/\?.*$/, "");

  const handle = pick(row, ["screen_name", "username", "user_name", "handle", "author_username", "author"]);
  const stripped = handle.replace(/^@/, "");
  return stripped ? `https://x.com/${stripped}` : "";
}

const csvText = await fs.readFile(inputPath, "utf8");
const [headerRow, ...dataRows] = parseCsv(csvText);
if (!headerRow || dataRows.length === 0) {
  throw new Error("CSV must include a header row and at least one profile row.");
}

const headers = headerRow.map(normaliseKey);
const profiles = dataRows.map((cells) => {
  const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  const profileUrl = profileUrlFrom(row);
  const handle = pick(row, ["screen_name", "username", "user_name", "handle", "author_username", "author"]);
  return {
    name: pick(row, ["name", "display_name", "author_name", "full_name"]) || handle.replace(/^@/, ""),
    profile_url: profileUrl,
    screen_name: handle.startsWith("@") ? handle : handle ? `@${handle}` : "",
    bio: pick(row, ["bio", "description", "profile_bio"]),
    joined: pick(row, ["joined", "joined_at", "created_at"]),
    following: pick(row, ["following", "following_count"]),
    followers: pick(row, ["followers", "followers_count", "follower_count"]),
    posts_count: pick(row, ["posts_count", "statuses_count", "tweets_count"]),
    account_based_in: pick(row, ["account_based_in", "region", "location", "country"]),
    verified_since: pick(row, ["verified_since"]),
    connected_via: pick(row, ["connected_via"]),
    owner,
    posts: [],
  };
}).filter((profile) => profile.profile_url);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, rows: profiles.length }));
