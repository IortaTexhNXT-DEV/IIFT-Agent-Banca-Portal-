# IIFT Agent/Banca Portal & Back-office – Tender Proposal

Proposal documents from iorta TechNXT to Insurans Islam Family Takaful Sendirian Berhad (IIFT) for the
"Agent/Banca Portal & Back-office Solution" RFP. The offered solution is SalesVerse 2.0, configured for IIFT as the
IIFT Agent/Banca Portal & Back-office. The technical document pack referenced in the proposal lives in
`docs/technical/`.

## Files

| File | Purpose |
|---|---|
| `IIFT-Agent-Banca-Portal-Proposal-iorta-TechNXT.docx` | Technical and commercial proposal (editable master) |
| `IIFT-Agent-Banca-Portal-Proposal-iorta-TechNXT.pdf` | PDF export of the proposal with the table of contents filled in |
| `IIFT-Commercial-Pricing-iorta-TechNXT.xlsx` | Pricing workbook: options summary and five-year cash view, fees in IIFT's format (Description / Fee / WHT / OPE / Total), Option A (licence, implementation, integration per interface, AMC), Option B (implementation, subscription, managed services, cloud at actuals), Option C (source code handover, knowledge transfer, post-handover support, escrow), RFP section 10 for both options, OPE, rate card, payment schedules, assumptions |
| `IIFT-Bill-of-Materials-iorta-TechNXT.xlsx` | Bill of Materials: summary by category and option, on-premise infrastructure (Option A, sized as in the Solution Architecture), cloud services (Option B, at actuals), software components and licences, third-party services with treatment (included / pass-through / IIFT procures / not required) |
| `assets/iift-logo.png` | Client logo, used only in the "Prepared for" block on the cover |
| `assets/iorta-logo.png` | iorta TechNXT logo: cover, running header of the proposal, Summary sheets of both workbooks |
| `screenshots/` | Application screens inserted in the personas chapter (see below) |
| `build/` | Scripts that produce all of the above |

### Build scripts

| Script | What it does |
|---|---|
| `build/build_proposal.py` | Assembles the Word document: cover, cover letter, front matter, chapters in `numbering.CHAPTERS` order, annexes |
| `build/numbering.py` | Chapter order and `sec("key")` helper used for every cross-reference |
| `build/sections_scope.py` | Scope of work following the RFP structure (3.1, 4.1–4.4, 5, 7, 8) and the solution fitment chapter |
| `build/sections_people.py` | Chapter 7: personas (profile, navigation map, screens, screen sequence), navigation model, ten end-to-end journeys (vertical swim-lane figures and step tables) and the screen index |
| `build/screen_manifest.py` | Manifest of every screen image: file, persona, demo user, route, capture actions, caption, width; read by the build and exported as JSON for `tools/screenshots/capture.mjs` |
| `build/sections_solution.py` | Understanding, functional rules, products and flows, architecture, security, deployment, infrastructure |
| `build/sections_delivery.py` | Technical document pack, methodology, timeline, maintenance, team, assumptions, risks |
| `build/sections_commercial.py` | Commercial proposal (options A/B/C, client format, RFP section 10, OPE, BOM summary, rate card, payment schedules, commercial terms), validity, supporting information, terms and conditions, Annexes A–D |
| `build/compliance_matrix.py` | Compliance and fitment data for every RFP requirement ID (Annex A, fitment chapter) |
| `build/pricing_data.py` | **Single source of truth for all prices and the bill of materials**; the DOCX and both XLSX files read from it and it self-checks the totals |
| `build/docx_kit.py` | Layout helpers (branded headings, tables, call-outs, figures, header/footer fields) |
| `build/diagrams.py` | Architecture, deployment, integration, lifecycle, governance, Gantt diagrams, plus the persona navigation maps, vertical journey flows and the navigation model (Pillow) |
| `build/build_pricing.py` | Writes the pricing workbook with live Excel formulas and verifies every total (Python evaluator, then LibreOffice recalculation) |
| `build/build_bom.py` | Writes the Bill of Materials workbook; checks the on-premise sizing against `docs/technical/build/sad_part2.py` and verifies the totals |
| `build/xlsx_kit.py` | Shared styling, layout and verification helpers for both workbooks |
| `build/export_pdf.py` | Converts the DOCX to PDF through LibreOffice, refreshing the table of contents and page numbers first |

