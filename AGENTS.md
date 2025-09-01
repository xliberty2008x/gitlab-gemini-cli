# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Bridgetown site content, layouts, components, images, and posts (e.g., `src/_posts/YYYY-MM-DD-title.md`).
- `frontend/`: JavaScript and CSS sources bundled via esbuild (`frontend/javascript`, `frontend/styles`).
- `plugins/`: Small, focused Ruby plugins for Bridgetown.
- `server/`: Roda-based Ruby server for dynamic routes.
- `config/`: Puma, esbuild defaults, and `bridgetown.config.yml` (main site config).
- `bin/`: Bridgetown executables (`bin/bridgetown`, `bin/bt`).
- Tooling/CLI: `gitlab-mcp-server.js` (GitLab MCP server), `main.py` (Python entrypoint).

## Build, Test, and Development Commands
- Install: `bundle install && yarn install` (Ruby + Node toolchains).
- Dev server: `bin/bridgetown start` (serve site); `rake frontend:dev` (watch JS/CSS with esbuild).
- Build: `rake deploy` (clean → build frontend → build site) or `bin/bridgetown build`.
- Clean: `rake clean`.
- Test build: `rake test` (builds with `BRIDGETOWN_ENV=test`).
- MCP server: `GITLAB_PERSONAL_ACCESS_TOKEN=… node gitlab-mcp-server.js` (optional `GITLAB_API_URL`).

## Coding Style & Naming Conventions
- Ruby: 2-space indent; snake_case files/methods; CamelCase classes; keep plugins cohesive and small.
- JavaScript: 2-space indent; ES modules in `frontend/javascript`; prefer pure, testable functions.
- Markdown/Content: posts named `YYYY-MM-DD-title.md`; asset filenames in kebab-case.

## Testing Guidelines
- Site: `rake test` must complete without errors; verify key pages locally after changes.
- MCP: `npm install`, then `node gitlab-mcp-server.js --version`; exercise tools using `test_script.sh` or `test_script_netcat.sh`.

## Commit & Pull Request Guidelines
- Commits: short, imperative subject (e.g., “Add MCP server debugging”); optional body for rationale; group related changes.
- PRs: clear description, linked issues/MRs, steps to reproduce, and screenshots/logs when touching CI or MCP server; update docs when altering public behavior or config.

## Security & Configuration Tips
- Never commit tokens or secrets. Use CI/CD variables for `GITLAB_PERSONAL_ACCESS_TOKEN`; locally, `.env` is acceptable but must remain untracked.
- Validate `GITLAB_API_URL` matches the project environment before running MCP tools.

## CI: Gemini + MCP
- MR reviews: job uses the in-repo MCP server (`gitlab-mcp-server.js`) via stdio.
- Required CI vars: `GEMINI_API_KEY` and `GITLAB_REVIEW_PAT` (maps to `GITLAB_PERSONAL_ACCESS_TOKEN`).
- API URL: set to `https://hs2git.ab-games.com/api/v4`; override with `GITLAB_API_URL` if needed.
- Token header: defaults to `Authorization`; CI sets `GITLAB_TOKEN_HEADER=PRIVATE-TOKEN` for PATs.
- Tools: comments (`discussion_add_note`, `discussion_list`, `create_mr_discussion_with_position`), MR reads (`get_merge_request*`, diffs, participants), file ops (`get_file_contents`, `create_or_update_file`).
- Runner image: Docker runner with `image: node:20-alpine`; installs `@google/gemini-cli` via npm and project deps via `npm install --omit=dev`.
- Idempotency: the review comment includes marker `[ai-review-bot v1]`; job lists discussions and updates in-place via `update_note` if a prior comment exists.

## Prompt-in-CI Strategy
- The CI job embeds the full review prompt (adapted from GitHub example) and passes MR context and JSON MR_CONTEXT.
- Behavior: post exactly one new MR comment per run; prefer an anchored discussion via `create_mr_discussion_with_position`, fallback to a top-level note.
- Strict param sourcing: tools must use MR_CONTEXT fields exactly; no guessing.
 - Concurrency: job uses `resource_group: gemini-review-$CI_MERGE_REQUEST_IID` to avoid overlapping runs.

## Prompt & Variables
- Prompt includes: repo path, MR URL/IID, commit SHA, source/target branches.
- Variables passed: `CI_MERGE_REQUEST_PROJECT_URL`, `CI_PROJECT_ID`, `CI_PROJECT_PATH`, `CI_MERGE_REQUEST_IID`, `CI_COMMIT_SHA`, `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME`, `CI_MERGE_REQUEST_TARGET_BRANCH_NAME`.
- JSON MR_CONTEXT embedded for robust parsing.
 - Severity levels: 🔴/🟠/🟡/🟢 included; suggestion blocks must be syntactically correct and aligned to diff lines.

## Backlog
- GEMINI.md as primary guardrails (deferred): centralize behavior and safety rules outside CI.
- Commit comments tool: `add_commit_comment` for commit-scoped notes if desired later.

## Roadmap & Tasks
- MCP robustness: implement typed `GitLabApiError` in `gitlab-mcp-server.js` (include `status`, `statusText`, `body`). In `create_or_update_file`, POST only on `status === 404`, otherwise rethrow.
- CI readability: extract OS/CLI setup to `scripts/setup_ci.sh` and call it from `.gitlab-ci.yml`; prefer `npm ci` when `package-lock.json` exists; consider `cache:` keyed by lockfile.
- Production image: build a custom Docker image (Node 20-alpine) preinstalled with pinned `@google/gemini-cli` and project deps; run as non‑root; publish to registry and set `image:` in CI for Docker runners.
- Validation: add MR tests for file exists vs not‑found; verify macOS Shell and Docker paths; check single‑comment idempotency and measure pipeline time before/after custom image.

## CI Setup Status & Troubleshooting
- Progress: CI installs Gemini CLI (Docker or macOS shell runner), launches in-repo MCP via stdio with PAT auth. Server updated for default-branch detection and safe file updates.
- Variables: ensure `GEMINI_API_KEY` and `GITLAB_REVIEW_PAT` are defined in GitLab CI/CD Variables; optionally set `GITLAB_API_URL` per environment.
- Runner: if Docker executor, uses `node:20-alpine` and installs CLI via npm; if macOS shell runner, uses Homebrew (`brew install gemini-cli`) when `gemini` is missing.
- Common issues: “gemini: not found” → image missing install step; “403/401” → invalid PAT or wrong `GITLAB_API_URL`; MR comments missing → verify MCP tools list and token scope (api).
- Next: consider pinning CLI version (e.g., `@google/gemini-cli@1.x`) and adding `allow_failure: true` during initial testing. For production, you can pre-bake a custom image with CLI installed.
