# GitLab Gemini CLI Auto-Review

Automated AI-powered code review for GitLab Merge Requests using Google's Gemini CLI and Model Context Protocol (MCP).

## What You'll Get

After installation, every Merge Request will automatically receive:
- Up to 5 inline code review comments on specific lines
- 1 summary review note
- Severity indicators (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low)

## Prerequisites

- GitLab project with Maintainer access
- GitLab Runner with tags: `gemini-review`, `docker` (ask your sysadmin if unavailable - see [SYSADMIN.md](SYSADMIN.md))
- Gemini API key (ask your admin or create at [Google AI Studio](https://aistudio.google.com/app/apikey))
- GitLab Personal Access Token with `api` scope

## Installation

Choose one of two methods:

### Method 1: Install from Archive

**Step 1: Extract Files**
```bash
tar -xzf gitlab-gemini-cli-installer.tar.gz
cd gitlab-gemini-cli-installer
```

**Step 2: Copy Files to Your Project**
```bash
cd /path/to/your/project

# Copy the 3 required files
cp /path/to/extracted/.gitlab-ci.yml .
cp /path/to/extracted/gitlab-mcp-server.js .
cp /path/to/extracted/package.json .
```

### Method 2: Install from Git Repository

**Step 1: Clone or Download**
```bash
# Clone this repository
git clone https://github.com/xliberty2008x/gitlab-gemini-cli.git
cd gitlab-gemini-cli
```

**Step 2: Copy Files to Your Project**
```bash
cd /path/to/your/project

# Copy the 3 required files
cp /path/to/gitlab_gemini_cli/.gitlab-ci.yml .
cp /path/to/gitlab_gemini_cli/gitlab-mcp-server.js .
cp /path/to/gitlab_gemini_cli/package.json .
```

### Common Steps (Both Methods)

**Step 3: Verify Runner Availability**

Check if a runner with required tags exists:
1. GitLab → **Settings → CI/CD → Runners**
2. Look for a runner with tags: `gemini-review`, `docker`
3. If missing → ask your sysadmin to set up a runner (see [SYSADMIN.md](SYSADMIN.md))

**Step 4: Get API Keys**

**Gemini API Key:**
- **Option A (Recommended):** Contact your team admin for a Gemini API key
- **Option B:** Create your own at [Google AI Studio](https://aistudio.google.com/app/apikey)

**GitLab Personal Access Token:**
1. GitLab → **Settings → Access Tokens**
2. Create token with **`api` scope**
3. Copy the token (starts with `glpat-...`)

**Step 5: Handle Existing Files**

**If you already have `.gitlab-ci.yml`:**
- Merge the `gemini_cli_code_review` job manually
- Add `review` to your `stages:` list

**If you already have `package.json`:**
```bash
npm install @modelcontextprotocol/sdk@^0.4.0 node-fetch@^2.6.11
```

**Step 6: Configure GitLab CI/CD Variables**

In GitLab: **Settings → CI/CD → Variables**

Add these 2 variables:

| Key | Value | Flags |
|-----|-------|-------|
| `GEMINI_API_KEY` | Your Gemini key (`AIza...`) | ✅ Masked, ❌ Protected |
| `GITLAB_REVIEW_PAT` | Your GitLab token (`glpat-...`) | ✅ Masked, ❌ Protected |

> **Note:** Uncheck "Protected" for testing. Re-enable for production.

**For self-hosted GitLab only:**

| Key | Value | Flags |
|-----|-------|-------|
| `GITLAB_API_URL` | `https://your-gitlab.com/api/v4` | None |

**Step 7: Update API URL (Self-Hosted GitLab Only)**

If using self-hosted GitLab (not gitlab.com), edit these 2 files:

**`gitlab-mcp-server.js` line 8:**
```javascript
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://your-gitlab.com/api/v4";
```

**`.gitlab-ci.yml` line 89:**
```yaml
"GITLAB_API_URL": "https://your-gitlab.com/api/v4",
```

**For gitlab.com:** Use `https://gitlab.com/api/v4`

**Step 8: Commit and Push**

```bash
git add .gitlab-ci.yml gitlab-mcp-server.js package.json
git commit -m "Add Gemini AI code review"
git push origin main
```

**Step 9: Test with a Merge Request**

```bash
# Create test branch
git checkout -b test-gemini-review

# Make a change
echo "console.log('Hello Gemini');" > test.js
git add test.js
git commit -m "Test: AI review"
git push origin test-gemini-review
```

Then:
1. Create a Merge Request in GitLab
2. Watch the pipeline run (job: `gemini_cli_code_review`)
3. Check the MR for review comments (1-3 minutes)

## Expected Behavior

✅ **Success:**
- Pipeline job completes successfully
- MR shows at least 1 summary comment
- Inline comments appear on changed lines (if issues found)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Job stuck "pending" | Runner missing or no matching tags (`gemini-review`, `docker`) - ask sysadmin |
| "gemini: not found" | Runner needs Node 20+ or `node:20-alpine` image |
| "GEMINI_API_KEY is not set" | Check variable exists in CI/CD settings; uncheck "Protected" for testing |
| "401 Unauthorized" | Verify `GITLAB_REVIEW_PAT` is valid and has `api` scope |
| "403 Forbidden" | Check `GITLAB_API_URL` is correct; ensure PAT user has Developer role |
| No comments | Normal if no issues found; check job logs for errors |

## Repository Files

| File | Required | Purpose |
|------|----------|---------|
| `.gitlab-ci.yml` | ✅ | CI job definition and review prompt |
| `gitlab-mcp-server.js` | ✅ | MCP server with GitLab API tools |
| `package.json` | ✅ | Node.js dependencies |
| `README.md` | 📄 | Installation guide |

## For Administrators

**GitLab Runner Setup:**
- See [SYSADMIN.md](SYSADMIN.md) for setting up shared runners with Docker executor

**API Key Management:**
- See [GCP_API_KEY_MANAGEMENT.md](GCP_API_KEY_MANAGEMENT.md) for corporate GCP API keys with usage tracking

**Architecture:**
- See [CLAUDE.md](CLAUDE.md) for MCP server implementation and technical details

---

**Setup Time:** 15-30 minutes
