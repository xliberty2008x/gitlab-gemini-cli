const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  summarizeDiscussions,
  matchesIgnoreMarker,
  buildPreview,
  buildLocation,
} = require("../build-mr-context.js");

test("matchesIgnoreMarker recognises supported ignore tokens", () => {
  const patterns = [
    "@gemini ignore this issue",
    "/gemini ignore please",
    "Some text <!-- gemini-ignore --> more text",
  ];

  for (const sample of patterns) {
    assert.ok(
      matchesIgnoreMarker(sample),
      `Expected pattern to match: ${sample}`
    );
  }

  assert.ok(
    !matchesIgnoreMarker("ignore this for now"),
    "Should not match generic words"
  );
});

test("summarizeDiscussions returns formatted context and ignore list", () => {
  const discussions = [
    {
      id: "discussion-1",
      resolved: false,
      notes: [
        {
          id: 101,
          body: "Initial finding",
          system: false,
          resolver: null,
          resolvable: true,
          position: {
            new_path: "src/app.js",
            old_path: "src/app.js",
            new_line: 42,
            old_line: null,
          },
          author: { username: "gemini-bot", bot: true },
        },
        {
          id: 102,
          body: "@gemini ignore – accepted risk",
          system: false,
          author: { username: "maintainer" },
        },
      ],
    },
    {
      id: "discussion-2",
      resolved: true,
      notes: [
        {
          id: 201,
          body: "Another finding that spans multiple lines.\nIt has extra whitespace.",
          system: false,
          author: { username: "gemini-bot", bot: true },
        },
      ],
    },
  ];

  const { context, ignored } = summarizeDiscussions(discussions);

  assert.deepEqual(ignored, ["discussion-1"]);
  assert.match(
    context,
    /\*\*discussion-1\*\* \(src\/app\.js:42, unresolved, ignored\)/,
    "Context should include location and ignore flag"
  );
  assert.match(
    context,
    /\*\*discussion-2\*\* \(General, resolved, bot\)/,
    "Context should fallback to general location when no position"
  );
});

test("buildPreview truncates long notes and escapes markdown", () => {
  const longBody = "Code uses _markdown_ characters `like this`".repeat(10);
  const preview = buildPreview(longBody);

  assert.ok(preview.endsWith("..."), "Preview should be truncated with ellipsis");
  assert.ok(preview.includes("\\_"), "Markdown underscores should be escaped");
  assert.ok(preview.includes("\\`"), "Backticks should be escaped");
});

test("buildLocation formats diff positions", () => {
  assert.strictEqual(
    buildLocation({ new_path: "file.js", new_line: 99 }),
    "file.js:99"
  );
  assert.strictEqual(buildLocation({ old_path: "file.js" }), "file.js");
  assert.strictEqual(buildLocation(null), "General");
});

test("template script matches canonical implementation", () => {
  const canonical = fs.readFileSync(
    path.join(__dirname, "..", "build-mr-context.js"),
    "utf-8"
  );
  const template = fs.readFileSync(
    path.join(__dirname, "..", "templates", ".gitlab", "build-mr-context.js"),
    "utf-8"
  );

  assert.strictEqual(template, canonical);
});
