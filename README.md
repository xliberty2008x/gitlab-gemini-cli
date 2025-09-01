# GitLab MR Gemini Review

Automated code review for GitLab Merge Requests using the Gemini CLI and an in‑repo MCP server.

## Overview
- Runs on `merge_request_event` and posts inline (anchored) comments plus a summary.
- Uses the in‑repo MCP server (`gitlab-mcp-server.js`) with GitLab API auth via PAT.
- CI prompt follows a GitHub‑style review flow adapted for GitLab.

## Quick Start
1) Set CI/CD Variables in GitLab:
   - `GEMINI_API_KEY` (masked)
   - `GITLAB_REVIEW_PAT` (masked; unprotect for non‑protected branches during testing)
   - Optional: `GITLAB_API_URL` for your instance
2) Open an MR → the pipeline runs and posts review comments.

## Local Testing
- Install deps: `npm install`
- Run MCP server: `npm run mcp:serve`
- The CI job config in `.gitlab-ci.yml` shows how settings.json is generated for Gemini CLI.

## Files
- `.gitlab-ci.yml`: CI job, prompt, and MCP settings
- `gitlab-mcp-server.js`: MCP server with tools for MR reads and discussions
- `AGENTS.md`: contributor guide and roadmap
- `SETUP.md`: end‑to‑end setup for new repos
- `GEMINI.md`: guardrails (backlog to re‑enable)

## License
See `LICENSE`.

