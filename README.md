# X Profile Impressions Codex Skill

Codex skill for turning X/Twitter profile links into outreach-ready tables.

It can process batches of X profile URLs, deep-scroll recent timelines, extract account-base data, calculate recent original/quote-post impressions, and produce:

- Excel workbook (`.xlsx`)
- Feishu/Lark-copyable TSV table

## What It Extracts

- Name
- Follower bucket for dropdown fields
- Owner
- Profile link
- Recent 5-post average exposure in thousands
- Region/account base
- Post-level sample links and view labels

## Install

Clone this repository, then copy the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R x-profile-impressions ~/.codex/skills/
```

If the repository root itself contains `SKILL.md`, copy the repo folder as `x-profile-impressions`:

```bash
mkdir -p ~/.codex/skills
cp -R /path/to/this/repo ~/.codex/skills/x-profile-impressions
```

Restart Codex or start a new thread so the skill is discovered.

## Example Prompt

```text
Use $x-profile-impressions to process these 80 X profile links.
Owner is Jessi.
Output an Excel file and a Feishu-copyable TSV.
```

## Data Collection Notes

This skill is designed for Codex with Chrome browser automation. X often requires logged-in browser state to show post views and account `/about` fields.

The intended sample rule is:

- Include recent original posts and quote posts by the target account.
- Exclude reposts.
- Exclude old pinned posts from the recent-post average.
- Target 5 sampled posts.
- If exhaustive scrolling finds only 3-4 eligible posts, calculate from those.
- If fewer than 3 are found, mark the account `PASS`.

## Workbook Builder

After extraction, the bundled builder can generate Excel and TSV from a JSON file:

```bash
node scripts/build_workbook.mjs \
  --input examples/sample_profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

The builder expects to run inside Codex or an environment where `@oai/artifact-tool` is available.

## Feishu TSV Columns

```tsv
name	Followers	owner	Link	近5条平均曝光（k）	Region
```

## License

MIT
