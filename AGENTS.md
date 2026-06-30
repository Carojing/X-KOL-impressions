# Agent Instructions

This repository can be used by Codex, OpenClaw, Hermes, Cursor, Claude Code, and other coding/browser agents.

## Goal

Given X/Twitter profile links, extract outreach-ready profile and recent-post performance data, then produce:

- Excel workbook (`.xlsx`)
- Feishu/Lark-copyable TSV

## Required Output Columns

For the Feishu/Lark table, output these columns exactly:

```tsv
name	Followers	owner	Link	近5条平均曝光（k）	Region
```

## Extraction Rules

- If a TweetClaw or other X/Twitter profile CSV export is available, convert it with `scripts/import_tweetclaw_profiles.mjs` and use the generated JSON as the profile seed list.
- Use browser automation with logged-in X state when available.
- Visit each profile page and `/about` page.
- Collect display name, profile URL, follower count, bio, joined date, account base, verified-since, connected-via.
- Deep-scroll the profile timeline until 5 eligible posts are found.
- Eligible posts: original posts and quote posts by the target account.
- Exclude reposts and old pinned posts.
- Parse view counts from labels containing `views`.
- Calculate average impressions from 5 posts when possible.
- If only 3 or 4 eligible posts can be found after deep scrolling, average those and mark as partial.
- If fewer than 3 eligible posts are found, mark `PASS`.

## Export

Save extraction results as JSON using the schema in `SKILL.md`, then run:

```bash
node scripts/build_outputs_generic.mjs \
  --input examples/sample_profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

The generic builder has no third-party runtime dependency and writes:

- `<basename>.xlsx`
- `<basename>_feishu.tsv`

Codex users may alternatively use `scripts/build_workbook.mjs` for a styled workbook when `@oai/artifact-tool` is available.

## Follower Buckets

Map follower counts to exactly:

- `5-10k`
- `10k-50k`
- `50k-100k`
- `100k-200k`
- `200k-300k`
- `more than 300k`

## Region

Prefer X `/about` field `Account based in`. Keep country names such as `Pakistan`, `Bangladesh`, `INDIA` when shown. Use broad labels only if X shows a broad region or the user requests grouping.
