# DESIGN SYSTEM

## Purpose

This document defines the first implementation phase of the UI foundations for KP PDF:
- tokenized color and typography system,
- core component conventions (`ui-btn`, `ui-form-field`, `ui-card`),
- low-risk rollout plan for `KP Builder` (P0).

## Color Palette (Semantic)

- `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-disabled`
- `--color-secondary`, `--color-secondary-hover`, `--color-secondary-active`, `--color-secondary-disabled`
- `--color-accent`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- `--color-background`, `--color-surface`, `--color-surface-soft`, `--color-surface-muted`
- `--color-border`, `--color-border-light`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled`, `--color-text-on-primary`
- `--color-focus-ring`

Token definitions live in `frontend/src/styles/_tokens.scss`.

## Typography Scale

- Headings:
  - `--font-size-h1` (`2rem`)
  - `--font-size-h2` (`1.5rem`)
  - `--font-size-h3` (`1.25rem`)
- Body:
  - `--font-size-body-lg` (`1rem`)
  - `--font-size-body` (`0.875rem`)
  - `--font-size-body-sm` (`0.8125rem`)
  - `--font-size-caption` (`0.75rem`)
- Line-heights and weights:
  - `--line-height-*`
  - `--font-weight-*`

Global defaults are applied in `frontend/src/styles/_global.scss`.

## Usage Guidelines

## `ui-btn`

Variants:
- `default`
- `primary`
- `secondary`
- `ghost`
- `danger` (compatibility/destructive)

Behavior requirements:
- always visible `:focus-visible`,
- semantic `:disabled` appearance,
- minimum touch target for icon/buttons aligned to accessibility goals.

## `ui-form-field`

Rules:
- label is always visible (placeholder is not a label),
- error/hint text stays under control,
- focus state must use tokenized focus ring (`--ui-focus-ring`),
- disabled style must be visibly distinct.

## `ui-card`

Use as base surface container for grouped content blocks:
- default surface for standard panels,
- muted surface for secondary blocks.

## KP Builder (P0) Analysis and Cleanup Plan

Current visual-noise points in `KP Builder`:
- section-specific hardcoded tints in sidebar (`kp-builder.sidebar.scss`) create inconsistent hierarchy.
- mixed spacing values and ad-hoc density in control rows (`kp-builder.widgets.scss`).
- repeated local focus/hover styling deviates from core component standards.

Low-risk cleanup approach:
1. Normalize section surfaces to semantic surface tokens (`surface/surface-soft/muted`) first.
2. Keep section differentiation via subtle border/accent only, not full-background color shifts.
3. Replace local input/button styling with `ui-form-field` + `ui-btn` patterns where feasible.
4. Apply spacing scale (`--spacing-*`) consistently in panel groups and control rows.
5. Run P0 verification:
   - contrast check for key text/surface pairs,
   - keyboard focus visibility across sidebars and toolbars,
   - disabled affordance consistency.

## Constraints

- No hardcoded hex colors in component styles.
- No new styling framework introduction.
- Use existing Angular component architecture and SCSS modules.
- Roll out in low-risk slices with visual regression checks on key screens.
