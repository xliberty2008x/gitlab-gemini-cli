#!/usr/bin/env node

/**
 * build-mr-context.js
 *
 * Fetches merge request discussions and produces environment variables that
 * summarize historical feedback. The CI job evaluates the script output to
 * prime Gemini with prior discussions and ignored threads, avoiding duplicate
 * comments across commits.
 */

const fetchModule = require("node-fetch");
const fetch = fetchModule.default || fetchModule;

const {
  CI_API_V4_URL,
  CI_PROJECT_ID,
  CI_MERGE_REQUEST_IID,
  GITLAB_REVIEW_PAT,
  GITLAB_TOKEN_HEADER = "PRIVATE-TOKEN",
} = process.env;

const API_BASE =
  CI_API_V4_URL?.replace(/\/$/, "") ||
  (process.env.GITLAB_API_URL
    ? process.env.GITLAB_API_URL.replace(/\/$/, "")
    : "https://gitlab.com/api/v4");

const MAX_DISCUSSIONS = Number(process.env.MR_CONTEXT_MAX_DISCUSSIONS || 20);
const MAX_NOTE_PREVIEW = Number(process.env.MR_CONTEXT_MAX_PREVIEW || 220);

const IGNORE_PATTERNS = [
  /@gemini\s+ignore/i,
  /\/gemini\s+ignore/i,
  /<!--\s*gemini-ignore\s*-->/i,
];

async function main() {
  try {
    if (!CI_PROJECT_ID || !CI_MERGE_REQUEST_IID || !GITLAB_REVIEW_PAT) {
      console.error(
        "[build-mr-context] Missing required env vars CI_PROJECT_ID, CI_MERGE_REQUEST_IID, or GITLAB_REVIEW_PAT."
      );
      outputFallback();
      return;
    }

    const discussions = await gitlabRequest(
      `/projects/${encodeURIComponent(
        CI_PROJECT_ID
      )}/merge_requests/${encodeURIComponent(CI_MERGE_REQUEST_IID)}/discussions`
    );

    const { context, ignored } = summarizeDiscussions(discussions);
    outputExports(context, ignored);
  } catch (error) {
    console.error(
      `[build-mr-context] Failed to build MR context: ${error.message}`
    );
    outputFallback();
  }
}

function summarizeDiscussions(rawDiscussions) {
  if (!Array.isArray(rawDiscussions) || rawDiscussions.length === 0) {
    return {
      context: "No existing discussions found.",
      ignored: [],
    };
  }

  const summaries = [];
  const ignoredIds = new Set();

  for (const discussion of rawDiscussions.slice(0, MAX_DISCUSSIONS)) {
    const notes = Array.isArray(discussion.notes) ? discussion.notes : [];
    if (notes.length === 0) continue;

    const ignoreRequested = notes.some((note) =>
      matchesIgnoreMarker(note.body || "")
    );
    if (ignoreRequested) {
      ignoredIds.add(discussion.id);
    }

    const latestMeaningfulNote =
      [...notes]
        .reverse()
        .find((note) => !note.system && typeof note.body === "string") ||
      notes[notes.length - 1];

    const anchorNote =
      notes.find((note) => note.position) || latestMeaningfulNote;
    const position = anchorNote?.position;
    const location = position
      ? buildLocation(position)
      : anchorNote?.resolvable
      ? "Thread (no diff position)"
      : "General";

    const preview = buildPreview(latestMeaningfulNote?.body || "");
    const author = latestMeaningfulNote?.author?.username
      ? latestMeaningfulNote.author.username
      : latestMeaningfulNote?.author?.name || "unknown";

    const resolvedState =
      typeof discussion.resolved === "boolean"
        ? discussion.resolved
          ? "resolved"
          : "unresolved"
        : inferResolved(notes);

    const flags = [];
    if (ignoreRequested) flags.push("ignored");
    if (latestMeaningfulNote?.author?.bot) flags.push("bot");

    summaries.push(
      `- **${discussion.id}** (${location}, ${resolvedState}${
        flags.length ? `, ${flags.join(", ")}` : ""
      }) – last by \`${author}\`: ${preview}`
    );
  }

  const context =
    summaries.length > 0
      ? summaries.join("\n")
      : "Existing discussions could not be summarized.";

  return {
    context,
    ignored: Array.from(ignoredIds),
  };
}

async function gitlabRequest(path) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
  };

  const headerKey = (GITLAB_TOKEN_HEADER || "PRIVATE-TOKEN").toLowerCase();
  if (headerKey === "job-token") {
    headers["JOB-TOKEN"] = GITLAB_REVIEW_PAT;
  } else if (headerKey === "authorization" || headerKey === "bearer") {
    headers.Authorization = `Bearer ${GITLAB_REVIEW_PAT}`;
  } else {
    const resolvedKey =
      headerKey === "private-token" ? "PRIVATE-TOKEN" : GITLAB_TOKEN_HEADER;
    headers[resolvedKey] = GITLAB_REVIEW_PAT;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${response.status} ${response.statusText} - ${body.slice(0, 200)}`
    );
  }
  return response.json();
}

function matchesIgnoreMarker(text) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(text));
}

function buildLocation(position) {
  if (!position) return "General";
  const file = position.new_path || position.old_path || "unknown-file";
  const line =
    typeof position.new_line === "number"
      ? position.new_line
      : position.old_line;
  return line ? `${file}:${line}` : file;
}

function buildPreview(body) {
  if (!body) return "_no text_";
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_NOTE_PREVIEW) return escapeMarkdown(normalized);
  return `${escapeMarkdown(normalized.slice(0, MAX_NOTE_PREVIEW - 3))}...`;
}

function escapeMarkdown(text) {
  return text.replace(/([\`\\*_])/g, "\\$1");
}

function inferResolved(notes) {
  const last = notes[notes.length - 1];
  if (last?.resolved === true) return "resolved";
  return "unresolved";
}

function exportLine(name, value) {
  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value ?? "");
  const escaped = String(stringValue).replace(/'/g, "'\"'\"'");
  return `export ${name}='${escaped}'`;
}

function outputExports(context, ignoredList) {
  const lines = [
    exportLine("EXISTING_FEEDBACK_CONTEXT", context),
    exportLine("IGNORED_DISCUSSIONS", JSON.stringify(ignoredList)),
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

function outputFallback() {
  outputExports("Existing discussions unavailable.", []);
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    main,
    summarizeDiscussions,
    matchesIgnoreMarker,
    buildLocation,
    buildPreview,
  };
}
