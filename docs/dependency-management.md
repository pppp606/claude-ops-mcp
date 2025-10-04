# Dependency Management and Security Runbook

This repository consolidates dependency updates and security checks to keep CI signal clean and actionable.

## Weekly Dependabot (npm)

- Schedule: weekly, Monday 09:00 Asia/Tokyo
- Policy: group all patch/minor updates into a single PR
- Majors: ignored by default (keeps noise and risk low)
- PR limit: 1 concurrent PR
- Labels/Commits: labeled `dependencies`/`automated`, commit prefix `chore`

How to change:
- Include majors: remove the `ignore` block for `version-update:semver-major`, or create a separate `majors` group and run it monthly.
- Frequency: change `schedule.interval` to `monthly`/`daily` as needed.

## Monthly Dependabot (GitHub Actions)

- Schedule: monthly, Monday 09:00 Asia/Tokyo
- Policy: group all actions updates into a single PR
- PR limit: 1
- Labels/Commits: labeled `dependencies`/`github-actions`/`automated`, commit prefix `ci`

Rationale: reduces collisions with app dependency updates and avoids noisy CI.

## PR-time Dependency Review

We run GitHub’s Dependency Review action on pull requests to block introducing known vulnerabilities.

- Action: `actions/dependency-review-action@<pinned SHA>` (v4.8.0)
- Threshold: `fail-on-severity: moderate`
- PR summary comment: enabled
- Requirements:
  - Public repos: enable “Dependency graph” in Settings → Code security and analysis. GHAS is not required.
  - Private repos: GHAS is required in addition to Dependency graph.

Tuning:
- Stricter: set `fail-on-severity: low`.
- Softer: set `high` or add `continue-on-error: true` to warn without blocking.

## npm audit (CI)

The Security Audit job runs:

```
npm audit --audit-level=moderate --omit=dev
```

- Scope: production dependencies only (`--omit=dev`)
- Threshold: `moderate` to reduce noise while still catching meaningful issues

Tuning:
- Production-only block: keep as-is for reliable signal.
- Dev deps awareness: add a separate non-blocking step for dev (`continue-on-error: true`).

## Typical Maintainer Workflow

1) Weekly npm PR arrives (patch/minor grouped). Review, run CI, and merge if green.
2) If Dependency Review fails on a feature PR:
   - Prefer bumping the offending dependency in the PR (or cherry-pick from next Dependabot PR).
   - If no fixed version exists yet, consider ignoring until a patched release is available; document the decision in the PR.
3) For Actions updates (monthly), review changelogs and merge when CI passes.

## Files of Interest

- `.github/dependabot.yml`: schedules, grouping, labels, and commit messages
- `.github/workflows/ci.yml`: Dependency Review and npm audit configuration

## Admin Notes

- Enable “Dependency graph” in Settings → Code security and analysis so Dependency Review can run.
- If the repo becomes private, Dependency Review requires GitHub Advanced Security.

