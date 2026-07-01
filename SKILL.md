---
name: x-profile-impressions
description: Extract X/Twitter profile account-base data and recent original or quote post impressions for outreach lists. Use when the user provides X profile links or asks to process 10, 50, 50-100 accounts, calculate recent 5-post average exposure/views/impressions, categorize follower buckets for Feishu/Lark dropdowns, and output both an Excel workbook and a Feishu-copyable TSV table.
---

# X Profile Impressions

## Overview

Process X profile link lists into outreach-ready tables. The expected final deliverables are:
- `.xlsx` workbook with profile summary, post samples, and method notes.
- Feishu/Lark-copyable TSV block matching columns: `name`, `Followers`, `owner`, `Link`, `近5条平均曝光（k）`, `Region`.

## Workflow

1. Normalize the user-provided X links.
   - Strip query strings such as `?s=20`.
   - Preserve the handle case in URLs when useful, but use `https://x.com/<handle>` as the canonical profile URL.
   - De-duplicate by lowercase handle.

2. Use Chrome browser automation when available.
   - Prefer Chrome because X often requires logged-in state to show views and `/about` account-base information.
   - For browser extraction details, read `references/browser_extraction.md`.
   - For 50-100 accounts, process in small batches of 3-5 accounts per browser call to avoid timeouts.

3. Optionally use Hermes Tweet for Hermes Agent preflight.
   - If running inside Hermes Agent and Hermes Tweet is installed, set `XQUIK_API_KEY`.
   - Use Hermes Tweet's read-only tools to verify public profile URLs and collect recent public post URLs before browser deep scrolling.
   - Keep `HERMES_TWEET_ENABLE_ACTIONS` unset unless the user explicitly asks for a separate publishing workflow.
   - Do not replace browser extraction for view labels or `/about` fields; this skill still needs browser evidence for those values.

4. Extract account profile fields.
   - `name`
   - `profile_url`
   - `bio`
   - `joined`
   - `following`
   - `followers`
   - `posts_count`
   - `/about` fields: `account_based_in`, `verified_since`, `connected_via`

5. Extract recent posts.
   - Deep-scroll each profile timeline until finding 5 eligible posts or until the profile is exhausted/repeated.
   - Eligible posts are original posts or quote posts by the target account.
   - Exclude reposts and old pinned posts from the “recent 5” sample.
   - Store each sampled post with `status_url`, `date`, `views_raw`, numeric `impressions`, `view_label`, and `text_preview`.

6. Calculate the average exposure.
   - Target is 5 posts.
   - If deep scrolling still finds only 3 or 4 eligible posts, calculate from those posts and note the sample count.
   - If fewer than 3 eligible posts are found, mark the account `PASS` and leave the average blank unless the user explicitly asks otherwise.
   - Excel summary should display average impressions as raw views with `#,##0.00`.
   - Feishu TSV should display `近5条平均曝光（k）` as thousands, e.g. `5603.60` impressions -> `5.60`.

7. Categorize follower buckets for Feishu dropdowns.
   - Use exactly one of these labels when possible:
     - `5-10k`
     - `10k-50k`
     - `50k-100k`
     - `100k-200k`
     - `200k-300k`
     - `more than 300k`
   - If followers are below 5k or unavailable, use the closest practical label only if the user’s sheet requires a dropdown value; otherwise leave blank and note it.

8. Determine Region.
   - Prefer `account_based_in`.
   - Preserve specific country names when the user’s existing sheet uses them, for example `Pakistan`, `Bangladesh`, `INDIA`.
   - Use broader labels such as `South Asia` only when X itself reports that exact region or when the user asks for regional grouping.

9. Build outputs.
   - Save extracted data as JSON in the working directory.
   - Run `scripts/build_workbook.mjs` to create Excel and a TSV text file.
   - Paste the TSV block in the final answer for small batches. For 50-100 accounts, provide the file link and include only a short preview unless the user asks for the full TSV in chat.

## Data JSON Schema

Use this shape as input to `scripts/build_workbook.mjs`:

```json
[
  {
    "name": "Maria Queen",
    "profile_url": "https://x.com/MariaQueen81923",
    "screen_name": "@MariaQueen81923",
    "bio": "AI & Tech content expert...",
    "joined": "March 2026",
    "following": "9,417 Following",
    "followers": "10K Followers",
    "posts_count": "178 posts",
    "account_based_in": "Pakistan",
    "verified_since": "June 2026",
    "connected_via": "Pakistan Android App",
    "owner": "Jessi",
    "posts": [
      {
        "status_url": "https://x.com/MariaQueen81923/status/...",
        "date": "Jun 27",
        "views_raw": "1014",
        "impressions": 1014,
        "view_label": "4 replies, 17 likes, 1014 views",
        "text_preview": "..."
      }
    ]
  }
]
```

## Workbook/TSV Builder

After extracting JSON, run:

```bash
node scripts/build_workbook.mjs \
  --input /path/to/profiles.json \
  --output-dir /path/to/outputs \
  --owner Jessi \
  --basename x_profiles
```

The script writes:
- `<basename>.xlsx`
- `<basename>_feishu.tsv`
- `<basename>_preview.png`

## Final Response

Return:
- Brief summary of count processed, count with 5/4/3/PASS samples.
- Link to the `.xlsx` file.
- Feishu TSV in a fenced `tsv` block for up to about 30 rows; for larger lists, link the TSV file and include a preview.

Do not over-explain browser internals unless asked.
