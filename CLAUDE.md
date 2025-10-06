# GitLab Gemini CLI - Project Documentation

## Overview

This project implements **automated AI-powered code review for GitLab Merge Requests** using Google's Gemini CLI and a custom Model Context Protocol (MCP) server. The core feature is `gitlab_gemini_cli`, which enables autonomous code review agents to interact with GitLab MRs through a standardized tool interface.

**Note:** All other code in this repository (Bridgetown site, Ruby plugins, frontend assets) is for demonstration purposes only.

## Architecture

The system consists of three key components:

### 1. GitLab MCP Server ([gitlab-mcp-server.js](gitlab-mcp-server.js))

A Node.js MCP server that exposes GitLab API operations as standardized tools for AI agents:

**Key Features:**
- **Authentication:** Supports PAT (Personal Access Token) via configurable headers (`PRIVATE-TOKEN`, `Authorization`, or `JOB-TOKEN`)
- **Transport:** Runs over stdio for secure, sandboxed communication
- **API Coverage:** 20+ tools covering MR reads, discussions, file operations, and pipelines

**Critical Tools:**
- `get_merge_request`, `get_merge_request_changes`, `get_merge_request_commits` - Read MR data
- `list_merge_request_diffs` - Fetch detailed unified diffs
- `create_anchored_discussion_auto` - Create inline comments with automatic position calculation
- `discussion_add_note` - Add top-level or reply notes
- `get_file_contents` - Read repository files

