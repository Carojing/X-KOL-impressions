# Agent Adapter Notes

This project is intentionally agent-neutral.

## Codex

- Use `SKILL.md` as the main skill definition.
- Use `references/browser_extraction.md` for Chrome/X extraction.
- Use `scripts/build_workbook.mjs` when `@oai/artifact-tool` is available.
- Use `scripts/build_outputs_generic.mjs` if artifact-tool is unavailable.

## OpenClaw

- Treat `AGENTS.md` as the primary instruction file.
- Use the browser tool available in the OpenClaw environment to inspect X pages.
- Persist extracted data to JSON after each small batch.
- Run `node scripts/build_outputs_generic.mjs` for dependency-free exports.

## Hermes

- Treat `AGENTS.md` and `references/browser_extraction.md` as the operational prompt.
- Use a logged-in browser context when possible.
- If Hermes Tweet is installed, set `XQUIK_API_KEY` and use its read-only tools to preflight public profile URLs and recent post URLs before browser extraction.
- Leave `HERMES_TWEET_ENABLE_ACTIONS` unset for this read-only profile research workflow.
- If no browser is available, ask the user for exported profile/post data and run only the builder.

## Other Agents

Any agent can use this repo if it can:

1. Read Markdown instructions.
2. Navigate X profile pages in a logged-in browser session.
3. Save a JSON file following the schema in `SKILL.md`.
4. Run Node.js.

Use the generic builder for maximum portability:

```bash
node scripts/build_outputs_generic.mjs \
  --input profiles.json \
  --output-dir outputs \
  --owner Jessi \
  --basename x_profiles
```

The generic builder writes both Excel and Feishu TSV without third-party packages.
