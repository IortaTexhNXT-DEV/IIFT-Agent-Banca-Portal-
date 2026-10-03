# SalesVerse 2.0 – UI guide

Rules for building and aligning screens in `apps/web`. The reference screens are the
dashboards, the quotation wizard, the policy list/detail and the approvals pages.

## Tokens

Defined once in `src/theme/theme.ts` (Ant Design theme, `brand`) and mirrored as CSS
custom properties in `src/styles.css`. Use the tokens, never raw hex values.

| Token                                       | Value                                         | Use                                                               |
| ------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `--brand-magenta` / `colorPrimary`          | `#E1058C`                                     | primary buttons, active navigation, links, selected cards         |
| `--brand-magenta-dark`                      | `#B0046D`                                     | link text, selected menu text                                     |
| `--brand-orange` / `colorWarning`           | `#F58220`                                     | warnings and items needing attention only                         |
| `--ink` / `--text` / `--muted` / `--subtle` | `#1F2329` / `#3A3F47` / `#5B6270` / `#8A909C` | body, form labels, secondary text, field labels                   |
| `--surface` / `--fill` / `--border`         | `#F4F5F7` / `#F7F8FA` / `#E3E5E8`             | page canvas, table headers and inset panels, card and row borders |
| `--success` / `--danger`                    | `#1E8E3E` / `#D92D20`                         | positive / negative states                                        |

- Type: system font stack, 14px body. Page title 20px/600 (PageHeader), card titles
  15px/600, form section titles 15px/600, labels 12–13px grey.
- Spacing: 8px grid (4px for fine adjustments). Cards are separated by 16px; card body
  padding is 20px; flush cards line their first/last table cells up at 20px.
- Radius: 6px controls, 8px cards. 1px borders, no shadows on cards, no gradients.

## Layout

- The shell (`layouts/AppShell.tsx`) provides header (logo, global search, New quotation
  for portal users, notifications, user menu), grouped side navigation (`menus.tsx`),
  page area (max 1600px, 24px padding) and footer. Pages render only their content.
- Every page starts with `PageHeader`. Breadcrumb always starts with `Home`.
- Record pages: main column `xl={16}`, side column `xl={8}` (summaries, history, totals).
- Record tabs (`className="page-tabs"`) sit on the canvas; each tab's content is a card.
- New pages: add a menu entry with `anyOf` permissions to the right group in `menus.tsx`.

## Which component for what

| Need                                               | Component                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Title, breadcrumb, status, key facts, page actions | `PageHeader` (`tags`, `meta`, `extra`)                                                                                  |
| Metric tiles                                       | `KpiGrid` + `KpiTile` (icon, short label, value, optional `sub`, `to`, `tone`)                                          |
| Read-only record fields                            | `FieldGrid` (`columns` 2/3/4; `span: 2 \| 'full'` for long values)                                                      |
| Form layout                                        | `Form layout="vertical" requiredMark="optional"` + `FormSection` (grid, `columns` 1–4)                                  |
| Form/wizard/card buttons                           | `ActionBar` (`start` = Cancel/Back, children = actions, primary last; `sticky` on long forms)                           |
| List page                                          | `TableCard` (`toolbar` = filters, `actions` = buttons) + `DataTable`                                                    |
| Table columns                                      | `textColumn`, `moneyColumn`, `dateColumn`, `dateTimeColumn`, `statusColumn` from `DataTable.tsx`                        |
| Status chips                                       | `StatusTag` (22px high, 96px minimum width; `wide` for payment statuses; `tone` for chips that are not stored statuses) |
| Amounts                                            | `Money` (tabular, `B$ 1,234.50`); right-aligned in tables                                                               |
| Dashboard queues / follow-ups                      | `WorkQueue`                                                                                                             |
| Nothing to show                                    | `EmptyState` (`label="No claims"`, optional `action`, `inline` in small panels)                                         |
| Loading / API errors                               | `QueryState`, `ErrorAlert` (short outcome as `title`, server message as description)                                    |
| Completed actions                                  | `useApiMutation({ success })` or `useNotify()` – top-right notification, 4s, title + one line of data                   |
| Record histories                                   | `DataTable` event log (When · Event · Status · By · Details) or `ApprovalActionLog`; never a centred timeline           |
| Filters above an existing card (legacy)            | `FilterBar` – joins the following `.content-card` as its toolbar                                                        |

