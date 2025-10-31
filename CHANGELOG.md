# Changelog

## 1.1.14
- Prevent duplicate review comments by preloading merge request discussions and requiring Gemini to reuse `update_note`.
- Allow maintainers to silence intentional findings with explicit ignore markers (`@gemini ignore`, `/gemini ignore`, `<!-- gemini-ignore -->`).
- Added `.gitlab/build-mr-context.js` helper and corresponding unit tests (`node --test`) to verify summarisation and ignore handling.
- Updated workflow templates to source `GITLAB_API_URL` from `CI_API_V4_URL` for self-hosted instances and added the new `update_note` MCP tool.
