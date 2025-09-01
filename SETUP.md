# End-to-End Setup: Gemini CLI + GitLab MCP

## Prerequisites
- GitLab project (self-hosted or gitlab.com), Maintainer access.
- Personal Access Token (PAT) with `api` scope for a bot account.
- Runner options:
  - Local test: macOS Shell runner on your machine.
  - Production: Linux Docker runner on a remote VM.
- Node.js 20+ installed on Shell runners.

## 1) Repository Setup
- Add these files to a new repo (or copy from this template):
  - `.gitlab-ci.yml` (Gemini review job & prompt)
  - `gitlab-mcp-server.js` (MCP server with MR tools, incl. `update_note`)
  - `package.json` with:
    - `@modelcontextprotocol/sdk@^0.4.0`
    - `node-fetch@^2.6.11`
- If starting fresh:
  - `npm init -y`
  - `npm install @modelcontextprotocol/sdk@0.4.0 node-fetch@2.6.11`

## 2) CI/CD Variables (GitLab → Settings → CI/CD → Variables)
- `GEMINI_API_KEY` (masked): Gemini API key from AI Studio.
- `GITLAB_REVIEW_PAT` (masked): GitLab PAT for the bot.
  - During testing, uncheck “Protected” so MRs from non‑protected branches get the token.
- Optional: `GITLAB_API_URL` (default in repo is your self‑hosted URL).

## 3) Local Testing (macOS Shell Runner)
- Install and register GitLab Runner (Shell executor) on your Mac.
- Ensure host prerequisites:
  - Node 20+ (`brew install node@20`).
- The job installs pinned Gemini CLI via npm automatically.

## 4) CI Job Behavior (What Runs)
- Triggers only on `merge_request_event`.
- Installs `@google/gemini-cli@0.2.2` and project deps.
- Writes `~/.gemini/settings.json` to spawn the in‑repo MCP via stdio:
  - Env: `GITLAB_PERSONAL_ACCESS_TOKEN=$GITLAB_REVIEW_PAT`, `GITLAB_API_URL=…`, `GITLAB_TOKEN_HEADER=PRIVATE-TOKEN`.
- Runs a non‑interactive review guided by `GEMINI.md` guardrails:
  - Fetches MR details/commits/changes via MCP tools.
  - Posts exactly one top‑level MR comment with summary + suggestions.
  - Idempotent: searches for marker `[ai-review-bot v1]`; updates existing comment via `update_note`, or creates one if missing.
  - MR variables are passed in the prompt (both plain text and a small JSON block) for robust parsing.

## 5) Trigger & Validate
- Open an MR (feature → `main`).
- Check MR → Pipelines: job `gemini_cli_code_review` runs.
- Expected: one consolidated MR comment (or an update) ending with `[ai-review-bot v1]`.

## 6) Production Runner (Remote Linux)
- Install GitLab Runner (Docker executor) on a VM.
- Register to the project/group; optionally add tags and reference via `tags:` in the job.
- The job uses `node:20-alpine` and installs the pinned Gemini CLI via npm.
- Recommended: build a custom Docker image with Gemini CLI preinstalled, then set `image: your/registry:gemi-node` for faster jobs.

## 7) Security Notes
- Use a least‑privilege PAT (scope: `api`), keep variables masked.
- Re‑enable “Protected” for `GITLAB_REVIEW_PAT` once you use protected branches or scoped environments.

## 8) Troubleshooting
- `gemini: not found` (Shell runner): ensure Node 20+ installed; CI installs CLI via npm.
- 401/403 from MCP: check PAT scope, `GITLAB_API_URL`, and project access.
- Duplicate comments: ensure the updated prompt with marker `[ai-review-bot v1]` is present.
- GEMINI.md not applied: verify the job runs at repo root so Gemini CLI can auto-load `GEMINI.md`; keep the prompt minimal and defer to `GEMINI.md` for rules.
- Protected variables not injected: uncheck “Protected” for PAT during MR testing, or protect the MR source branches.
