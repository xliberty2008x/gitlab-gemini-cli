# GitLab Gemini CLI

> Automated AI-powered code review for GitLab Merge Requests using Google's Gemini and Model Context Protocol (MCP)

[![npm version](https://img.shields.io/npm/v/gitlab-gemini-cli.svg)](https://www.npmjs.com/package/gitlab-gemini-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What You Get

After installation, every Merge Request automatically receives:
- ✅ Up to 5 inline code review comments on specific lines
- ✅ 1 comprehensive summary review note
- ✅ Severity indicators (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low)
- ✅ AI-powered issue triage and labeling
- ✅ Manual AI invocation for custom tasks

## 📋 Prerequisites

- GitLab project with Maintainer access (gitlab.com or self-hosted)
- GitLab Runner with tag: `ai`
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- GitLab Personal Access Token with `api` scope
- Node.js 16+ installed locally

## 🚀 Quick Start

### One-Command Setup

```bash
# In your GitLab project directory
npx gitlab-gemini-cli init
```

That's it! The installer will:
1. Ask for your GitLab instance type (gitlab.com or self-hosted)
2. Optionally validate your GitLab connection
3. Create `.gitlab-ci.yml` and `.gitlab/` workflow files
4. Configure `gitlab-mcp-server.js` with your GitLab URL
5. Install runtime dependencies (`@modelcontextprotocol/sdk`, `node-fetch`)

> **Note:** `gitlab-gemini-cli` is just a setup tool. You don't need to keep it installed after setup - your CI jobs will work automatically!

### Configuration

**Set CI/CD Variables** in GitLab → **Settings → CI/CD → Variables**:

| Variable | Value | Flags |
|----------|-------|-------|
| `GEMINI_API_KEY` | Your Gemini API key (`AIza...`) | ✅ Masked, ❌ Protected |
| `GITLAB_REVIEW_PAT` | Your GitLab token (`glpat-...`) | ✅ Masked, ❌ Protected |

> **Note:** Uncheck "Protected" for testing on non-protected branches. Re-enable for production.

### Commit and Test

```bash
# Commit the changes
git add .gitlab-ci.yml .gitlab/ gitlab-mcp-server.js package.json
git commit -m "Add Gemini AI code review"
git push

# Create a test MR
git checkout -b test-gemini-review
echo "console.log('Hello Gemini');" > test.js
git add test.js
git commit -m "Test: AI review"
git push origin test-gemini-review
```

Then create a Merge Request in GitLab and watch the AI review in action! 🎉

## 🏗️ Architecture

This project uses a **modular CI/CD architecture** with:

### `.gitlab-ci.yml` (Router)
A simple file that includes workflow modules from `.gitlab/` directory:
```yaml
stages:
  - dispatch
  - review
  - triage

include:
  - local: '.gitlab/merge-request-review.yml'
  - local: '.gitlab/issue-triage.yml'
  - local: '.gitlab/manual-invoke.yml'
```

### `.gitlab/` Directory (Workflows)
- **`merge-request-review.yml`** - Automatic code review on every MR
- **`issue-triage.yml`** - AI-powered issue labeling (webhook/scheduled)
- **`manual-invoke.yml`** - On-demand AI tasks (manual trigger)

### `gitlab-mcp-server.js` (MCP Server)
Node.js server that exposes 20+ GitLab API operations as standardized MCP tools for AI agents.

## 📚 Features

### 🤖 Automatic Code Review
Every merge request gets reviewed automatically:
- Comments only on changed lines
- Up to 5 inline issues + 1 summary note
- Smart line anchoring with fallback
- Respects `.gitignore` patterns

### 🏷️ Issue Triage
Automated issue labeling (requires webhook setup):
- Analyzes issue title and description
- Suggests relevant labels from project
- Posts explanation comment
- Scheduled batch processing available

### ⚡ Manual Invocation
Run custom AI tasks on-demand:
- Trigger manually from GitLab UI
- Provide custom prompts via `CUSTOM_PROMPT` variable
- Full access to GitLab MCP tools
- Examples: summarize MRs, audit security, analyze trends

## 🔧 CLI Commands

### `init`
Initialize GitLab Gemini CLI in your project:
```bash
npx gitlab-gemini-cli init

# With options
npx gitlab-gemini-cli init --gitlab-url https://gitlab.example.com
npx gitlab-gemini-cli init --yes  # Skip prompts, use defaults
npx gitlab-gemini-cli init --force  # Overwrite existing files
```

### `validate`
Validate GitLab connection and credentials:
```bash
npx gitlab-gemini-cli validate --gitlab-url https://gitlab.com --token glpat-xxx
```

### `update`
Update existing installation to latest version:
```bash
npx gitlab-gemini-cli update

# Change GitLab URL
npx gitlab-gemini-cli update --gitlab-url https://new-gitlab.com
```

## ❓ FAQ

### Do I need to keep `gitlab-gemini-cli` in my dependencies?

**No!** It's just a one-time setup tool. After running `init`, the package itself is not needed:

```bash
npx gitlab-gemini-cli init  # Setup
# gitlab-gemini-cli is NOT needed after this point
git add . && git commit && git push
# Your CI jobs will work! ✅
```

You can even remove it:
```bash
npm uninstall gitlab-gemini-cli  # Optional cleanup
```

Your CI jobs will continue to work because they install the Gemini CLI directly during execution.

### What gets installed in my project?

**After running `init`, you'll have:**
- ✅ `.gitlab-ci.yml` - CI/CD router configuration
- ✅ `.gitlab/` - Modular workflow files (review, triage, manual)
- ✅ `gitlab-mcp-server.js` - MCP server for GitLab API
- ✅ `.gitlab-gemini-cli.json` - Version tracking config
- ✅ `package.json` dependencies: `@modelcontextprotocol/sdk`, `node-fetch`

**You do NOT need:**
- ❌ `gitlab-gemini-cli` itself in dependencies
- ❌ Gemini CLI installed locally (CI runner installs it)

### Can I use this with existing `.gitlab-ci.yml`?

**Yes!** The installer will:
1. Detect your existing `.gitlab-ci.yml`
2. Ask if you want to overwrite or skip
3. If you skip, manually add the jobs from `.gitlab/` directory

### How do I update to the latest version?

```bash
npx gitlab-gemini-cli update
```

This will regenerate all workflow files with the latest improvements while preserving your GitLab URL configuration.

### Does this work with self-hosted GitLab?

**Absolutely!** Just provide your GitLab URL during setup:

```bash
npx gitlab-gemini-cli init --gitlab-url https://gitlab.mycompany.com
```

The installer automatically handles URL configuration in all files.

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Job stuck "pending" | Runner missing or no `ai` tag configured |
| "gemini: not found" | Runner needs Node 20+ or `node:20-alpine` image |
| "GEMINI_API_KEY is not set" | Check variable exists; uncheck "Protected" for testing |
| "401 Unauthorized" | Verify `GITLAB_REVIEW_PAT` is valid with `api` scope |
| "403 Forbidden" | Check GitLab URL; ensure PAT user has Developer role |
| No comments posted | Normal if no issues found; check job logs |


## 🛠️ Development

### Local Testing

```bash
# Clone repository
git clone https://github.com/xliberty2008x/gitlab-gemini-cli.git
cd gitlab-gemini-cli

# Install dependencies
npm install

# Test MCP server
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-xxx"
export GITLAB_API_URL="https://gitlab.com/api/v4"
npm run mcp:serve
```

### Publishing

```bash
# Update version
npm version patch  # or minor, major

# Publish to npm
npm publish
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 🙏 Acknowledgments

Built with:
- [Google Gemini](https://ai.google.dev/) - AI model
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool standardization
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/) - Automation platform

---

**Setup Time:** 5-10 minutes
**Maintenance:** Zero - runs automatically on every MR
