<!-- markdownlint-disable MD041 MD033 -->
<p align="center">
  <img alt="ZenCrepesLogo" src="docs/zencrepes-logo.png" height="140" />
  <h2 align="center">Copilot Metrics Archiver</h2>
    <p align="center">A GitHub Action that retrieves GitHub Copilot usage
    metrics from the API, organizes them into daily JSON files, and generates
    adoption reports in Markdown.</p>
</p>

---

![Linter](https://github.com/fgerthoffert/actions-copilot-metrics-archiver/actions/workflows/linter.yml/badge.svg)
![CI](https://github.com/fgerthoffert/actions-copilot-metrics-archiver/actions/workflows/ci.yml/badge.svg)
![Check dist/](https://github.com/fgerthoffert/actions-copilot-metrics-archiver/actions/workflows/check-dist.yml/badge.svg)
![CodeQL](https://github.com/fgerthoffert/actions-copilot-metrics-archiver/actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](./badges/coverage.svg)

---

## What It Does

This action connects to the
[GitHub Copilot Usage Metrics API](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)
and archives the response as individual daily JSON files. Because the API only
exposes a rolling 28-day window, running this action on a schedule lets you
build a long-term historical archive.

When report generation is enabled, the action also runs an **ETL pipeline** that
transforms the raw data into intermediate NDJSON files and produces a set of
Markdown adoption reports.

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

| Report                    | File(s)                               | Description                                                                                     |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **AI Adoption**           | `ai-adoption.md`                      | Daily active users and user-initiated interactions, monthly and daily, with active/inactive user lists |
| **IDE Adoption**          | `ide-adoption.md`                     | User-initiated interactions broken down by IDE, monthly and daily                               |
| **Feature Adoption**      | `feature-adoption.md`                 | Overview of interactions by feature (code completions, chat, etc.), monthly and daily            |
| **Per-Feature Adoption**  | `feature-adoption-<feature>.md`       | One report per feature with user breakdowns (top/bottom 5, active users per day)                |
| **Model Adoption**        | `model-adoption.md`                   | Overview of interactions by AI model with "Others" grouping (<5%), monthly and daily             |
| **Per-Model Adoption**    | `model-adoption-<model>.md`           | One report per model with user breakdowns (top/bottom 5, active users per day)                  |

A `README.md` index is generated alongside the reports with links to each file.

## Usage

### Inputs

| Input              | Required | Default | Description                                                                                      |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------ |
| `github_token`     | Yes      | —       | A GitHub token with the `manage_billing:copilot` or `read:org` scope (classic PAT) or fine-grained access to Copilot metrics |
| `github_org`       | Yes      | —       | The GitHub organization to fetch Copilot metrics for                                             |
| `path`             | No       | `''`    | Local path for storing JSON files. If empty, a temporary cache directory is used                  |
| `summary_report`   | No       | `false` | Set to `'true'` to generate adoption reports                                                     |
| `metrics`          | No       | `all`   | Comma-separated list of metric types to collect: `organization`, `users`, or `all`               |
| `lookback_days`    | No       | `100`   | Number of days to look back in history for missing data                                          |

### Outputs

| Output | Description                                                             |
| ------ | ----------------------------------------------------------------------- |
| `path` | The path where data is stored (the provided `path` or a temp directory) |

### Example Workflow

```yaml
name: Archive Copilot Metrics

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
        uses: fgerthoffert/actions-copilot-metrics-archiver@main
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

```
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
│       ├── ide-interactions.ndjson
│       ├── feature-interactions.ndjson
│       ├── feature-adoption.ndjson
│       ├── model-adoption.ndjson
│       └── daily-usage.ndjson
└── report/
    ├── README.md
    ├── ai-adoption.md
    ├── ide-adoption.md
    ├── feature-adoption.md
    ├── feature-adoption-code-completions.md
    ├── model-adoption.md
    ├── model-adoption-gpt-4o.md
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