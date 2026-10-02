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
| `IIFT-Commercial-Pricing-iorta-TechNXT.xlsx` | Pricing workbook: summary in IIFT's format, RFP section 10 breakdown, integration per interface, five-year maintenance, rate card, payment milestones, third-party and infrastructure costs, assumptions |
| `assets/iift-logo.png` | Client logo, used only in the "Prepared for" block on the cover |
| `assets/iorta-logo.png` | *Optional* iorta TechNXT logo (see below) |
| `screenshots/` | Application screens inserted in Section 20.2 (see list below) |
| `build/` | Scripts that produce all of the above |

### Build scripts

| Script | What it does |
|---|---|
| `build/build_proposal.py` | Assembles the Word document: cover, cover letter, front matter, chapters in `numbering.CHAPTERS` order, annexes |
| `build/numbering.py` | Chapter order and `sec("key")` helper used for every cross-reference |
| `build/sections_scope.py` | Scope of work following the RFP structure (3.1, 4.1–4.4, 5, 7, 8) and the solution fitment chapter |
| `build/sections_people.py` | Personas, user journeys (swim-lane diagrams and step tables) and the screen catalogue with sample screens |
| `build/sections_solution.py` | Understanding, functional rules, products and flows, architecture, security, deployment, infrastructure |
| `build/sections_delivery.py` | Technical document pack, methodology, timeline, maintenance, team, assumptions, risks |
| `build/sections_commercial.py` | Commercials, validity, supporting information, terms and conditions, Annexes A–D |
| `build/compliance_matrix.py` | Compliance and fitment data for every RFP requirement ID (Annex A, fitment chapter) |
| `build/pricing_data.py` | **Single source of truth for all prices**; both the DOCX and XLSX read from it and it self-checks the totals |
| `build/docx_kit.py` | Layout helpers (branded headings, tables, call-outs, figures, header/footer fields) |
| `build/diagrams.py` | Architecture, deployment, integration, lifecycle, governance, Gantt and swim-lane diagrams (Pillow) |
| `build/build_pricing.py` | Writes the pricing workbook with live Excel formulas and verifies every total |
| `build/export_pdf.py` | Converts the DOCX to PDF through LibreOffice, refreshing the table of contents and page numbers first |

Text in the section modules is plain Python lists/tuples. Inline conventions: `**bold**`, and `[Placeholder]`
is rendered with yellow highlight.

## Rebuild

```bash
pip install python-docx openpyxl pillow
python docs/proposal/build/build_proposal.py     # writes the .docx
python docs/proposal/build/build_pricing.py      # writes the .xlsx and verifies totals
python3 docs/proposal/build/export_pdf.py        # writes the .pdf (needs LibreOffice Writer + python3-uno)
```

`export_pdf.py` needs LibreOffice with the Writer component (`libreoffice-writer`, `python3-uno` on Debian/Ubuntu).
A plain `soffice --headless --convert-to pdf --outdir docs/proposal docs/proposal/<file>.docx` also works, but it
leaves the table of contents empty. When the DOCX is opened in Microsoft Word, accept the prompt to update fields
(or press Ctrl+A, then F9) to refresh the table of contents.

To change a price, edit `build/pricing_data.py` (and the `EXPECTED` totals if the approved pricing changes), then
rebuild all three files.

## iorta logo

The cover currently shows a text wordmark "iorta TechNXT". To use the official logo, save it as
`docs/proposal/assets/iorta-logo.png` (transparent PNG, at least 600 px wide) and rebuild; the script picks it up
automatically.

## Application screenshots

Save screens in `docs/proposal/screenshots/` with exactly these names (PNG, ideally 1440 × 900). Missing files
are replaced by a grey placeholder box, so the document always builds; rebuild once the screens are available.
The list lives in `SCREENSHOTS` in `build/sections_people.py`; when the final set of file names is provided, edit that
list (file name and caption) and rebuild.

| File | Caption |
|---|---|
| `01-login.png` | Secure login |
| `02-portal-dashboard.png` | Agent/Banca dashboard |
| `03-quotation-product.png` | Product selection |
| `04-quotation-wizard.png` | Quotation – participant & coverage |
| `05-quotation-summary.png` | Quotation summary & contribution |
| `06-policy-list.png` | Policy listing & search |
| `07-policy-detail.png` | Policy details, documents & history |
| `08-participants.png` | Participant management |
| `09-billing-payment.png` | Payment submission (single/bulk) |
| `10-claims.png` | Claim notification |
| `11-issues.png` | Issue reporting & tracking |
| `12-bo-dashboard.png` | Back-office management dashboard |
| `13-bo-approvals.png` | Maker-checker approvals inbox |
| `14-bo-agents.png` | Agent/Banca administration |
| `15-bo-agent-detail.png` | Agent profile, hierarchy & documents |
| `16-bo-aml-review.png` | AML/KYC compliance review |
| `17-bo-payment-verification.png` | Payment verification & receipts |
| `18-bo-reports.png` | Reports & export |
| `19-bo-audit.png` | Audit trail search |
| `20-bo-users-roles.png` | Users, roles & permissions |
| `21-bo-config.png` | System parameters & master data |
| `22-bo-integration-monitor.png` | Integration monitor & reconciliation |
| `23-bo-eod.png` | End-of-day processing |
| `24-policy-schedule-pdf.png` | Generated e-Policy schedule |

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
- `[Bid owner to confirm the market comparison statement.]` (pricing basis)
- `[submission date]` and `[expiry date]` (quotation validity)
- Terms: confidentiality survival `[five]` years; service credits `[e.g. 5% …]`; liability cap
  `[the total contract value …]`; `[Confirm: rate card held without escalation …]`; termination for convenience
  `[90]` days; dispute forum `[mediation / arbitration in Brunei Darussalam]`
