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
- Runs a non‑interactive review using a prompt embedded in CI (GitHub-style):
  - Fetches MR details/commits/changes/diffs via MCP tools.
  - Posts exactly one new MR comment per run:
    - Prefer an anchored discussion via `create_mr_discussion_with_position` (position from MR diff_refs + diffs).
    - Fallback: a single top-level note if anchoring isn’t possible.
  - MR variables are passed in the prompt (plain text + JSON MR_CONTEXT) for robust parsing.

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
- Duplicate comments: each run posts one new comment by design (no updates). If you see more than one per run, check the prompt rules and tool call flow.
 - Anchoring failures: pipeline will fall back to a top-level note; verify diff_refs and position object.
- GEMINI.md not applied: verify the job runs at repo root so Gemini CLI can auto-load `GEMINI.md`; keep the prompt minimal and defer to `GEMINI.md` for rules.
- Protected variables not injected: uncheck “Protected” for PAT during MR testing, or protect the MR source branches.
