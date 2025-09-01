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
- Tools: comments (`discussion_add_note`, `discussion_list`), MR reads (`get_merge_request*`, diffs, participants), file ops (`get_file_contents`, `create_or_update_file`).
- Runner image: Docker runner with `image: node:20-alpine`; installs `@google/gemini-cli` via npm and project deps via `npm install --omit=dev`.

## CI Setup Status & Troubleshooting
- Progress: switched CI to Docker image, install Gemini CLI at runtime, and launch in-repo MCP via stdio with PAT auth. Server updated for default-branch detection and safe file updates.
- Variables: ensure `GEMINI_API_KEY` and `GITLAB_REVIEW_PAT` are defined in GitLab CI/CD Variables; optionally set `GITLAB_API_URL` per environment.
- Runner: requires Docker executor or preinstalled `gemini` on shell runners. Current job installs CLI each run for consistency.
- Common issues: “gemini: not found” → image missing install step; “403/401” → invalid PAT or wrong `GITLAB_API_URL`; MR comments missing → verify MCP tools list and token scope (api).
- Next: consider pinning CLI version (e.g., `@google/gemini-cli@1.x`) and adding `allow_failure: true` during initial testing. For production, you can pre-bake a custom image with CLI installed.