`FieldGrid` lays fields out on fixed rows (60px minimum, a rule between rows) so every
record reads the same; Ant Design `Descriptions` is not used.

## Tables

- `DataTable` defaults: `size="middle"`, pagination bottom-right, horizontal scroll sized
  from the column widths. Give every column a `width` except one flexible text column.
- `scroll={{}}` for tables that must fit a card (dashboards, side panels).
- Long text: `textColumn` (one line, ellipsis, tooltip). Never let a cell wrap to 3 lines.
- Money columns right-aligned (`moneyColumn`); dates `dd MMM yyyy` (`dateColumn`).
- Row click opens the record (`onRowClick`); keep the reference column as a link as well.
- Put the table in a `TableCard`/`content-card--flush` card so it runs edge to edge.

## Forms

- Vertical labels, `requiredMark="optional"` (marks the optional fields, not the required).
- Two columns on desktop by default (`FormSection columns={2}`); one column below 768px.
  Dates, amounts, codes, selects take one cell; only addresses, remarks, choice cards and
  uploads use `className="field--full"`.
- Help goes in `tooltip` on the label or a placeholder ("On issue"), not in `extra` prose.
- Validation messages are short: "Enter the ID number", "5 to 30 letters or digits".
- Modals and drawers: same form rules, `destroyOnHidden`, footer buttons right-aligned.

## Text

- Labels, not sentences: "Policy no.", "Outstanding", "Submit for verification".
- No descriptive subtitles under page titles; `meta` holds facts only (codes, names, dates).
- Alerts: a one-line `title`; add `description` only for data (a rejection reason, a list
  of referral reasons). Put the follow-up as an `action` button, not as prose with a link.
- Outcomes: short and past tense – "Nominees saved", "Payment submitted for verification",
  "Request RQ/26/000017 approved"; errors name the outcome ("Documents not sent") with the
  server's message underneath. Confirm dialogs name the record: "Discard QT/26/000012?".
- Empty states: "No claims yet" for a record's own lists, "No agents match the filters" for
  filtered lists.
- Sentence case everywhere; British English; takaful terms (participant, contribution,
  nominee). No emojis, no exclamation marks, no "Welcome …" banners.

## Do / don't

| Do                                                      | Don't                                              |
| ------------------------------------------------------- | -------------------------------------------------- |
| `PageHeader title tags meta extra`                      | `subtitle`-style sentences under the title         |
| `FieldGrid` for record facts                            | `Label : value` inline text or ad-hoc `<p>` lines  |
| `KpiTile` with a 1–3 word label                         | Uppercase labels that wrap to two lines            |
| `TableCard` toolbar with filters left, actions right    | A filter card floating above an unrelated card     |
| `EmptyState label="No documents"`                       | Large `Empty` illustrations or sentences           |
| `ActionBar` with the primary button last, right-aligned | Buttons scattered inside the form body             |
| Tokens / CSS variables                                  | Hex colours, inline `style` for spacing, gradients |
| One primary button per area                             | Two primary buttons side by side                   |

## Checks

From `apps/web`: `npx tsc -b`, `npx vitest run`, `npx oxlint -c .oxlintrc.json src`
(0 errors, 0 warnings). From the repo root: `npx prettier --check "apps/web/src/**/*.{ts,tsx,css}"`.
`npm run build -w apps/web` must pass. Screenshot changed screens at 1440×900 and 390×844.
