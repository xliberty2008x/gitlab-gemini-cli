# GitLab CI/CD Refactoring and Enhancement Plan

## 1. Executive Summary

This document outlines a strategic plan to refactor our GitLab CI/CD configuration. The goal is to evolve from the current single `.gitlab-ci.yml` file into a modular, multi-file structure housed within a `.gitlab/` directory.

This new architecture will mirror the logical, event-driven separation seen in the project's `.github/workflows` configuration, bringing feature parity (such as issue triage and manual invocation) to our GitLab setup. Crucially, this refactoring will be built upon the existing, proven settings of our current `gemini_cli_code_review` job, ensuring stability and reliability while significantly improving maintainability and scalability.

## 2. Current State Analysis

Our existing `.gitlab-ci.yml` is highly effective but monolithic. It contains a single, well-configured job (`gemini_cli_code_review`) that successfully performs AI-powered reviews on merge requests.

**Limitations of the Current Approach:**

*   **Lack of Scalability:** Adding new CI/CD functionalities (like issue triage, scheduled tasks, or manual triggers) would bloat the single file, making it increasingly complex and difficult to manage.
*   **Limited Functionality:** The current setup only handles merge request events. It does not address other critical repository events like issue creation or the need for periodic maintenance tasks, functionalities already present in the GitHub Actions workflows.
*   **Maintenance Overhead:** A single, large CI file makes it harder to debug specific workflows. A failure in one logical part of the file can halt unrelated processes, and understanding the entire file is necessary to make even small changes.
*   **No Separation of Concerns:** The file mixes different triggers (e.g., merge requests) and logic, violating the principle of separation of concerns and leading to a less organized codebase.

## 3. The Proposed Architecture: A Modular, Multi-File Approach

The core of this plan is to adopt the `include:` keyword in GitLab CI/CD to create a decoupled and highly organized configuration.

### 3.1. New Directory Structure

We will create a new `.gitlab/` directory. This directory will serve as the home for all CI/CD workflow definitions, keeping the root of the repository clean.

```
.
├── .gitlab/
│   ├── merge-request-review.yml
│   ├── issue-triage.yml
│   └── manual-invoke.yml
└── .gitlab-ci.yml
```

### 3.2. The Root `.gitlab-ci.yml`: The "Router"

The root `.gitlab-ci.yml` will be transformed into a simple, powerful "router" or controller. Its sole responsibilities will be:

1.  **Defining Global Stages:** To ensure a consistent execution order across all included workflows (e.g., `stages: [dispatch, review, triage]`).
2.  **Including Workflow Files:** Using the `include:` directive to pull in the individual workflow files from the `.gitlab/` directory.

**Why this is a superior approach:**

*   **Clarity and Simplicity:** Anyone looking at the root `.gitlab-ci.yml` will immediately understand the full scope of the CI/CD pipeline without getting lost in implementation details.
*   **Centralized Control:** It provides a single point of control for managing which workflows are active in the project.

### 3.3. Individual Workflow Files

Each file in the `.gitlab/` directory will represent a distinct, self-contained workflow, mirroring the structure of the GitHub Actions.

#### a) `.gitlab/merge-request-review.yml`

*   **Purpose:** Replicates the exact functionality of the current `.gitlab-ci.yml`.
*   **Implementation:** This file will contain the `gemini_cli_code_review` job, copied verbatim. We will not change what already works. This ensures a stable foundation and zero regression for our primary feature.
*   **Trigger:** `rules: - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'`

#### b) `.gitlab/issue-triage.yml`

*   **Purpose:** Introduces automated issue triage, bringing parity with `gemini-triage.yml` and `gemini-scheduled-triage.yml`.
*   **Implementation:** This file will define two new jobs:
    1.  **`gemini_cli_issue_triage`:**
        *   **Trigger:** Will be configured to run on new issue events. (Note: This typically requires a webhook integration in GitLab, but the CI job will be ready for it).
        *   **Logic:** The job will reuse the robust MCP server setup from the review job. However, it will use a new, specialized prompt template designed to analyze an issue's title and body and suggest appropriate labels from the project's available label list.
    2.  **`gemini_cli_scheduled_triage`:**
        *   **Trigger:** Will be configured to run on a schedule (`if: '$CI_PIPELINE_SOURCE == "schedule"'`), which can be set up in the GitLab UI (`CI/CD -> Schedules`).
        *   **Logic:** The script will be designed to fetch all untriaged issues via the GitLab API and use Gemini to process them in a batch, making it highly efficient.

#### c) `.gitlab/manual-invoke.yml`

*   **Purpose:** Provides a mechanism for manual, on-demand interaction with the Gemini agent, similar to `gemini-invoke.yml`.
*   **Implementation:** This file will define a `gemini_cli_manual_invoke` job.
    *   **Trigger:** `when: manual`. This ensures the job only appears with a "play" button in the GitLab pipeline view and is never run automatically.
    *   **Logic:** The job will be configured to accept a CI/CD variable (e.g., `CUSTOM_PROMPT`) when triggered. This allows a developer to provide a specific, one-off instruction to the Gemini agent for tasks that fall outside the standard review or triage workflows.

## 4. Why This Plan Will Work and Is the Right Choice

*   **Preserves What Works:** We are not reinventing the wheel. The core logic of the `gemini_cli_code_review` job, which is the most complex and critical part of the current system, will be preserved entirely. This minimizes risk.
*   **Embraces GitLab Best Practices:** Using the `include:` feature is the standard, recommended way to manage complex CI/CD configurations in GitLab. It is a robust and well-supported feature.
*   **Enhances Maintainability:** When a specific workflow needs to be debugged or updated (e.g., tweaking the triage prompt), developers will only need to look at a small, focused file (`issue-triage.yml`) instead of parsing a monolithic script. This dramatically reduces cognitive load.
*   **Future-Proofs the System:** When we need to add another workflow in the future (e.g., a documentation linter, a release-tagging job), we can simply add a new file to the `.gitlab/` directory and include it in the root `.gitlab-ci.yml`. The system is built for easy extension.
*   **Improves Readability:** The new structure is self-documenting. The file names in the `.gitlab/` directory clearly describe the available CI/CD capabilities.

By adopting this plan, we will create a CI/CD system that is not only more powerful and feature-rich but also significantly cleaner, more organized, and easier to maintain and scale in the long run.
