# Duplicate Protection QA Playbook (For AI Agents)

Use this script when validating the “no duplicate comments” workflow introduced in `gitlab-gemini-cli@1.1.14`. Follow the steps exactly and ask the human operator to perform actions or share evidence when required.

---

## 0. Pre-Flight Checklist

1. **Package version** – Ask the user to run `node -p "require('./package.json').version"` inside the project. Continue only if the output is `1.1.14` (or later).
2. **GitLab variables** – Confirm with the user that `GEMINI_API_KEY` and `GITLAB_REVIEW_PAT` are still configured in project CI/CD variables.
3. **Runner tag** – Remind the user to keep the merge request labelled `ai` so that the job targets the correct runner.
4. **Мова відповідей** – Після стартового прогона переконайся, що інлайн-коментарі та підсумок формується українською. Якщо з’являється англомовний текст, зупини сценарії та повідом про відхилення.

If any item fails, stop and request remediation before running the scenarios.

---

## 1. Scenario: Reuse Existing Discussion

**Goal:** Prove that Gemini updates an existing thread instead of duplicating it after a new commit.

1. Ask the user to create a branch (e.g. `qa/duplicate-protection`) and add a problematic change that should trigger a review comment.
2. Request the user to open an MR for that branch and confirm when the first review pipeline finishes. Have them copy the Gemini job log (at minimum the section that includes “Existing discussions” and the posted review comment).
3. Inspect the log for:
   - `Existing discussions (read-only):` block populated by the helper.
   - At least one inline review comment posted.
   - The telemetry log showing `update_note` in the tool list.
4. Tell the user to push a second commit that **does not** fix the original issue.
5. After the second pipeline finishes, ask for the new Gemini job log and the MR discussion thread.
6. Pass criteria:
   - No new thread is created for the same finding.
   - The original discussion shows an updated comment (Gemini edits the note or states “still applicable”).
   - Telemetry confirms `EXISTING_FEEDBACK_CONTEXT` was loaded (look for the env substitution near the start of the job).
   - Усі відповіді, включно з оновленим коментарем та підсумком, подані українською мовою.

If duplication occurs, collect the full telemetry (`gemini-telemetry.log`) and file a defect.

---

## 2. Scenario: Respect Ignore Marker

**Goal:** Verify that ignore tokens prevent Gemini from re-raising a known false positive.

1. In the MR from Scenario 1, ask the user to reply to the Gemini discussion with one of the supported markers **on its own line**, for example:
   ```
   @gemini ignore
   ```
2. Have the user push a third commit that keeps the offending code unchanged.
3. When the pipeline completes, review the Gemini log and MR discussions:
   - `IGNORED_DISCUSSIONS` in the log contains the discussion ID.
   - No new comment is created and the ignored thread receives no updates.
   - The agent reports the skip in the summary (e.g. “Marked as ignored by reviewer”).
   - Підсумкова нотатка після ігнору залишається українською.

Failing behaviour should be documented with the job log and discussion URL.

---

## 3. Scenario: Fresh Merge Request (Regression Guard)

**Goal:** Ensure a brand-new MR still receives normal coverage.

1. Ask the user to create a new branch (e.g. `qa/fresh-run`) with a fresh issue.
2. Create a separate MR and run the pipeline.
3. Confirm the log shows the context helper falling back to “No existing discussions found.”
4. Validate that Gemini still posts inline findings and a summary with no errors.
5. Перевір, що як інлайн-коментар, так і підсумковий запис написані українською.

---

## Evidence Package

Request the user to provide the following artefacts for each scenario:

- Gemini job log (stdout + `gemini-telemetry.log` tail).
- Screenshot or copy of the relevant MR discussions.
- Commit SHAs that triggered each pipeline.

Store the evidence in the project’s issue tracker or attach to the QA report.

---

## Completion Criteria

All three scenarios must pass without duplicate comment threads, and the ignore marker scenario must demonstrate that flagged discussions are skipped. If any scenario fails, halt further testing and escalate with collected evidence.
