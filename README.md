# GitLab Gemini CLI

Automation-first setup for Gemini-powered code review on GitLab Merge Requests.

[![npm version](https://img.shields.io/npm/v/gitlab-gemini-cli.svg)](https://www.npmjs.com/package/gitlab-gemini-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation Checklist

- [ ] **Confirm prerequisites**
  - GitLab project with Maintainer access (gitlab.com or self-managed)
  - Node.js 16 or later available locally
  - Gemini API key ([create one](https://aistudio.google.com/app/apikey))
  - GitLab personal access token with the `api` scope
- [ ] **Verify runner availability**
  - Ensure a GitLab Runner is online with the `ai` label (the Runner UI may still call it a "tag") that can execute Node.js 20+ jobs
  - The CI jobs in this toolkit explicitly request the `ai` label; without it, merge-request pipelines remain stuck in the "pending" state
- [ ] **Set CI/CD variables**
  - In **Settings → CI/CD → Variables**, add:

    | Variable | Value | Flags |
    |----------|-------|-------|
    | `GEMINI_API_KEY` | Gemini API key (`AIza...`) | ✅ Masked, ❌ Protected* |
    | `GITLAB_REVIEW_PAT` | GitLab token (`glpat-...`) | ✅ Masked, ❌ Protected* |

    *Temporarily unprotect while testing on non-protected branches.
- [ ] **Initialize the project**

  ```bash
  # From the root of your GitLab project
  npx gitlab-gemini-cli init
  ```

- [ ] **Review and commit generated files**

  ```bash
  git add .gitlab-ci.yml .gitlab/ .skils/ .gitlab-gemini-cli.json gitlab-mcp-server.js package.json package-lock.json
  git commit -m "Add Gemini AI code review"
  git push
  ```

- [ ] **Create a test merge request** (optional but recommended)

  ```bash
  git checkout -b test-gemini-review
  echo "console.log('Hello Gemini');" > test.js
  git add test.js
  git commit -m "Test: AI review"
  git push origin test-gemini-review
  ```

Before clicking **Create merge request**, open the Merge Request form's right-hand sidebar and choose the **`ai`** label from the **Labels** widget so the CI jobs pick the correct runner. After you create the MR, that same label remains visible in the sidebar, matching the GitLab UI screenshot provided in the setup guide. The `.skils/` directory contains the Gemini reviewer bundle. Adjust `.skils/gitlab-mr-reviewer/SKILL.md` and the `references/` notes to match your review standards.

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

### `.skils/` Directory (Reviewer Skill)
- **`gitlab-mr-reviewer/SKILL.md`** - Canonical rulebook Gemini loads before reviewing
- **`gitlab-mr-reviewer/references/`** - Unity performance, Addressables, and Zenject reference notes cited in reviews

### `gitlab-mcp-server.js` (MCP Server)
Node.js server that exposes 20+ GitLab API operations as standardized MCP tools for AI agents.

## 📚 Features

### 🤖 Automatic Code Review
Every merge request gets reviewed automatically:
- Comments only on changed lines
- Up to 5 inline issues + 1 summary note
- Smart line anchoring with fallback
- Respects `.gitignore` patterns
- Loads the `gitlab-mr-reviewer` skill package to enforce GitLab + Unity review rules

#### Duplicate Protection
- The review job preloads existing discussions before Gemini starts, so the agent updates prior findings instead of reopening them.
- Explicit ignore markers let humans suppress intentional findings. Reply to the discussion with one of the following tokens on its own line: `@gemini ignore`, `/gemini ignore`, or `<!-- gemini-ignore -->`.
- When Gemini revisits a valid finding, it now calls `update_note` to edit the original thread rather than creating a duplicate comment.

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

### 📝 Observability
- Set `GITLAB_MCP_LOG_LEVEL` (`error`, `warn`, `info`, `debug`) to mirror every MCP tool request/response in CI logs. Default is `debug`, and sensitive fields such as file contents and note bodies are automatically redacted.
- Gemini CLI runs with `--debug` and `DEBUG` env vars; telemetry is written to `gemini-telemetry.log` which is printed at the end of each job. The log is cleared before each run to avoid repeat entries.
- Make sure `gettext` is available (jobs install it automatically) because `envsubst` is required to render prompts.
- Gemini CLI runs with `--debug` and telemetry logging enabled (see pipelines for `gemini-telemetry.log` output).

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
- ✅ `.skils/gitlab-mr-reviewer/` - Skill bundle loaded by Gemini before every MR review
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
| Job stuck "pending" | Runner missing or no `ai` label configured |
| "gemini: not found" | Runner needs Node 20+ or `node:20-alpine` image |
| "GEMINI_API_KEY is not set" | Check variable exists; uncheck "Protected" for testing |
| "401 Unauthorized" | Verify `GITLAB_REVIEW_PAT` is valid with `api` scope |
| "403 Forbidden" | Check GitLab URL; ensure PAT user has Developer role |
| No comments posted | Normal if no issues found; check job logs |


## Further Reference

For detailed shared runner provisioning steps, see [`SYSADMIN.md`](SYSADMIN.md).

### Architecture

The project ships modular CI/CD components:

- `.gitlab-ci.yml` acts as a router that includes the workflows in `.gitlab/`.
- `.gitlab/merge-request-review.yml`, `.gitlab/issue-triage.yml`, and `.gitlab/manual-invoke.yml` define review, triage, and manual jobs.
- `.skils/gitlab-mr-reviewer/` provides the reviewer skill bundle consumed by Gemini before each run.
- `gitlab-mcp-server.js` exposes GitLab API operations through the Model Context Protocol.

### Features

- Automated code review with inline comments and a summary note per merge request.
- Severity labeling for findings (Critical, High, Medium, Low).
- Issue triage workflow for labeling issues via webhook or schedule.
- Manual invocation job for custom prompts routed through the MCP server.
- Detailed logging via `GITLAB_MCP_LOG_LEVEL` and `gemini-telemetry.log`.

### CLI Commands

- `npx gitlab-gemini-cli init` — bootstrap files and configuration.
- `npx gitlab-gemini-cli validate` — confirm connectivity and credentials.
- `npx gitlab-gemini-cli update` — regenerate workflows with the latest defaults.

### Development

Clone the repository, install dependencies, and run the MCP server locally for testing:

```bash
git clone https://github.com/xliberty2008x/gitlab-gemini-cli.git
cd gitlab-gemini-cli
npm install
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-xxx"
export GITLAB_API_URL="https://gitlab.com/api/v4"
npm run mcp:serve
```

### License

Released under the [MIT License](LICENSE).

### Contributing

Issues and pull requests are welcome.

### Acknowledgments

- [Google Gemini](https://ai.google.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)