**Smart Anchoring:**
The `create_anchored_discussion_auto` tool ([gitlab-mcp-server.js:549-628](gitlab-mcp-server.js#L549-L628)) automatically:
1. Fetches MR `diff_refs` (base/start/head SHAs)
2. Parses unified diffs to find the first added line in changed files
3. Creates a GitLab position object (`position_type: 'text'`, `new_path`, `new_line`, SHAs)
4. Falls back to top-level notes if anchoring fails

### 2. GitLab CI Integration ([.gitlab-ci.yml](.gitlab-ci.yml))

CI job that triggers on `merge_request_event` and orchestrates the review:

**Workflow:**
```
MR Created → CI Triggered → Setup Environment → Generate Settings → Run Review → Post Comments
```

**Key Steps:**
1. **Environment Detection** (lines 12-54): Auto-detects macOS/Linux runners, installs Node 20, Gemini CLI (pinned to v0.2.2), and `envsubst`
2. **Settings Generation** (lines 79-109): Creates `~/.gemini/settings.json` with MCP server config:
   ```json
   {
     "mcpServers": {
       "gitlab": {
         "command": "node",
         "args": ["${CI_PROJECT_DIR}/gitlab-mcp-server.js"],
         "env": {
           "GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_REVIEW_PAT}",
           "GITLAB_API_URL": "https://hs2git.ab-games.com/api/v4"
         }
       }
     }
   }
   ```
3. **Prompt Rendering** (lines 111-154): Writes prompt template with MR context variables, uses `envsubst` to inject CI variables safely, pipes to Gemini CLI

**Concurrency Control:**
```yaml
resource_group: "gemini-review-$CI_MERGE_REQUEST_IID"
```
Prevents overlapping reviews on the same MR.

### 3. Review Agent Prompt ([.gitlab-ci.yml:112-151](.gitlab-ci.yml#L112-L151))

A GitHub-style review prompt adapted for GitLab that instructs Gemini to:

**Constraints:**
- Interact ONLY via MCP tools (no shell commands)
- Comment ONLY on changed lines (not context)
- Post ≤5 inline issues + 1 summary note
- Preserve indentation/syntax in suggestions
- Use severity levels: 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low

**Workflow:**
1. Validate access with `get_merge_request`
2. Gather diffs via `get_merge_request_changes` / `list_merge_request_diffs`
3. Post inline comments via `create_anchored_discussion_auto`
4. Post summary note via `discussion_add_note`
5. Fallback to single consolidated note if anchoring unavailable

**Context Injection:**
```bash
MR_CONTEXT (JSON):
{"project_id":"${CI_PROJECT_ID}","mr_iid":"${CI_MERGE_REQUEST_IID}",...}
```

## How It Works

### End-to-End Flow

```
┌─────────────────┐
│ Developer       │
│ Opens MR        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ GitLab CI (.gitlab-ci.yml)                                  │
│ 1. Detects OS, installs Gemini CLI v0.2.2 + deps          │
│ 2. Writes ~/.gemini/settings.json with MCP server config   │
│ 3. Renders prompt.tmpl → gemini --yolo                     │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Gemini CLI + MCP Server (gitlab-mcp-server.js)             │
│ 1. Spawns server: node gitlab-mcp-server.js                │
│ 2. Agent calls: get_merge_request → get_changes → diffs   │
│ 3. Analyzes code, identifies 5 issues                      │
│ 4. Calls: create_anchored_discussion_auto (5x)            │
│ 5. Calls: discussion_add_note (summary)                   │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ GitLab API (via GITLAB_REVIEW_PAT)                         │
│ - GET /merge_requests/:iid/changes                         │
│ - POST /merge_requests/:iid/discussions (with position)    │
│ - POST /merge_requests/:iid/notes                          │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ MR shows inline │
│ comments +      │
│ summary note    │
└─────────────────┘
```

### Position Calculation Deep Dive

The server's auto-anchoring logic ([gitlab-mcp-server.js:551-578](gitlab-mcp-server.js#L551-L578)) parses unified diffs:

```diff
@@ -10,3 +10,5 @@
 context line
-removed line
+added line 1    ← new_line = 12 (target this)
+added line 2
```

Algorithm:
1. Parse `@@ -a,b +c,d @@` headers to track `new_line` counter
2. Increment on `+` (added) and ` ` (context) lines
3. Return first `new_line` with `+` prefix
4. Build position object: `{position_type:'text', base_sha, start_sha, head_sha, new_path, new_line}`

## Configuration

### Required CI/CD Variables

Set in **GitLab → Settings → CI/CD → Variables**:

| Variable | Type | Description |
|----------|------|-------------|
| `GEMINI_API_KEY` | Masked | Google AI Studio API key |
| `GITLAB_REVIEW_PAT` | Masked | GitLab PAT with `api` scope (unprotect for testing) |
| `GITLAB_API_URL` | Optional | Default: `https://hs2git.ab-games.com/api/v4` |

### Runner Requirements

**Option A: Docker Executor (Production)**
- Image: `node:20-alpine`
- Auto-installs: `@google/gemini-cli@0.2.2` + `@modelcontextprotocol/sdk`
- Fast: Consider pre-baking a custom image with CLI preinstalled

**Option B: Shell Executor (macOS Testing)**
- Host needs: Node 20+, Homebrew (for `gettext`/`envsubst`)
- Job installs CLI via `npm install -g`

## Review Guardrails ([GEMINI.md](GEMINI.md))

Defines agent behavior constraints:

**Review Criteria (Priority Order):**
1. Correctness - logic errors, edge cases
2. Security - injection, access controls, secrets
3. Efficiency - performance bottlenecks
4. Maintainability - readability, modularity
5. Testing - coverage quality
6. Observability - logging/monitoring

**Execution Model:**
- ≤5 inline (anchored) comments per run
- Exactly 1 top-level summary note
- Fallback to consolidated note if anchoring fails

**Templates:**
```markdown
🔴 Critical: Missing SQL injection protection

```suggestion
const query = 'SELECT * FROM users WHERE id = ?'
db.query(query, [userId])
```
```

## Local Development

### Test MCP Server

```bash
npm install
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-xxx"
export GITLAB_API_URL="https://gitlab.example.com/api/v4"
npm run mcp:serve
```

### Invoke Tools Manually

Use MCP client or test scripts:

```bash
# List tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gitlab-mcp-server.js

# Get MR
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_merge_request","arguments":{"project_id":"123","merge_request_iid":"45"}},"id":2}' | node gitlab-mcp-server.js
```

### Test CI Job Locally

Requires GitLab Runner installed:

```bash
# Set env vars
export GEMINI_API_KEY="..."
export GITLAB_REVIEW_PAT="..."
export CI_PROJECT_DIR=$(pwd)
export CI_PROJECT_ID="123"
export CI_MERGE_REQUEST_IID="45"
# ... (all CI vars)

# Run script block manually
npm install --omit=dev
# Copy lines 79-154 from .gitlab-ci.yml
```

## Key Features

### 1. Safe Prompt Injection
Uses `envsubst` instead of shell interpolation to prevent code injection:
```bash
cat > prompt.tmpl <<'PROMPT'
Review MR ${CI_MERGE_REQUEST_IID}
PROMPT
envsubst < prompt.tmpl | gemini --yolo
```

### 2. Robust Error Handling
- MCP server returns `{isError: true}` on failures ([gitlab-mcp-server.js:646-653](gitlab-mcp-server.js#L646-L653))
- Auto-anchoring falls back to top-level notes with error context
- CI validates required vars before execution ([.gitlab-ci.yml:58-69](.gitlab-ci.yml#L58-L69))

### 3. Multi-Platform Support
- Detects OS via `uname -s` ([.gitlab-ci.yml:12-13](.gitlab-ci.yml#L12-L13))
- macOS: Uses Homebrew for Node/gettext
- Linux: Uses `apk`/`apt-get` for system deps
- Both: Installs pinned Gemini CLI via npm

## Limitations & Future Work

### Current Limitations
1. **One Review Per Run:** Each pipeline creates new comments (no in-place updates)
2. **Max 5 Inline Issues:** Prevents comment spam but may miss issues
3. **No GEMINI.md Auto-Loading:** Rules are CI-embedded; GEMINI.md is documentation only
4. **Fixed Position Anchoring:** Uses first added line, not optimal line selection

### Roadmap ([AGENTS.md:66-71](AGENTS.md#L66-L71))
- [ ] Typed `GitLabApiError` with `status`/`body` fields
- [ ] Extract CI setup to `scripts/setup_ci.sh`
- [ ] Custom Docker image with preinstalled CLI (faster builds)
- [ ] Commit-level comments via `add_commit_comment` tool
- [ ] GEMINI.md as loadable context for Gemini CLI

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `gemini: not found` | CLI not installed | Check runner has Node 20+; verify npm install succeeds |
| 401/403 from MCP | Bad PAT or URL | Verify `GITLAB_REVIEW_PAT` scope, check `GITLAB_API_URL` |
| No inline comments | Anchoring failed | Check job logs for `create_anchored_discussion_auto` errors; fallback note should still post |
| Duplicate reviews | Multiple pipeline runs | Expected - each run posts new comments; use `resource_group` to serialize |
| Protected var not injected | Branch not protected | Uncheck "Protected" in CI/CD Variables during testing |

## Security Notes

- **Least Privilege PAT:** Use bot account with minimal `api` scope
- **Masked Variables:** All tokens stored as GitLab masked variables
- **Stdio Transport:** MCP server runs sandboxed via stdio (no network exposure)
- **No Secrets in Logs:** Prompt uses envsubst to avoid leaking vars in `--debug` output

## Files Reference

| File | Purpose |
|------|---------|
| [.gitlab-ci.yml](.gitlab-ci.yml) | CI job definition, prompt template, settings generation |
| [gitlab-mcp-server.js](gitlab-mcp-server.js) | MCP server with 20+ GitLab tools |
| [GEMINI.md](GEMINI.md) | Review guardrails and templates (documentation) |
| [SETUP.md](SETUP.md) | End-to-end setup guide for new repos |
| [AGENTS.md](AGENTS.md) | Contributor guide, roadmap, CI troubleshooting |
| [package.json](package.json) | Dependencies: `@modelcontextprotocol/sdk`, `node-fetch` |

## Quick Start

1. **Clone/Fork Repo**
2. **Set CI Variables:** `GEMINI_API_KEY`, `GITLAB_REVIEW_PAT`
3. **Open MR** → Pipeline runs `gemini_cli_code_review` job
4. **Check MR Comments** → Inline issues + summary note appear

That's it! The AI reviews your code automatically on every MR.
