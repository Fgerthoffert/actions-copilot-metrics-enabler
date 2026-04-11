---
name: copilot-metrics-api
description:
  'GitHub Copilot usage metrics API field definitions and schema reference. Use
  when: interpreting API response fields, building transforms from source data,
  understanding what user_initiated_interaction_count or
  code_generation_activity_count means, mapping dashboard metrics to API fields,
  working with totals_by_ide, totals_by_feature, totals_by_model_feature,
  pull_requests, or CLI metrics.'
argument-hint: 'Ask about a specific API field or metric'
---

# GitHub Copilot Usage Metrics API Reference

Reference for all fields available in the Copilot usage metrics APIs and NDJSON
exports. Source:
[Data available in Copilot usage metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)

## API and Export Fields

These fields appear in exported NDJSON reports and in the Copilot usage metrics
APIs. They provide daily records at the enterprise, organization, or user scope.

### Record Identity

| Field                                 | Description                                          |
| ------------------------------------- | ---------------------------------------------------- |
| `report_start_day` / `report_end_day` | Start and end dates for the 28-day reporting period. |
| `day`                                 | Calendar day this record represents.                 |
| `enterprise_id`                       | Unique ID of the enterprise.                         |
| `organization_id`                     | Unique ID of the organization (API only).            |
| `user_id`                             | Unique numeric identifier for the user.              |
| `user_login`                          | GitHub username for the user.                        |

### Interaction Metrics

| Field                              | Description                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_initiated_interaction_count` | Number of explicit prompts sent to Copilot. Only counts messages or prompts actively sent to the model. Does not include opening the chat panel, switching modes (e.g. ask, edit, plan, or agent), using keyboard shortcuts to open the inline UI, or making configuration changes.                                  |
| `code_generation_activity_count`   | Number of distinct Copilot output events generated. Includes all generated content (comments, docstrings). Multiple blocks from a single prompt each count as a separate generation. Not directly comparable to `user_initiated_interaction_count`.                                                                  |
| `code_acceptance_activity_count`   | Number of suggestions or code blocks accepted by users. Counts all built-in accept actions (apply to file, insert at cursor, insert into terminal, Copy button). Does not count manual OS clipboard actions (e.g. Ctrl+C). Each acceptance action increments once regardless of how many code blocks were generated. |

### Lines of Code Metrics

| Field                         | Description                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `loc_suggested_to_add_sum`    | Lines of code Copilot suggested to add (completions, inline chat, chat panel, etc.; excludes agent edits). |
| `loc_suggested_to_delete_sum` | Lines of code Copilot suggested to delete (future support planned).                                        |
| `loc_added_sum`               | Lines of code actually added to the editor (accepted completions, applied code blocks, agent/edit mode).   |
| `loc_deleted_sum`             | Lines of code deleted from the editor (currently from agent edits).                                        |

### Feature Interaction Fields

Each of these captures `user_initiated_interaction_count` scoped to a specific
Copilot feature/mode.

| Field                     | Description                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent_edit`              | Lines added and deleted when Copilot (in agent and edit mode) writes changes directly into files. Not included in suggestion-based metrics. Counts edits from custom agents as well. |
| `chat_panel_agent_mode`   | User-initiated interactions in the chat panel with agent mode selected.                                                                                                              |
| `chat_panel_ask_mode`     | User-initiated interactions in the chat panel with ask mode selected.                                                                                                                |
| `chat_panel_custom_mode`  | User-initiated interactions in the chat panel with a custom agent selected.                                                                                                          |
| `chat_panel_edit_mode`    | User-initiated interactions in the chat panel with edit mode selected.                                                                                                               |
| `chat_panel_unknown_mode` | User-initiated interactions in the chat panel where the mode is unknown.                                                                                                             |
| `chat_panel_plan_mode`    | User-initiated interactions in the chat panel with plan mode selected.                                                                                                               |
| `code_completion`         | Inline code completion suggestions.                                                                                                                                                  |

### Breakdown Arrays

