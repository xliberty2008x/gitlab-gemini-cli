#!/bin/bash
set -euo pipefail
export PATH="/usr/local/share/npm-global/bin:$PATH"

echo "Writing Gemini CLI settings to use GitLab MCP (via mcp-remote)…"
mkdir -p "$HOME/.gemini"
cat > "$HOME/.gemini/settings.json" <<EOF
{
  "mcpServers": {
    "GitLab": {
      "command": "npx",
      "args": ["mcp-remote", "${GITLAB_MCP_URL}", "--header", "Authorization: Bearer ${GITLAB_ACCESS_TOKEN}"]
    }
  }
}
EOF

echo "Performing Code Review with Gemini"
gemini --debug --yolo <<EOF
  Provide a consistent and thorough code review in Gitlab project ${CI_MERGE_REQUEST_PROJECT_URL} for the merge request ${CI_MERGE_REQUEST_IID}
EOF