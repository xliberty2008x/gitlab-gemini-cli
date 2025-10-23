#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const fetch = require("node-fetch");

const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.example.com/api/v4";
const GITLAB_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_TOKEN_HEADER = process.env.GITLAB_TOKEN_HEADER || "Authorization"; // "JOB-TOKEN", "PRIVATE-TOKEN", or "Authorization"

if (!GITLAB_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is required");
  process.exit(1);
}

const server = new Server(
  {
    name: "enhanced-gitlab-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to make GitLab API calls
async function gitlabApi(endpoint, options = {}) {
  const url = `${GITLAB_API_URL}${endpoint}`;
  const authHeaders = (() => {
    if (GITLAB_TOKEN_HEADER === "JOB-TOKEN") return { "JOB-TOKEN": GITLAB_TOKEN };
    if (GITLAB_TOKEN_HEADER === "PRIVATE-TOKEN") return { "PRIVATE-TOKEN": GITLAB_TOKEN };
    return { "Authorization": `Bearer ${GITLAB_TOKEN}` };
  })();
  const response = await fetch(url, {
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Logging helpers
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const resolvedLogLevelName =
  (process.env.GITLAB_MCP_LOG_LEVEL ||
    process.env.GITLAB_MCP_LOG ||
    process.env.MCP_LOG_LEVEL ||
    "debug").toLowerCase();
const CURRENT_LOG_LEVEL =
  LOG_LEVELS[resolvedLogLevelName] !== undefined
    ? LOG_LEVELS[resolvedLogLevelName]
    : LOG_LEVELS.info;

function log(level, message, details) {
  const target = LOG_LEVELS[level];
  if (target === undefined || target > CURRENT_LOG_LEVEL) {
    return;
  }
  const parts = [`[MCP:${level.toUpperCase()}]`, message];
  if (details !== undefined) {
    try {
      parts.push(JSON.stringify(details));
    } catch (error) {
      parts.push('[unserializable-details]');
    }
  }
  process.stderr.write(parts.join(' ') + '\n');
}

function redactValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return `[redacted ${value.length} chars]`;
  }
  if (Array.isArray(value)) {
    return `[redacted array(${value.length})]`;
  }
  if (typeof value === "object") {
    return "[redacted object]";
  }
  return "[redacted]";
}

function sanitizeArgs(name, args = {}) {
  if (!args || typeof args !== "object") {
    return args;
  }
  const sensitiveKeys = new Set(["content", "body", "description", "token"]);
  const sanitized = {};
  for (const [key, value] of Object.entries(args)) {
    sanitized[key] = sensitiveKeys.has(key) ? redactValue(value) : value;
  }
  return sanitized;
}

function summarizeContent(content) {
  if (!Array.isArray(content)) {
    return content;
  }
  return content.map((item, index) => {
    if (!item || typeof item !== "object") {
      return { index, type: typeof item };
    }
    const summary = { index, type: item.type };
    if (typeof item.text === "string") {
      summary.length = item.text.length;
      summary.preview = item.text.slice(0, 120);
    }
    return summary;
  });
}

function summarizeResult(result) {
  if (!result || typeof result !== "object") {
    return { result };
  }
  const summary = {
    isError: Boolean(result.isError),
  };
  if ("content" in result) {
    summary.content = summarizeContent(result.content);
  }
  return summary;
}

function logToolRequest(name, args) {
  log("info", `Tool call requested: ${name}`, { args: sanitizeArgs(name, args) });
}

function logToolResponse(name, result) {
  log("info", `Tool call completed: ${name}`, summarizeResult(result));
}

function logToolError(name, error) {
  log("error", `Tool call failed: ${name}`, { message: error.message });
}

// List all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Original community tools
      {
        name: "create_or_update_file",
        description: "Create or update a single file in a GitLab project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            file_path: { type: "string", description: "Path where to create/update the file" },
            content: { type: "string", description: "Content of the file" },
            commit_message: { type: "string", description: "Commit message" },
            branch: { type: "string", description: "Branch to create/update the file in" },
          },
          required: ["project_id", "file_path", "content", "commit_message", "branch"],
        },
      },
      {
        name: "get_file_contents",
        description: "Get contents of a file or directory from a GitLab project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            file_path: { type: "string", description: "Path to file/directory" },
            ref: { type: "string", description: "Branch/tag/commit to get contents from" },
          },
          required: ["project_id", "file_path"],
        },
      },
      {
        name: "create_merge_request",
        description: "Create a new merge request in a GitLab project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            title: { type: "string", description: "MR title" },
            description: { type: "string", description: "MR description" },
            source_branch: { type: "string", description: "Branch containing changes" },
            target_branch: { type: "string", description: "Branch to merge into" },
          },
          required: ["project_id", "title", "source_branch", "target_branch"],
        },
      },
      // NEW: Missing MR read functions
      {
        name: "get_merge_request",
        description: "Get details of a specific merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "get_merge_request_commits",
        description: "Get commits in a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "get_merge_request_changes",
        description: "Get file changes in a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "list_merge_requests",
        description: "List merge requests in a project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            state: { type: "string", enum: ["opened", "closed", "merged"], description: "MR state filter" },
            per_page: { type: "number", description: "Results per page" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "get_issue",
        description: "Get details of a specific issue",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            issue_iid: { type: "string", description: "Issue IID" },
          },
          required: ["project_id", "issue_iid"],
        },
      },
      {
        name: "list_issues",
        description: "List issues in a project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            state: { type: "string", enum: ["opened", "closed", "all"], description: "Issue state filter" },
            labels: { type: "array", items: { type: "string" }, description: "Labels to filter by" },
            per_page: { type: "number", description: "Results per page" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "list_project_labels",
        description: "List labels configured in a project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            per_page: { type: "number", description: "Results per page" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "add_issue_labels",
        description: "Add labels to an issue",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            issue_iid: { type: "string", description: "Issue IID" },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels to add",
            },
          },
          required: ["project_id", "issue_iid", "labels"],
        },
      },
      {
        name: "create_issue_note",
        description: "Create a note on an issue",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            issue_iid: { type: "string", description: "Issue IID" },
            body: { type: "string", description: "Note content" },
          },
          required: ["project_id", "issue_iid", "body"],
        },
      },
      // NEW: Pipeline tools
      {
        name: "get_pipeline_jobs",
        description: "Get jobs in a specific pipeline",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            pipeline_id: { type: "string", description: "Pipeline ID" },
          },
          required: ["project_id", "pipeline_id"],
        },
      },
      {
        name: "get_merge_request_pipelines",
        description: "Get pipelines for a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "get_pipeline",
        description: "Get details of a specific pipeline",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            pipeline_id: { type: "string", description: "Pipeline ID" },
          },
          required: ["project_id", "pipeline_id"],
        },
      },
      {
        name: "list_pipelines",
        description: "List pipelines in a project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            status: { type: "string", enum: ["created", "waiting_for_resource", "preparing", "pending", "running", "success", "failed", "canceled", "skipped", "manual", "scheduled"], description: "Pipeline status filter" },
            ref: { type: "string", description: "Branch/tag name filter" },
            per_page: { type: "number", description: "Results per page" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "get_job_log",
        description: "Get log output from a specific job",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            job_id: { type: "string", description: "Job ID" },
          },
          required: ["project_id", "job_id"],
        },
      },
      {
        name: "retry_pipeline",
        description: "Retry a failed pipeline",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            pipeline_id: { type: "string", description: "Pipeline ID" },
          },
          required: ["project_id", "pipeline_id"],
        },
      },
      {
        name: "cancel_pipeline",
        description: "Cancel a running pipeline",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            pipeline_id: { type: "string", description: "Pipeline ID" },
          },
          required: ["project_id", "pipeline_id"],
        },
      },
      {
        name: "trigger_pipeline",
        description: "Trigger a new pipeline",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            ref: { type: "string", description: "Branch or tag to run pipeline for" },
            variables: { type: "object", description: "Pipeline variables as key-value pairs" },
          },
          required: ["project_id", "ref"],
        },
      },
      {
        name: "discussion_add_note",
        description: "Add a note/comment to a merge request discussion",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
            body: { type: "string", description: "The content of the note/comment" },
            discussion_id: { type: "string", description: "Discussion ID (optional, for replying to existing discussion)" }
          },
          required: ["project_id", "merge_request_iid", "body"],
        },
      },
      {
        name: "update_note",
        description: "Update an existing merge request note by ID",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
            note_id: { type: "string", description: "Note ID to update" },
            body: { type: "string", description: "New content for the note" },
          },
          required: ["project_id", "merge_request_iid", "note_id", "body"],
        },
      },
      {
        name: "discussion_list",
        description: "List all discussions/comments in a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "get_merge_request_participants",
        description: "Get participants (users involved) in a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "list_merge_request_diffs",
        description: "List detailed diffs for a merge request",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
          },
          required: ["project_id", "merge_request_iid"],
        },
      },
      {
        name: "create_anchored_discussion_auto",
        description: "Create a new MR discussion anchored to the first added line in the latest diffs. Falls back to top-level note on failure.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
            body: { type: "string", description: "Discussion body text" }
          },
          required: ["project_id", "merge_request_iid", "body"],
        },
      },
      {
        name: "create_mr_discussion_with_position",
        description: "Create a new MR discussion anchored to a specific diff position",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or URL-encoded path" },
            merge_request_iid: { type: "string", description: "Merge request IID" },
            body: { type: "string", description: "Discussion body text" },
            position: {
              type: "object",
              description: "GitLab diff position object",
              properties: {
                position_type: { type: "string", enum: ["text", "image"], description: "Position type" },
                base_sha: { type: "string" },
                start_sha: { type: "string" },
                head_sha: { type: "string" },
                new_path: { type: "string" },
                old_path: { type: "string" },
                new_line: { type: "number" },
                old_line: { type: "number" }
              },
              required: ["position_type", "base_sha", "start_sha", "head_sha"],
            }
          },
          required: ["project_id", "merge_request_iid", "body", "position"],
        },
      },
    ],
  };
});

