# OfferShield design system

One light, professional design language for every role (ADR-049). The premium feel comes from a deep-navy brand chrome, a navy gradient hero band, Inter, layered cards and crisp badges — not from colour everywhere. Source of truth: `client/src/index.css` (tokens) and `client/src/components/ui/` (primitives, exported from `ui/index.js`).

## Tokens

Defined with Tailwind v4 `@theme` in `index.css`, used as normal utilities (`bg-brand-950`, `text-accent-700`, `shadow-card`).

### Colour

| Token | Values | Use |
| --- | --- | --- |
| `brand-50 … brand-950` | `#eef2fb` `#dce4f6` `#b9c8ec` `#8da4dd` `#5d7bc9` `#3a5ab4` `#2a4596` `#1f3576` `#172957` `#111e40` `#0a1630` | Navy chrome: staff sidebar, student top bar, hero bands, icon tiles |
| `accent-50 … accent-900` | `#eef3ff` `#dce6ff` `#b3c8ff` `#84a3ff` `#5a7ffb` `#3b62f2` `#2a4ddb` `#233fb5` `#213791` `#1f3273` | Actions only: primary buttons (`accent-600`), links (`accent-700`), focus rings (`accent-500`), selected tabs |
| `slate` (Tailwind) | — | All neutral text, borders, surfaces |
| `emerald` | — | **Success / verified** only |
| `amber` | — | **Warning / look-alike / needs reply / stale** only |
| `rose` | — | **Danger / confirmed fraud / high priority / destructive actions** only |
| `sky` | — | **Info** (visible-to-student, under review, info advisories) |
| `violet` | — | Inconclusive outcome, related-case chips |

**Rule:** semantic colours carry meaning and are never decorative. A green element must mean "verified by the placement cell", never "safe". No hex values outside the theme, except in the logo SVG (`components/layout/Logo.jsx`, `public/favicon.svg`).

### Shape, depth and motion

| Token | Value |
| --- | --- |
| Card radius | `rounded-2xl` |
| Input / button radius | `rounded-xl` (small buttons `rounded-lg`) |
| `shadow-card` | `0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .06)` plus `ring-1 ring-slate-900/5` |
| `shadow-raised` | hover elevation of interactive cards, menus, toasts |
| `shadow-overlay` | dialogs, drawers, hero result cards |
| Motion | 150–200 ms colour/transform transitions; `animate-fade-in`, `animate-pop-in`, `animate-slide-in-right/left`; everything is disabled under `prefers-reduced-motion` |
| `hero-band` | navy radial + linear gradient utility (landing, auth pages, student home) |
| `prose-doc` | long-form reading utility (privacy, terms) |

### Typography

Inter Variable, self-hosted via `@fontsource-variable/inter` (bundled by Vite, so `font-src 'self'` is enough; ADR-050).

| Role | Classes |
| --- | --- |
| Page title (h1) | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Section / card title | `text-base font-semibold` |
| Staff body | `text-sm` |
| Student body | `text-[15px]` (set on the student shell) |
| Labels / table heads | `text-xs font-medium uppercase tracking-wide text-slate-500` |
| Numbers | `tabular-nums` on stats, money and counts |
| Technical values | `font-mono` (`CodeChip`, case numbers) |

## Layouts

| Shell | Who | Structure |
| --- | --- | --- |
| `PublicLayout` | signed-out visitors; landing, login, register always | Navy header (logo, Sign in, Student registration), full-bleed hero pages, footer |
| `StudentShell` | students | Navy top bar (logo, Home / My requests / Advisories, bell, user menu); nav in a sheet below `md`; content `max-w-5xl` |
| `AppShell` | officers, TPO head, super admin | 260 px navy sidebar (Desk / Trust / Insights / Team, count badges), off-canvas drawer below `lg`; top bar with section title, quick lookup, bell and user menu; content `max-w-[1440px]` |

`Layout.jsx` only chooses the shell; `ProtectedRoute` and the server still enforce every permission. The footer disclaimer ("OfferShield helps your placement cell review opportunities. It never certifies an offer as safe.") appears in every shell. `DemoBanner` and `WakingServerBanner` are slim strips at the top.

## Components (`components/ui/`)

| Group | Components |
| --- | --- |
| Inputs and actions | `Button` (primary, secondary, ghost, danger, success; sm/md/lg; `loading`; `icon`/`iconRight`), `ButtonLink`, `IconButton` (label required), `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `FileDropzone`, and the wrappers `TextField`, `SelectField`, `TextAreaField`, `CheckboxField` |
| Display | `Card` / `CardHeader` / `CardBody`, `PageHeader` (breadcrumb, eyebrow, actions), `Badge` (tones + dot), `StatusBadge` (account status; case status lives in `components/StatusBadge.jsx`), `Avatar` (initials, colour from the name), `Tabs` (underline, counts, arrow keys), `Table` / `THead` / `TBody` / `Tr` / `Th` / `Td` (sticky header option, hover, compact density, clickable rows that keep a real link inside), `Pagination` |
| Overlays | `Dialog`, `ConfirmDialog`, `Drawer`, `DropdownMenu`, `Tooltip` (native `title`) |
| Feedback | `EmptyState`, `Skeleton`, `Spinner`, `ToastProvider` + `useToast`, `Alert` / `ErrorAlert`, `OneTimeSecret` |
| Data | `StatCard`, `ProgressBar`, `KeyValueList`, `CodeChip` |

Domain components built on them: `LookupResultCard` (icon per result), `CaseTimeline` (icon per event, actor avatar, internal items tinted with a lock chip), `AdvisoryCard` (severity stripe), `SignalsPanel`, `Composer`, `DecisionForm`, `TargetPicker` (chip toggles), `IndicatorPicker` (checkbox list of code chips), `BarRows` (CSS bars with value labels; no chart library).

## Usage rules

1. **Never say "safe".** Verified means "your placement cell checked this recruiter"; "Not reviewed does not mean safe" stays on every not-reviewed result. Product-contract texts ("Automated hints — not a decision", "Never shown to the student", "updated by someone else", "I've read this", "shown only once", the footer disclaimer) must not be reworded.
2. **Semantic colour only for meaning** (see the colour table). Fraud is rose, verified is emerald, look-alike is amber.
3. **Dates and money only through `utils/format.js`** (en-IN: `12 Nov 2026`, `12 Nov 2026, 1:34 pm`, "3 hours ago" with the exact time in `title`, `₹22,543`). A test fails if `toLocale*` appears anywhere else (ADR-053).
4. **Icons:** `lucide-react` named imports only, always `aria-hidden` next to text; icon-only buttons use `IconButton` with a `label` (ADR-051). No emoji in the UI.
5. **Accessibility:** visible `focus-visible` outlines (accent-500); dialogs and drawers trap focus, close on Escape and return focus to the trigger; a dialog focuses its first text field once on open and never re-focuses on re-render (Phase 7 fix); menus support arrow keys, Home/End and Escape; tabs use roving `tabindex`; required markers are CSS-only so labels stay exact.
6. **Mobile:** every page must work at 390 px without horizontal scroll. Grids declare `grid-cols-1` before their breakpoint columns; wide tables scroll inside their card.
7. **Toasts** confirm mutations that previously only showed inline text; inline errors stay inline next to the field or action.
8. **CSP:** no inline scripts, no external fonts, images or scripts; inline `style` attributes are allowed (CSS bars, progress widths).
9. **No component, chart or animation library** (ADR-052); compose these primitives instead.
