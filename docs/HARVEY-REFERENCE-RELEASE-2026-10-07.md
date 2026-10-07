# LOCKE reference redesign — 7 October 2026

## Direction and implementation

The green theme was rejected by the owner. This release uses the six supplied Harvey/Legora product screenshots as visual references: near-black 248 px desktop sidebar, white and neutral-gray surfaces, serif page titles, compact navigation, recent threads and matters, quieter controls, and a main work-product pane with agent progress alongside it. LOCKE branding and actual capabilities are retained. This is a reference-based reconstruction, not a claim of pixel identity with Harvey's proprietary interface.

A versioned theme preference removes the rejected green preference without changing authentication storage. All product surfaces inherit the neutral tokens, including Office previews, Portal and password recovery. The editor preserves version history and warns before discarding unsaved edits. Initial data loads in Vault, Skills, Lists, Tables, Matters, Agent, Monitors, Workflows, Portal and Editor no longer imply that an existing workspace is empty.

The Office panel queries workflow_skills rather than the nonexistent playbooks table; its browser-preview status distinguishes LOCKE sign-in from connection to a Microsoft host. Its output heading now reflects the selected operation. Review-table header status derives from actual row review state rather than always saying in progress. Source inspection uses a separately scrollable pane.

## Validation

- All 56 existing Node regression tests pass. Production Next.js webpack build and TypeScript validation pass for the reference redesign.
- Production release 42742f8db521aa7ffda1679ff2291532b58acade is READY and assigned to lockeslaw.sheenax.xyz. The subsequent polish release is recorded in Git history.
- Fresh secure owner sign-in succeeded in the production browser. The new interface and persistent navigation were visually inspected.
- Saved Tanzanian research reopens with 16 source passages. Citation P1 opens its exact passage, page locator and official OAG source URL. Historical verification notes are retained, not silently rewritten.
- Saved agent output reopens and renders as formatted work product alongside its actual execution progress. A Word export returned a completed browser download path. The downloaded bytes did not synchronize to the execution workspace, so this does not certify opening that exact file in native Word. OOXML archive/escaping regression tests pass.
- Completed fictional workflow reopens at 6/6 steps with two recorded human checkpoints. No new approvals or messages were sent.
- Saved table reopens with a reviewed row, exact quotation for termination, and Not found for the absent change-of-control clause.
- Saved editor memo reopens with versions 1 and 2 and the technical acceptance comment. A temporary unsaved title edit triggers the navigation confirmation; dismissing retains the editor. The temporary edit was discarded without saving.
- Vault shows the fictional source Ready. Lists display five persisted source-linked items and the saved owner assignment.

## Remaining limits for the lawyer pilot

Native signed-in Word/Outlook host operations still require Microsoft authentication and installation acceptance. The web app and Office browser preview now reuse the same tab-scoped LOCKE session, including firm metadata across refresh; client-portal sessions remain separate. Native Office taskpanes can still require their own sign-in because their tab storage is isolated. A LOCKE session is not proof of a Microsoft connection. Real client-guest browser acceptance, password-reset completion and physical mobile-device acceptance remain separate checks.

The public corpus is 47,406 records / 470,680 passages across TZ, AU, CA, EU and UK, with Tanzania's declared OAG downloadable catalogue reconciled at 5,621/5,621. This is not all jurisdictions, all judgments, or verified amendment currentness. The firm citator has zero genuine reviewed treatment entries; absence means unknown. Legal-quality acceptance requires qualified lawyer review of real work. Comprehensive matter association across every work-product type is not certified.

These boundaries prevent a claim that every feature is fully functional or that LOCKE equals Harvey/Legora. The application has a functioning technical pilot, with the outstanding gates made explicit rather than hidden behind completed UI.
