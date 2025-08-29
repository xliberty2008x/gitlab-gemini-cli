#!/bin/bash
set -euo pipefail
export PATH="/usr/local/share/npm-global/bin:$PATH"

# Wait for the MCP server to be ready.
# nc is not available in the sandbox, so we use bash's built-in TCP support.
until exec 3<>/dev/tcp/gitlab-mcp-server/8080; do
  echo "Waiting for gitlab-mcp-server..."
  sleep 1
done
exec 3<&-
exec 3>&-
echo "gitlab-mcp-server is ready."

echo "Writing Gemini CLI settings..."
mkdir -p "$HOME/.gemini"
cat > "$HOME/.gemini/settings.json" <<EOF
{
  "mcpServers": {
    "GitLab": {
      "command": "nc",
      "args": ["gitlab-mcp-server", "8080"]
    }
  }
}
EOF

echo "Performing Code Review with Gemini"
gemini --debug --yolo <<EOF
  Provide a consistent and thorough code review in Gitlab project ${CI_MERGE_REQUEST_PROJECT_URL} for the merge request ${CI_MERGE_REQUEST_IID}
EOF
