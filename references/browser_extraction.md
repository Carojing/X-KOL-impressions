# Browser Extraction Guide

Use Chrome browser automation for X because logged-in state is often required for profile `/about` and post view counts.

## Batch Strategy

- For 1-10 accounts: process all accounts if time allows.
- For 50-100 accounts: split into batches of 3-5 accounts per tool call.
- Persist partial results to JSON after every batch.
- If a browser call times out, read the partially saved JSON and resume from the next handle.

## Navigation

For each handle:

1. Open `https://x.com/<handle>`.
2. Wait for `domcontentloaded`, then wait 2-3 seconds.
3. Scroll down once to trigger timeline rendering.
4. Extract header fields from the visible profile page.
5. Open `https://x.com/<handle>/about` and extract:
   - `Date joined`
   - `Account based in`
   - `Verified Since ...`
   - `Connected via`
6. Return to the profile page and deep-scroll for posts.

## Eligible Posts

Include:
- Original posts by the target account.
- Quote posts by the target account.
- Thread continuation posts by the target account, unless the user says to exclude threads.

Exclude:
- Reposts: article text usually starts with `<profile name> reposted`.
- Old pinned posts: article text starts with `Pinned` or first non-empty line is `Pinned`.
- Posts by another account embedded in a quote card.

## DOM Signals

Within each `article`:

- The canonical status URL usually appears as `/<handle>/status/<id>`.
- View count is usually in an `aria-label` containing `views`, often on a link to `/analytics`.
- Parse labels like:
  - `1008 views`
  - `1.5M views`
  - `7 replies, 1 repost, 21 likes, 1265 views`

Convert view counts:
- `K` -> 1,000
- `M` -> 1,000,000
- `B` -> 1,000,000,000

## Deep Scroll Stop Conditions

Stop when:
- 5 eligible posts are found.
- 40-50 scrolls have completed for one account.
- The page repeats without adding new eligible posts for several scrolls and there are at least 3 samples.

If fewer than 3 samples are found after deep scrolling, mark `PASS`.

## Suggested Browser Code Shape

Use this as a pattern, adapting variable names to the current browser tool:

```js
function parseViewNumber(text) {
  const match = String(text || "").replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return null;
  const multiplier = !match[2] ? 1 : match[2].toUpperCase() === "K" ? 1e3 : match[2].toUpperCase() === "M" ? 1e6 : 1e9;
  return parseFloat(match[1]) * multiplier;
}

async function readVisiblePosts(tab, handle) {
  return await tab.playwright.evaluate((handle) => {
    return [...document.querySelectorAll("article")].map((article) => {
      const text = article.innerText || "";
      const links = [...article.querySelectorAll("a[href]")].map((link) => link.getAttribute("href"));
      const statusHref = links.find((href) => href && new RegExp("^/" + handle + "/status/[0-9]+$", "i").test(href));
      const viewEl = [...article.querySelectorAll('a[href*="/analytics"], [aria-label*="views" i]')]
        .find((el) => /views/i.test(el.getAttribute("aria-label") || ""));
      return {
        text,
        statusHref,
        viewLabel: viewEl?.getAttribute("aria-label") || "",
        timeText: article.querySelector("time")?.textContent || ""
      };
    });
  }, handle);
}
```

## Quality Checks

Before building outputs:
- Confirm each non-PASS account has 5, 4, or 3 sampled posts.
- Spot-check 1-2 accounts by opening post URLs and comparing visible view labels.
- Ensure `近5条平均曝光（k）` equals average raw impressions divided by 1000 and rounded to 2 decimals.