// Handle tool calls
async function executeTool(name, args) {
  switch (name) {
      case "get_merge_request":
        const mr = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}`);
        return { content: [{ type: "text", text: JSON.stringify(mr, null, 2) }] };

      case "get_merge_request_commits":
        const commits = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/commits`);
        return { content: [{ type: "text", text: JSON.stringify(commits, null, 2) }] };

      case "get_merge_request_changes":
        const changes = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/changes`);
        return { content: [{ type: "text", text: JSON.stringify(changes, null, 2) }] };

      case "list_merge_requests":
        const params = new URLSearchParams();
        if (args.state) params.append("state", args.state);
        if (args.per_page) params.append("per_page", args.per_page);
        const mrs = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests?${params}`);
        return { content: [{ type: "text", text: JSON.stringify(mrs, null, 2) }] };

      case "get_issue":
        const issue = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/issues/${args.issue_iid}`);
        return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };

      case "list_issues": {
        const params = new URLSearchParams();
        if (args.state) params.append("state", args.state);
        if (args.labels && args.labels.length) {
          const labels = Array.isArray(args.labels) ? args.labels.join(",") : args.labels;
          if (labels) params.append("labels", labels);
        }
        if (args.per_page) params.append("per_page", args.per_page);
        const query = params.toString();
        const endpoint = `/projects/${encodeURIComponent(args.project_id)}/issues${query ? `?${query}` : ""}`;
        const issues = await gitlabApi(endpoint);
        return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
      }

      case "list_project_labels": {
        const params = new URLSearchParams();
        if (args.per_page) params.append("per_page", args.per_page);
        const query = params.toString();
        const endpoint = `/projects/${encodeURIComponent(args.project_id)}/labels${query ? `?${query}` : ""}`;
        const labels = await gitlabApi(endpoint);
        return { content: [{ type: "text", text: JSON.stringify(labels, null, 2) }] };
      }

      case "add_issue_labels": {
        if (!args.labels || !args.labels.length) {
          throw new Error("labels array is required");
        }
        const labels = Array.isArray(args.labels) ? args.labels.join(",") : args.labels;
        const payload = { add_labels: labels };
        const updatedIssue = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/issues/${args.issue_iid}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        return { content: [{ type: "text", text: JSON.stringify(updatedIssue, null, 2) }] };
      }

      case "create_issue_note": {
        const payload = { body: args.body };
        const note = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/issues/${args.issue_iid}/notes`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return { content: [{ type: "text", text: JSON.stringify(note, null, 2) }] };
      }

      case "get_file_contents": {
        let ref = args.ref;
        if (!ref) {
          try {
            const project = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}`);
            ref = project.default_branch || 'main';
          } catch (error) {
            ref = 'main';
          }
        }
        const file = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/repository/files/${encodeURIComponent(args.file_path)}?ref=${ref}`);
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        return { content: [{ type: "text", text: content }] };
      }

      case "create_or_update_file": {
        let method = "POST";
        try {
          await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/repository/files/${encodeURIComponent(args.file_path)}?ref=${args.branch}`);
          method = "PUT";
        } catch (error) {
          // If GET fails, assume file doesn't exist and create via POST
        }
        const fileData = {
          branch: args.branch,
          commit_message: args.commit_message,
          content: args.content,
        };
        const result = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/repository/files/${encodeURIComponent(args.file_path)}`, {
          method,
          body: JSON.stringify(fileData),
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "create_merge_request":
        const mrData = {
          title: args.title,
          description: args.description || "",
          source_branch: args.source_branch,
          target_branch: args.target_branch,
        };
        const newMr = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests`, {
          method: "POST",
          body: JSON.stringify(mrData),
        });
        return { content: [{ type: "text", text: JSON.stringify(newMr, null, 2) }] };

      // Pipeline tools handlers
      case "get_pipeline_jobs":
        const jobs = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipelines/${args.pipeline_id}/jobs`);
        return { content: [{ type: "text", text: JSON.stringify(jobs, null, 2) }] };

      case "get_merge_request_pipelines":
        const mrPipelines = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/pipelines`);
        return { content: [{ type: "text", text: JSON.stringify(mrPipelines, null, 2) }] };

      case "get_pipeline":
        const pipeline = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipelines/${args.pipeline_id}`);
        return { content: [{ type: "text", text: JSON.stringify(pipeline, null, 2) }] };

      case "list_pipelines":
        const pipelineParams = new URLSearchParams();
        if (args.status) pipelineParams.append("status", args.status);
        if (args.ref) pipelineParams.append("ref", args.ref);
        if (args.per_page) pipelineParams.append("per_page", args.per_page);
        const pipelines = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipelines?${pipelineParams}`);
        return { content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }] };

      case "get_job_log": {
        // Job logs return plain text, not JSON
        const logUrl = `${GITLAB_API_URL}/projects/${encodeURIComponent(args.project_id)}/jobs/${args.job_id}/trace`;
        const authHeaders = (() => {
          if (GITLAB_TOKEN_HEADER === "JOB-TOKEN") return { "JOB-TOKEN": GITLAB_TOKEN };
          if (GITLAB_TOKEN_HEADER === "PRIVATE-TOKEN") return { "PRIVATE-TOKEN": GITLAB_TOKEN };
          return { "Authorization": `Bearer ${GITLAB_TOKEN}` };
        })();
        const logResponse = await fetch(logUrl, { headers: { ...authHeaders } });
        if (!logResponse.ok) {
          throw new Error(`GitLab API error: ${logResponse.status} ${logResponse.statusText}`);
        }
        const logText = await logResponse.text();
        return { content: [{ type: "text", text: logText }] };
      }

      case "retry_pipeline":
        const retryResult = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipelines/${args.pipeline_id}/retry`, {
          method: "POST",
        });
        return { content: [{ type: "text", text: JSON.stringify(retryResult, null, 2) }] };

      case "cancel_pipeline":
        const cancelResult = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipelines/${args.pipeline_id}/cancel`, {
          method: "POST",
        });
        return { content: [{ type: "text", text: JSON.stringify(cancelResult, null, 2) }] };

      case "trigger_pipeline":
        const triggerData = {
          ref: args.ref,
          variables: args.variables || {},
        };
        const triggerResult = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/pipeline`, {
          method: "POST",
          body: JSON.stringify(triggerData),
        });
        return { content: [{ type: "text", text: JSON.stringify(triggerResult, null, 2) }] };

      // NEW: Discussion/Comment tools handlers
      case "discussion_add_note":
        let noteEndpoint;
        let noteData;
        
        if (args.discussion_id) {
          // Reply to existing discussion
          noteEndpoint = `/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/discussions/${args.discussion_id}/notes`;
          noteData = { body: args.body };
        } else {
          // Create new discussion/comment
          noteEndpoint = `/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/notes`;
          noteData = { body: args.body };
        }
        
        const noteResult = await gitlabApi(noteEndpoint, {
          method: "POST",
          body: JSON.stringify(noteData),
        });
        return { content: [{ type: "text", text: JSON.stringify(noteResult, null, 2) }] };

      case "discussion_list":
        const discussions = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/discussions`);
        return { content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }] };

      case "update_note":
        const updated = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/notes/${args.note_id}`, {
          method: "PUT",
          body: JSON.stringify({ body: args.body }),
        });
        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };

      case "get_merge_request_participants":
        const participants = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/participants`);
        return { content: [{ type: "text", text: JSON.stringify(participants, null, 2) }] };

      case "list_merge_request_diffs":
        const diffs = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/diffs`);
        return { content: [{ type: "text", text: JSON.stringify(diffs, null, 2) }] };

      case "create_anchored_discussion_auto": {
        // Helper to parse unified diffs and find the first added new_line
        function findFirstAddedLine(diffText) {
          if (!diffText) return null;
          const lines = diffText.split(/\r?\n/);
          let currentNew = null;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('@@')) {
              // Example: @@ -a,b +c,d @@ or @@ -a +c @@
              const m = /@@\s-\d+(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/.exec(line);
              if (m) currentNew = parseInt(m[1], 10) - 1; // will increment on context/+ lines
              continue;
            }
            if (currentNew === null) continue;
            if (line.startsWith('--- ') || line.startsWith('+++ ')) continue; // headers
            if (line.startsWith('+')) {
              currentNew += 1;
              // Skip file header lines like +++ which we filtered; return the first added code line
              return currentNew;
            } else if (line.startsWith(' ')) {
              currentNew += 1; // context advances new line count
            } else if (line.startsWith('-')) {
              // removed line: advances old only, not new
            } else {
              // unknown; ignore
            }
          }
          return null;
        }

        try {
          // Fetch MR for diff_refs
          const mr = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}`);
          const refs = mr && mr.diff_refs ? mr.diff_refs : null;
          if (!refs || !refs.base_sha || !refs.start_sha || !refs.head_sha) {
            throw new Error('Missing diff_refs for MR; cannot anchor');
          }

          // Fetch changes to get per-file unified diffs
          const changesResp = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/changes`);
          const changes = (changesResp && changesResp.changes) || [];
          let position = null;
          for (const ch of changes) {
            const diffText = ch.diff || ch.patch || '';
            const newLine = findFirstAddedLine(diffText);
            const newPath = ch.new_path || ch.newFile || ch.new_path; // prefer new_path
            if (newLine && newPath) {
              position = {
                position_type: 'text',
                base_sha: refs.base_sha,
                start_sha: refs.start_sha,
                head_sha: refs.head_sha,
                new_path: newPath,
                new_line: newLine,
              };
              break;
            }
          }

          if (!position) {
            throw new Error('Could not determine a valid added line to anchor');
          }

          const payload = { body: args.body, position };
          const created = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/discussions`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
        } catch (e) {
          // Fallback to top-level note
          const noteBody = `${args.body}\n\n_(Auto-anchoring unavailable: ${e.message})_`;
          const note = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/notes`, {
            method: 'POST',
            body: JSON.stringify({ body: noteBody }),
          });
          return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
        }
      }

      case "create_mr_discussion_with_position": {
        const payload = {
          body: args.body,
          position: args.position,
        };
        const created = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/discussions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logToolRequest(name, args);

  try {
    const result = await executeTool(name, args);
    logToolResponse(name, result);
    return result;
  } catch (error) {
    logToolError(name, error);
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Enhanced GitLab MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