| Field                        | Description                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totals_by_ide`              | Breakdown of metrics by IDE used. Each entry contains IDE name, interaction counts, LoC metrics, and `last_known_ide_version` / `last_known_plugin_version`.                          |
| `totals_by_feature`          | Breakdown of metrics by Copilot feature (e.g. inline chat, chat panel, code completion).                                                                                              |
| `totals_by_language_feature` | Breakdown combining language and feature dimensions.                                                                                                                                  |
| `totals_by_model_feature`    | Model-specific breakdowns for chat activity (not completions). When auto model selection is enabled, activity is attributed to the actual model used rather than appearing as "Auto". |
| `totals_by_language_model`   | Breakdown combining language and model dimensions.                                                                                                                                    |

### Version Info

| Field                       | Description                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `last_known_ide_version`    | Most recent IDE version detected for each user. Contains `sampled_at` and `ide_version`.                                  |
| `last_known_plugin_version` | Most recent Copilot Chat extension version detected for each user. Contains `sampled_at`, `plugin`, and `plugin_version`. |

### Boolean Activity Flags

| Field                              | Description                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `used_agent`                       | Whether the user used agent mode in the IDE that day. Does not include Copilot code review activity.              |
| `used_chat`                        | Whether the user used IDE chat that day.                                                                          |
| `used_cli`                         | Whether the user used Copilot CLI that day.                                                                       |
| `used_copilot_code_review_active`  | Whether the user actively engaged with Copilot code review (manually requested a review or applied a suggestion). |
| `used_copilot_code_review_passive` | Whether Copilot was automatically assigned to review the user's pull request without active engagement.           |

## CLI Metrics (`totals_by_cli`)

Present only when CLI usage exists for the day.

| Field                                              | Description                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `totals_by_cli.session_count`                      | Number of distinct CLI sessions initiated.                                                                 |
| `totals_by_cli.request_count`                      | Total requests to Copilot via CLI, including user-initiated prompts and automated agentic follow-up calls. |
| `totals_by_cli.token_usage.output_tokens_sum`      | Total output tokens generated across all CLI requests.                                                     |
| `totals_by_cli.token_usage.prompt_tokens_sum`      | Total prompt tokens sent across all CLI requests.                                                          |
| `totals_by_cli.token_usage.avg_tokens_per_request` | Average tokens per CLI request: `(output_tokens_sum + prompt_tokens_sum) / request_count`.                 |
| `totals_by_cli.prompt_count`                       | Total user prompts, commands, or queries executed within a session.                                        |
| `totals_by_cli.last_known_cli_version`             | Most recent Copilot CLI version detected for the user that day.                                            |

## Pull Request Activity (`pull_requests`)

Daily pull request creation, review, merge, and suggestion activity at
enterprise or organization scope.

Note: Organization- and enterprise-level reports may show different totals due
to differences in user deduplication and attribution timing.

| Field                                                    | Description                                                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pull_requests.total_created`                            | Pull requests created on this day. One-time event per PR.                                                                                                                                 |
| `pull_requests.total_reviewed`                           | Pull requests reviewed on this day. Same PR may be counted on multiple days if reviewed on multiple days. Within a single day, each PR is counted once even with multiple review actions. |
| `pull_requests.total_merged`                             | Pull requests merged on this day. One-time event per PR.                                                                                                                                  |
| `pull_requests.median_minutes_to_merge`                  | Median time (minutes) between PR creation and merge for PRs merged on this day.                                                                                                           |
| `pull_requests.total_suggestions`                        | PR review suggestions generated on this day, regardless of author.                                                                                                                        |
| `pull_requests.total_applied_suggestions`                | PR review suggestions applied on this day, regardless of author.                                                                                                                          |
| `pull_requests.total_created_by_copilot`                 | PRs created by Copilot on this day.                                                                                                                                                       |
| `pull_requests.total_reviewed_by_copilot`                | PRs reviewed by Copilot on this day. May be counted on multiple days.                                                                                                                     |
| `pull_requests.total_merged_created_by_copilot`          | PRs created by Copilot that were merged on this day.                                                                                                                                      |
| `pull_requests.median_minutes_to_merge_copilot_authored` | Median time (minutes) between creation and merge for Copilot-created PRs merged on this day.                                                                                              |
| `pull_requests.total_copilot_suggestions`                | PR review suggestions generated by Copilot on this day.                                                                                                                                   |
| `pull_requests.total_copilot_applied_suggestions`        | PR review suggestions generated by Copilot that were applied on this day.                                                                                                                 |

## Dashboard-Only Metrics

These metrics appear in the Copilot usage dashboard but are not directly
available as API fields. They are derived from the API fields above.

| Metric                                | Description                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Agent adoption                        | Percentage of Copilot-licensed active users who tried an agent in the current calendar month.                           |
| Average chat requests per active user | Average number of chat requests per active user.                                                                        |
| Code completions (suggested/accepted) | Total inline code suggestions shown and accepted.                                                                       |
| Code completion acceptance rate       | Percentage of suggestions accepted by users.                                                                            |
| Daily active users                    | Unique users who used Copilot on a given day.                                                                           |
| Weekly active users                   | Unique users who used Copilot during a seven-day window.                                                                |
| Total active users                    | Licensed users active in the current calendar month.                                                                    |
| Most used chat model                  | Most frequently used chat model in the last 28 days.                                                                    |
| `daily_active_cli_users`              | Unique users who used Copilot via CLI on a given day. Independent of IDE active user counts. Omitted when no CLI usage. |
