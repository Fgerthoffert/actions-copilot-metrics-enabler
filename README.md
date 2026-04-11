<!-- markdownlint-disable MD041 MD033 -->
<p align="center">
  <img alt="ZenCrepesLogo" src="docs/zencrepes-logo.png" height="140" />
  <h2 align="center">Copilot Metrics Enabler</h2>
    <p align="center">A GitHub Action that retrieves GitHub Copilot usage
    metrics from the API, builds a long-term archive of daily JSON files, and
    generates adoption reports and personalized enablement prompts in
    Markdown.</p>
</p>

---

![Linter](https://github.com/fgerthoffert/actions-copilot-metrics-enabler/actions/workflows/linter.yml/badge.svg)
![CI](https://github.com/fgerthoffert/actions-copilot-metrics-enabler/actions/workflows/ci.yml/badge.svg)
![Check dist/](https://github.com/fgerthoffert/actions-copilot-metrics-enabler/actions/workflows/check-dist.yml/badge.svg)
![CodeQL](https://github.com/fgerthoffert/actions-copilot-metrics-enabler/actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](./badges/coverage.svg)

---

## Features

- **Long-term metrics archive** — Fetches from the GitHub Copilot Usage Metrics
  API and stores data as daily JSON files. The API only exposes a 28-day rolling
  window, so running on a schedule builds a permanent historical record.
- **ETL pipeline** — Transforms raw per-user daily files into intermediate
  NDJSON datasets (daily usage, feature interactions, feature adoption, IDE
  interactions, model adoption) for flexible analysis.
- **Adoption reports** — Generates Markdown reports with monthly and weekly
  tables covering AI usage trends, IDE adoption, feature adoption, and model
  adoption, each with counts and percentages.
- **Per-feature & per-model breakdowns** — Dedicated report per feature and per
  model with top/bottom active users and weekly active user lists.
- **Per-user adoption report** — Monthly table per user showing average daily
  interactions (weekdays only), total interactions, and per-feature breakdown.
- **People summary table** — Index page with a table of all included users
  showing days active, interactions over the last 20 working days, average per
  day, and percentage of total.
- **Enablement prompts** — Per-user AI prompt files containing activity data,
  feature/IDE/model usage, unused features, and team context (averages, median,
  champions). Feed these to an AI assistant to generate personalized coaching
  messages.
- **User filtering** — Include or exclude specific users from all transforms and
  reports via `include_users` / `exclude_users` inputs.
- **Weekday-aware averages** — Monthly averages are computed over weekdays only
  (Mon–Fri), giving a more accurate picture of working-day usage.
- **Safe incremental collection** — Only fetches data for dates that are
  missing, so it is safe to run daily without duplicates.

### Data Collection

The action collects two types of metrics:

| Type             | API Endpoint                              | Storage Format                                     |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| **Organization** | `GET /orgs/{org}/copilot/metrics` (1-day) | `source/organization/YYYY-MM-DD.json`              |
| **Users**        | `GET /orgs/{org}/members/copilot` (1-day) | `source/users/YYYY-MM-DD/YYYY-MM-DD-username.json` |

On each run the action looks back up to `lookback_days` (default 100) and only
fetches data for dates that are missing, so it is safe to run daily on a
schedule without creating duplicates.

### Reports

When `summary_report` is set to `'true'`, the action generates the following
Markdown reports inside the `report/` directory:

| Report                   | File(s)                         | Description                                                                                                          |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **AI Adoption**          | `ai-adoption.md`                | Active vs interacting users and interaction counts, monthly and weekly, with user lists per category                 |
| **IDE Adoption**         | `ide-adoption.md`               | User-initiated interactions broken down by IDE, monthly and weekly                                                   |
| **Feature Adoption**     | `feature-adoption.md`           | Overview of interactions by feature (code completions, chat, etc.), monthly and weekly                               |
| **Per-Feature Adoption** | `feature-adoption-<feature>.md` | One report per feature with user breakdowns (top/bottom 5, active users per week)                                    |
| **Model Adoption**       | `model-adoption.md`             | Overview of interactions by AI model with "Others" grouping (<5%), monthly and weekly                                |
| **Per-Model Adoption**   | `model-adoption-<model>.md`     | One report per model with user breakdowns (top/bottom 5, active users per week)                                      |
| **Per-User Adoption**    | `per-user-adoption.md`          | Per-user monthly table with average daily interactions (weekdays), total interactions, and per-feature breakdown     |
| **Enablement Prompts**   | `prompts/<login>.md`            | Per-user AI prompt files with activity data, feature/IDE/model usage, unused features, and team context for coaching |

A `README.md` index is generated alongside the reports with links to each file.

## Usage

### Inputs

| Input            | Required | Default | Description                                                                                                                  |
| ---------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `github_token`   | Yes      | —       | A GitHub token with the `manage_billing:copilot` or `read:org` scope (classic PAT) or fine-grained access to Copilot metrics |
| `github_org`     | Yes      | —       | The GitHub organization to fetch Copilot metrics for                                                                         |
| `path`           | No       | `''`    | Local path for storing JSON files. If empty, a temporary cache directory is used                                             |
| `summary_report` | No       | `false` | Set to `'true'` to generate adoption reports and enablement prompts                                                          |
| `include_users`  | No       | `''`    | Comma-separated list of user logins to include in reports. When set, only these users appear in transforms and reports       |
| `exclude_users`  | No       | `''`    | Comma-separated list of user logins to exclude from reports. Ignored if `include_users` is set                               |
| `lookback_days`  | No       | `100`   | Number of days to look back in history for missing data                                                                      |

### Outputs

| Output | Description                                                             |
| ------ | ----------------------------------------------------------------------- |
| `path` | The path where data is stored (the provided `path` or a temp directory) |

### Example Workflow

```yaml
name: Copilot Metrics Enabler

on:
  schedule:
    # Run daily at 06:00 UTC
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Collect Copilot Metrics
        uses: fgerthoffert/actions-copilot-metrics-enabler@main
        with:
          github_token: ${{ secrets.COPILOT_METRICS_TOKEN }}
          github_org: my-org
          path: copilot-metrics
          summary_report: 'true'
          lookback_days: 100

      - name: Commit and push metrics
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add copilot-metrics/
          git diff --cached --quiet || git commit -m "chore: update copilot metrics"
          git push
```

### Directory Structure

After running with `path: copilot-metrics`, the directory tree looks like:

```text
copilot-metrics/
├── source/
│   ├── organization/
│   │   ├── 2026-04-01.json
│   │   ├── 2026-04-02.json
│   │   └── ...
│   └── users/
│       ├── 2026-04-01/
│       │   ├── 2026-04-01-alice.json
│       │   └── 2026-04-01-bob.json
│       └── ...
├── transform/
│   └── organization/
│       ├── daily-usage.ndjson
│       ├── feature-adoption.ndjson
│       ├── feature-interactions.ndjson
│       ├── ide-interactions.ndjson
│       ├── model-adoption.ndjson
│       └── people-summary.ndjson
└── report/
    ├── README.md
    ├── ai-adoption.md
    ├── feature-adoption.md
    ├── feature-adoption-chat.md
    ├── feature-adoption-code-completions.md
    ├── ide-adoption.md
    ├── model-adoption.md
    ├── model-adoption-gpt-4o.md
    ├── per-user-adoption.md
    ├── prompts/
    │   ├── alice.md
    │   └── bob.md
    └── ...
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## How to Contribute

- Fork the repository
- Run `npm install`
- Rename `.env.example` to `.env`
- Update the `INPUT_` variables
- Make your changes
- Run `npx local-action . src/main.ts .env`
- Run `npm run bundle`
- Run `npm test`
- Submit a PR to this repository, detailing your changes

More details about GitHub TypeScript actions are
[available here](https://github.com/actions/typescript-action)
