#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const fetch = require("node-fetch");

const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://hs2git.ab-games.com/api/v4";
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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

      case "get_file_contents":
        const file = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/repository/files/${encodeURIComponent(args.file_path)}?ref=${args.ref || 'main'}`);
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        return { content: [{ type: "text", text: content }] };

      case "create_or_update_file":
        const fileData = {
          branch: args.branch,
          commit_message: args.commit_message,
          content: args.content,
        };
        const result = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/repository/files/${encodeURIComponent(args.file_path)}`, {
          method: "POST",
          body: JSON.stringify(fileData),
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };

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

      case "get_job_log":
        // Job logs return plain text, not JSON
        const logUrl = `${GITLAB_API_URL}/projects/${encodeURIComponent(args.project_id)}/jobs/${args.job_id}/trace`;
        const logResponse = await fetch(logUrl, {
          headers: {
            "Authorization": `Bearer ${GITLAB_TOKEN}`,
          },
        });
        if (!logResponse.ok) {
          throw new Error(`GitLab API error: ${logResponse.status} ${logResponse.statusText}`);
        }
        const logText = await logResponse.text();
        return { content: [{ type: "text", text: logText }] };

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

      case "get_merge_request_participants":
        const participants = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/participants`);
        return { content: [{ type: "text", text: JSON.stringify(participants, null, 2) }] };

      case "list_merge_request_diffs":
        const diffs = await gitlabApi(`/projects/${encodeURIComponent(args.project_id)}/merge_requests/${args.merge_request_iid}/diffs`);
        return { content: [{ type: "text", text: JSON.stringify(diffs, null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
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
