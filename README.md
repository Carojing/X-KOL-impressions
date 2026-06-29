# X Profile Impressions Agent Skill

Agent skill for turning X/Twitter profile links into outreach-ready tables. It works as a Codex skill and also includes portable instructions for OpenClaw, Hermes, Cursor, Claude Code, and other browser/coding agents.

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

## Install for Codex

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

## Use with OpenClaw, Hermes, or Other Agents

This repo includes `AGENTS.md`, a generic instruction file that non-Codex agents can read directly.

For OpenClaw, Hermes, Cursor, Claude Code, or similar agents:

1. Clone or download this repo.
2. Ask the agent to read `AGENTS.md`.
3. Ask it to use `references/browser_extraction.md` for the X extraction rules.
4. Save extracted results as JSON using the schema in `SKILL.md`.
5. Run the generic builder:

```bash
node scripts/build_outputs_generic.mjs \
  --input examples/sample_profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

The generic builder uses only Node.js standard libraries and writes both:

- `x_profiles.xlsx`
- `x_profiles_feishu.tsv`

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

After extraction, the Codex builder can generate a styled Excel workbook and TSV from a JSON file:

```bash
node scripts/build_workbook.mjs \
  --input examples/sample_profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

The builder expects to run inside Codex or an environment where `@oai/artifact-tool` is available.

For non-Codex agents, use the dependency-free generic builder:

```bash
node scripts/build_outputs_generic.mjs \
  --input examples/sample_profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

## Feishu TSV Columns

```tsv
name	Followers	owner	Link	近5条平均曝光（k）	Region
```

## License

MIT