Text in the section modules is plain Python lists/tuples. Inline conventions: `**bold**`, and `[Placeholder]`
is rendered with yellow highlight.

## Rebuild

```bash
pip install python-docx openpyxl pillow
python docs/proposal/build/build_proposal.py     # writes the .docx
python docs/proposal/build/build_pricing.py      # writes the pricing .xlsx and verifies totals
python docs/proposal/build/build_bom.py          # writes the Bill of Materials .xlsx and verifies totals
python3 docs/proposal/build/export_pdf.py        # writes the .pdf (needs LibreOffice Writer + python3-uno)
```

`export_pdf.py` needs LibreOffice with the Writer component (`libreoffice-writer`, `python3-uno` on Debian/Ubuntu).
A plain `soffice --headless --convert-to pdf --outdir docs/proposal docs/proposal/<file>.docx` also works, but it
leaves the table of contents empty. When the DOCX is opened in Microsoft Word, accept the prompt to update fields
(or press Ctrl+A, then F9) to refresh the table of contents.

To change a price, edit `build/pricing_data.py` (and the `EXPECTED` totals if the approved pricing changes), then
rebuild all four files. If the infrastructure sizing in the Solution Architecture changes, update `ON_PREM_BOM` in
`pricing_data.py` to match; `build_bom.py` stops with a message until the two agree.

## iorta logo

`assets/iorta-logo.png` is used on the cover, in the running header (small, left) and on the Summary sheet of both
workbooks. If the file is removed, the cover falls back to a text wordmark and the header to text only.

## Application screenshots

The screens are listed in `build/screen_manifest.py` (`PERSONA_SCREENS`): file name, persona, demo user,
route, the steps taken before the capture, caption and width. Files live in `docs/proposal/screenshots/`
as PNG, 1440 × 900 at device scale factor 1.5 (2160 × 1350 px). A missing file is replaced by a grey
placeholder so the document always builds.

Capture them with `node tools/screenshots/capture.mjs` (see `tools/screenshots/README.md`), then
rebuild. `python3 docs/proposal/build/screen_manifest.py` prints the list; `--json` exports it for the
capture script. Files `01` to `24` are the original set, reused where they fit the persona sequences;
`25` onwards were added for the personas chapter. `24-policy-schedule-pdf.png` is a page of a
generated e-Policy and is produced by hand.

## Placeholders to complete before submission

All placeholders appear in square brackets with yellow highlight in the DOCX. Search for `[` to find them.

**Cover, cover letter and document control**
- `[Proposal reference no.]`, `[IIFT RFP / tender reference no.]`
- `[Day]` of the letter date, `[Street address]`, `[Postcode]` of IIFT
- `[Name of contact person]`, `[Designation]`, `[e-mail address]`, `[telephone number]`
- `[Name of authorised signatory]`, `[Designation]`, `[Company stamp]`
- Version history `[Date]`; review and approval `[Name]` / `[Name, designation]`

**Enclosures B and C (attached separately by the bid owner)**
- Enclosure B: `[File name of the corporate profile]`, `[Name, designation, e-mail, telephone]`
- Enclosure C: `[File name of the certificate]`, `[Business registration no.]`

**Team, support and continuity**
- Team member names `[Name]` / `[Names]` and the key personnel table in Annex B (`[Full name]`,
  `[Degrees, certifications]`, `[Years]`, `[3 to 5 projects]`); attach full CVs
- Escalation contacts `[Name, phone, e-mail]` (maintenance chapter)
- `[Confirm or extend with iorta's corporate BCP details.]` (maintenance chapter)

**Commercial and contractual decisions**
- `[bid owner to confirm any credit of subscription fees already paid]` (Option B conversion to Option A)
- `[submission date]` and `[expiry date]` (quotation validity)
- Terms: confidentiality survival `[five]` years; service credits `[e.g. 5% …]`; liability cap
  `[the total fees paid and payable in the twelve months before the claim …]`; termination for convenience
  `[90]` days; dispute forum `[mediation / arbitration in Brunei Darussalam]`
