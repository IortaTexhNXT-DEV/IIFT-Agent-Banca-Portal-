# Proposal screenshots

`capture.mjs` signs in to the running application as each demo user and captures the screens listed
in `docs/proposal/build/screen_manifest.py`. The manifest is the only place that defines which screens
exist, who is signed in, which route is opened and which steps are taken first; the proposal build
reads the same list to place the images and their captions.

## Requirements

- The web application and API running (`npm run dev:web`, `npm run dev:api`) with the demo data seeded
  (`DEMO_PASSWORD='…' npm run db:seed:demo` in `apps/api`).
- Node 22 and `playwright-core` (resolved from `node_modules`, `/opt/node-tools/node_modules` or
  `PLAYWRIGHT_CORE`).
- Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` or `CHROMIUM_PATH`.

## Use

```bash
export DEMO_PASSWORD='the demo password'
node tools/screenshots/capture.mjs --list                 # what would be captured
node tools/screenshots/capture.mjs --dry-run              # readiness per entry (missing placeholders)
node tools/screenshots/capture.mjs --only 25,26 --out /tmp/shots   # a few entries into a scratch folder
node tools/screenshots/capture.mjs --persona finance      # one persona's sequence
node tools/screenshots/capture.mjs                        # everything into docs/proposal/screenshots
```

Then rebuild the proposal: `python3 docs/proposal/build/build_proposal.py` and
`python3 docs/proposal/build/export_pdf.py`.

Captures are 1440 × 900 CSS pixels at device scale factor 1.5. The script waits for the network to be
idle before each capture and lists any console error raised on the page next to the file name. Exit
code 1 means at least one entry failed; the files that did succeed are kept.

Entries whose route contains a `${NAME}` placeholder (the participant e-signature page needs
`ESIGN_TOKEN`) are skipped until that variable is set. The token is the last part of the link in the
e-mail sent by **Send e-signature link**; in a simulated environment it can be read from the stored
notification. `24-policy-schedule-pdf.png` is marked `manual` and is never captured: it is a page of
a generated e-Policy PDF.

The `admin` user (system administrator) is created by `seed.ts` with `SEED_ADMIN_PASSWORD` and must
change the password at first sign-in: set `PASSWORD_ADMIN` and `CHANGE_PASSWORD_TO` the first time.

## Actions

`actions` in the manifest is a list of steps run after the route has loaded:

| Step | Meaning |
|---|---|
| `{"click": {"role": "button", "name": "Approve"}}` | click an element by ARIA role and accessible name; `name` may be a regular expression written as `"/^RQ\\//"`; `first`, `nth`, `exact` are optional |
| `{"clickText": "Payment history"}` | click visible text (exact) |
| `{"fill": {"label": "Policy number", "value": "PRO/26/000001"}}` | type into a labelled field |
| `{"select": {"label": "Request type", "option": "Policy endorsement"}}` | choose an option of a labelled select |
| `{"press": "Control+k"}` / `{"type": "PRO"}` | keyboard |
| `{"wait": 600}` | pause in milliseconds |
| `{"checkFirstRow": true}` / `{"checkAllRows": true}` | tick the first row or the select-all box of a table |

Selectors use roles, labels and visible text only, so a restyle of the interface does not break them;
when a label changes, change it in the manifest.
