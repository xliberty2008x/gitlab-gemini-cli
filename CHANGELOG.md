# Changelog

# Changelog

## 1.1.19
- Tightened CI triggers so the Gemini review job only runs on MR creation, pushes that add commits, or feature-branch pushes; description/label edits no longer wake the agent.
- Added workflow-level guard plus QA instructions (Scenario 1a) to verify metadata-only edits stay skipped.

## 1.1.18
- Fixed ignore-marker regression: MCP server now short-circuits `create_anchored_discussion_auto` when a matching discussion is listed in `IGNORED_DISCUSSIONS`, preventing duplicate threads.
- Added reusable-note selector helper and unit tests covering ignored vs active discussions.

## 1.1.17
- Localised reviewer output: the skill, prompts, and QA playbook now require Gemini to deliver inline comments and summaries українською мовою.
- Updated documentation to reflect the Ukrainian response policy for automatic reviews.

## 1.1.16
- Enforce ignore markers server-side so `create_anchored_discussion_auto` skips both updates and new posts when a discussion is flagged with `@gemini ignore` (or variants).
- Parse `IGNORED_DISCUSSIONS` safely, share helpers between runtime/template, and add regression tests for the ignore path.

## 1.1.15
- Harden duplicate protection by letting `create_anchored_discussion_auto` reuse existing notes via `update_note`, eliminating redundant threads when the agent reports the same issue twice.
- Export MCP server helpers and add regression tests to keep the runtime and template implementations aligned.

## 1.1.14
- Prevent duplicate review comments by preloading merge request discussions and requiring Gemini to reuse `update_note`.
- Allow maintainers to silence intentional findings with explicit ignore markers (`@gemini ignore`, `/gemini ignore`, `<!-- gemini-ignore -->`).
- Added `.gitlab/build-mr-context.js` helper and corresponding unit tests (`node --test`) to verify summarisation and ignore handling.
- Updated workflow templates to source `GITLAB_API_URL` from `CI_API_V4_URL` for self-hosted instances and added the new `update_note` MCP tool.
