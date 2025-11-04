# Changelog

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
