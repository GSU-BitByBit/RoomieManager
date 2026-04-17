# RoomieManager Sprint 3 Snapshot

This file summarizes project activity after the Sprint 2 documentation period, based on GitHub activity through `2026-04-09`.

## Documentation Focus

My role for this sprint remained focused on README and project documentation. The main goal was to track the project changes after Sprint 2 and summarize the current direction of the repository in a way that teammates and instructors could understand quickly.

## Major GitHub Activity After Sprint 2

### Project Documentation

- Added a root README with a project overview, current progress, future work, and timeline.
- Added a Sprint 1 project snapshot README to document the earlier project state.

### Chore Workflow Updates

- The chore system was redesigned around recurring chores and assigned occurrences.
- Calendar-style chore views and recurring chore templates were added.
- Backend and frontend files were updated to support the new chore behavior.
- New backend tests were added for chore generation and chore templates.

### Finance and Member Flow Updates

- Finance behavior was hardened with improved payment and balance handling.
- Custom split bill creation and better payment/balance UX were added.
- Member removal and leave-group flows were improved so balance-related blockers could be handled more safely.

### Frontend Updates

- The frontend was overhauled with larger updates to the app shell, bills, chores, settings, and shared styling.
- Accessibility improvements were added, including better form labels and keyboard navigation.
- Frontend deployment configuration was added.

### Deployment and Repository Cleanup

- Deployment examples and documentation were added for a single-VM setup.
- Environment configuration was improved.
- A root `.gitignore` was added.
- Generated files and personal/output artifacts were removed from the repository.

## Test References

Two backend test areas that help support the Sprint 3 project state are:

- `backend/test/modules/chores/chore-generation.service.spec.ts`
- `backend/test/finance-db.e2e-spec.ts`

These tests reflect newer project activity around recurring chores and finance/member safety.

## Current Status After Sprint 2

By this point, the project had moved beyond the early backend-only foundation. Sprint 3 activity shows the team working on fuller product behavior, including recurring chores, stronger finance flows, frontend cleanup, accessibility, deployment support, and repository organization.

## Remaining Work

- Keep README and sprint documentation updated as more features are finalized.
- Continue checking that documentation matches the actual GitHub history.
- Make sure frontend, backend, deployment notes, and test references stay aligned before final submission.
