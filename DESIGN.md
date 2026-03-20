# ConsultantPlatform Design Guide

Future agents: read this file before making any visible UI change.

This is the design source of truth for the app. It captures the current product
direction after the subtraction-first polish pass: calm, utilitarian, consistent,
and low-cognitive-load.

## What This Product Should Feel Like

- Operational, not promotional.
- Clear, not clever.
- Trustworthy, not flashy.
- Sparse when the user is creating or resolving something.
- Dense only when density helps scanability, such as tables and report data.

## Core Principles

1. Subtract before adding.
1. Prefer spacing, alignment, and typography over extra wrappers.
1. Use one clear hierarchy per screen.
1. Remove repeated framing across shell, page header, and section header.
1. Make empty states brief and low-drama.
1. Keep creation flows focused and short.
1. Keep reports plain and readable.
1. Keep settings systematic and quiet.
1. Use consistent patterns across every surface rather than giving each page its own personality.

## Visual Voice

- Calm neutral base.
- Minimal decoration.
- No marketing energy inside the app shell.
- No “AI slop” patterns: no stacked hero copy, no ornamental badges, no busy cards, no decorative gradients unless they carry information.
- Treat every nonessential frame as a candidate for removal.

## Typography

- Use the app’s existing sans stack for all interface text.
- Keep headings restrained: a single strong `h1`, then quiet section labels.
- Use monospace only for raw evidence, timestamps, IDs, JSON, code, or other technical data.
- Avoid mixing type styles just to create variety.
- Favor sentence case and short labels.

## Color And Emphasis

- Use the existing theme tokens already defined in `app/globals.css`.
- Keep the background and surfaces neutral.
- Reserve accent color for primary actions, active state, and true emphasis.
- Do not introduce a second accent family.
- Do not use bright color as decoration.
- Error, warning, and success colors should only appear when the state is real.

## Layout Rules

- Prefer one page title with no duplicate subtitle treatment elsewhere.
- Avoid repeated card nesting.
- Use borders, spacing, and row separation before adding containers.
- Keep shells simple: sidebar, content, and the minimum framing needed for navigation.
- Let detail pages breathe, but keep admin and data pages compact enough to scan quickly.
- Favor vertical rhythm over visual ornament.

## Component Rules

- Cards are for grouping meaningful chunks of content. Do not wrap everything in a card.
- Buttons should be used sparingly. One primary action is usually enough.
- Ghost and outline buttons are for secondary actions, not for filling space.
- Badges should add state, not decoration.
- Helper text should explain something the user could not infer, and only once.
- Tables and lists should carry the visual weight on report and admin screens.

## Empty States

- Keep them short.
- State the absence plainly.
- Offer one obvious next step.
- Do not write marketing copy for an empty state.
- Do not add illustrations unless they solve a specific comprehension problem.

## Creation Flows

- Keep the first screen focused on the action.
- Reduce explanatory copy.
- Avoid showing every optional setting at once.
- Put advanced controls behind clear secondary disclosure.
- Make the primary action obvious and close to the user’s focus.

## Reports

- Reports should read like records, not presentations.
- Prefer headings, rows, and sections over panels and callouts.
- Preserve provenance and decision history, but keep the visual treatment plain.
- Use alignment and hierarchy to show confidence, not decoration.

## Dashboard

- The dashboard is an operational summary.
- It should show current totals and recent activity without pretending to be a marketing home page.
- Use a restrained metric layout.
- Avoid hero copy and overly interpretive commentary.

## Settings

- Settings should feel systematic and quiet.
- Keep labels short and literal.
- Avoid stacked explanations.
- Group controls by task, not by story.

## Consultation And Evidence Workflows

- These flows should feel focused and low-friction.
- Transcript capture, theme review, people linking, and evidence email generation should read as steps in a workflow, not separate products.
- Use the minimum framing needed to show progression.
- Keep review states calm and explicit.

## Shell And Navigation

- The app shell should support wayfinding, not compete with the page content.
- Do not repeat the current section in multiple places unless it genuinely helps orientation.
- The sidebar should be clear and quiet.
- Page headers should not re-explain what the sidebar already says.

## Motion

- Motion should be subtle and functional.
- Use it to acknowledge state changes, not to decorate the interface.
- Do not rely on motion to create interest.
- Respect reduced-motion preferences.

## Accessibility And Trust

- Preserve clear contrast.
- Keep focus states visible.
- Keep tap targets usable.
- Do not bury the primary action under secondary chrome.
- Prefer plain language over clever labels.

## Surfaces To Match

When editing visible UI, use these current surfaces as the reference pattern:

- `app/(app)/layout.tsx`
- `components/layout/app-sidebar.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/reports/page.tsx`
- `components/reports/report-list.tsx`
- `components/settings/*`
- `app/(app)/consultations/*`
- `components/consultations/*`

## What To Avoid

- Hero sections inside the app shell.
- Decorative wrappers that do not add information.
- Repeated explanation across shell, page, and section.
- Excessive card grids.
- Overdesigned empty states.
- Badge-heavy layouts.
- AI-generated visual garnish.
- “Insightful” language where plain language is enough.

## Default Review Question

Before shipping any new UI, ask:

1. What is the minimum frame needed here?
1. What can be removed without harming comprehension?
1. Is the hierarchy obvious in 3 seconds?
1. Would this still feel calm if the page had 2x the data?

If the answer is no, simplify again.
