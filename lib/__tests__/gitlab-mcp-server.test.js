const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const runtimeServer = require("../../gitlab-mcp-server.js");

test("normalizeIssueSignature captures first meaningful line", () => {
  const sample = `

  🔴 Issue: Null ref
  Problem details follow.
  `;
  assert.strictEqual(
    runtimeServer.normalizeIssueSignature(sample),
    "🔴 issue: null ref",
    "Signature should lowercase and normalise spacing"
  );

  assert.strictEqual(
    runtimeServer.normalizeIssueSignature("   "),
    null,
    "Empty bodies should return null signature"
  );
});

test("positionsMatch checks matching file and line numbers", () => {
  const posA = { new_path: "src/app.js", new_line: 10 };
  const posB = { new_path: "src/app.js", new_line: 10 };
  const posC = { new_path: "src/app.js", new_line: 12 };
  const posD = { new_path: "src/other.js", new_line: 10 };

  assert.ok(runtimeServer.positionsMatch(posA, posB));
  assert.ok(!runtimeServer.positionsMatch(posA, posC));
  assert.ok(!runtimeServer.positionsMatch(posA, posD));
});

test("ignoredDiscussionSet parses env JSON safely", () => {
  const originalEnv = process.env.IGNORED_DISCUSSIONS;
  process.env.IGNORED_DISCUSSIONS = JSON.stringify(["d1", "d2"]);
  let ignored = runtimeServer.ignoredDiscussionSet();
  assert.ok(ignored.has("d1"));
  assert.ok(ignored.has("d2"));

  process.env.IGNORED_DISCUSSIONS = "not-json";
  ignored = runtimeServer.ignoredDiscussionSet();
  assert.strictEqual(ignored.size, 0);

  if (originalEnv === undefined) {
    delete process.env.IGNORED_DISCUSSIONS;
  } else {
    process.env.IGNORED_DISCUSSIONS = originalEnv;
  }
});

test("selectReusableNote skips ignored discussions", () => {
  const discussions = [
    {
      id: "ignored-discussion",
      notes: [
        {
          id: 1,
          body: "🔴 Problem: знайдено помилку",
          position: { new_path: "file.cs", new_line: 5 },
          author: { id: 99 },
        },
      ],
    },
  ];
  const selection = runtimeServer.selectReusableNote(
    discussions,
    { id: 99 },
    { new_path: "file.cs", new_line: 5 },
    "🔴 Problem: знайдено помилку",
    new Set(["ignored-discussion"])
  );
  assert.deepEqual(selection, { ignored: true, discussionId: "ignored-discussion" });
});

test("selectReusableNote returns note id for matching active discussion", () => {
  const discussions = [
    {
      id: "active-discussion",
      notes: [
        {
          id: 42,
          body: "🟠 Проблема: оптимізація",
          position: { new_path: "file.cs", new_line: 10 },
          author: { id: 100 },
        },
      ],
    },
  ];
  const selection = runtimeServer.selectReusableNote(
    discussions,
    { id: 100 },
    { new_path: "file.cs", new_line: 10 },
    "🟠 Проблема: оптимізація"
  );
  assert.deepEqual(selection, { discussionId: "active-discussion", noteId: 42 });
});

test("template server matches canonical implementation", () => {
  const canonical = fs.readFileSync(
    path.join(__dirname, "..", "..", "gitlab-mcp-server.js"),
    "utf-8"
  );
  const template = fs.readFileSync(
    path.join(__dirname, "..", "templates", "gitlab-mcp-server.js"),
    "utf-8"
  );

  assert.strictEqual(template, canonical);
});
