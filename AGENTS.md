# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Bridgetown site content, layouts, components, images, and posts (e.g., `src/_posts/YYYY-MM-DD-title.md`).
- `frontend/`: JS and CSS sources bundled via esbuild (`frontend/javascript`, `frontend/styles`).
- `plugins/`: Ruby plugins for Bridgetown.
- `server/`: Roda-based Ruby server for dynamic routes.
- `config/`: Puma, esbuild defaults, and Bridgetown config; `bridgetown.config.yml` is the main site config.
- `bin/`: Bridgetown executables (`bin/bridgetown`, `bin/bt`).
- Tooling/CLI: `gitlab-mcp-server.js` (Node MCP server for GitLab), `main.py` (Python entrypoint).

## Build, Test, and Development Commands
- Install: `bundle install` and `yarn install` (Ruby + Node toolchain).
- Dev server: `bin/bridgetown start` (serve site) and `rake frontend:dev` (watch JS/CSS with esbuild).
- Build: `rake deploy` (cleans, builds frontend, then site) or `bin/bridgetown build`.
- Clean: `rake clean`.
- Test build: `rake test` (build with `BRIDGETOWN_ENV=test`).
- MCP server: `GITLAB_PERSONAL_ACCESS_TOKEN=… node gitlab-mcp-server.js` (optional `GITLAB_API_URL`).

## Coding Style & Naming Conventions
- Ruby: 2-space indentation, snake_case for files and methods, classes in CamelCase; keep plugins small and cohesive.
- JavaScript: 2-space indentation; prefer modules in `frontend/javascript`; keep functions pure where possible.
- Markdown/Content: posts named `YYYY-MM-DD-title.md`; use kebab-case for asset filenames.

## Testing Guidelines
- Site: ensure `rake test` completes without errors; verify pages render locally.
- MCP: `npm install` then quick check `node gitlab-mcp-server.js --version` or run with env vars and exercise tools (see `.gitlab-ci.yml` for usage patterns).
- Scripts: `test_script.sh` and `test_script_netcat.sh` show Gemini CLI integration examples.

## Commit & Pull Request Guidelines
- Commit messages: short, imperative subject (e.g., "Add MCP server debugging"), optional body for rationale; group related changes.
- PRs: clear description, linked issues/MRs, steps to reproduce, and screenshots/logs when touching CI or MCP server. Update docs when altering public behavior or configuration.
- Branches: use concise, descriptive names (e.g., `feat/mcp-discussions`, `fix/ci-token`).

## Security & Configuration Tips
- Never commit tokens. Use CI/CD variables for `GITLAB_PERSONAL_ACCESS_TOKEN`; local dev can use `.env` but keep it untracked.
- Validate API endpoints with the project’s `GITLAB_API_URL` before running MCP tools.
