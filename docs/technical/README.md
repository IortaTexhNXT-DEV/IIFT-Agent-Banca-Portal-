# SalesVerse 2.0 technical document pack

Technical documents for SalesVerse 2.0, configured as the IIFT Agent/Banca Portal & Back-office. They accompany the
tender proposal in `docs/proposal` and use the same styling.

| Document | Files | Content |
|---|---|---|
| Solution Architecture (IIFT-SV2-SAD, DEL-06) | `SalesVerse-2.0-Solution-Architecture.docx` / `.pdf` | Principles, context, functional modules with RFP coverage, application and data architecture, integration (outbox, retry, dead-letter, inbound APIs), security controls, deployment options (on-premise, AWS/Azure, hybrid, DR), sizing, firewall matrix, non-functional design, technology versions, decision log, API operation list |
| Data Dictionary (IIFT-SV2-DD, DEL-07) | `SalesVerse-2.0-Data-Dictionary.xlsx`, `.docx` / `.pdf` | Every table and column with PostgreSQL type, nullability, default, keys, foreign keys, protection and business description; enumerations, relationships, indexes, sequences, audit trigger, check constraints, encrypted and blind-indexed columns |
| Production Support Handover (IIFT-SV2-PSH, DEL-26/27) | `SalesVerse-2.0-Production-Support-Handover.docx` / `.pdf` | Support tiers, hours and SLA, incident, problem, change and release processes, escalation, monitoring and alerts, twelve runbooks, backup and DR, configuration reference, scheduled jobs, knowledge transfer, developer onboarding, handover checklist, monthly report template, exit plan |
| Code Standards & Quality Report (IIFT-SV2-CSQ) | `SalesVerse-2.0-Code-Standards-and-Quality-Report.docx` / `.pdf` | Built from `evidence/`; see `README-reports.md` |
| Security Assessment Report (IIFT-SV2-SAR) | `SalesVerse-2.0-Security-Assessment-Report.docx` / `.pdf` | Built from `evidence/`; see `README-reports.md` |

## Rebuilding

Requirements: Python 3 with `python-docx`, `openpyxl` and `Pillow`; LibreOffice Writer with the `uno` Python module
for PDF export; `pdfinfo` (poppler) for page counts.

```bash
python3 docs/technical/build/build_all.py              # all three documents, with PDFs
python3 docs/technical/build/build_architecture.py     # one document
python3 docs/technical/build/build_data_dictionary.py --no-pdf
```

PDF export starts its own LibreOffice instance (private profile, port 2093), refreshes the table of contents and
page numbers, and writes the PDF next to the DOCX. The DOCX files contain a table-of-contents field that Word
refreshes when the document is opened.

## How the generators work

| File | Role |
|---|---|
| `build/tech_kit.py` | Shared kit for every technical document: `TechnicalWriter` (cover, document control, running header and footer, code blocks, procedure tables), PDF export and workbook styles. It imports the proposal's `brand.py`, `docx_kit.py` and `diagrams.py` read-only. Use it for any further technical document. |
| `build/tech_diagrams.py` | Pillow diagrams sized to print labels at about 10 to 12 pt |
| `build/schema_model.py` | Parses `apps/api/prisma/schema.prisma` and the migration SQL; stops if a column type or nullability differs between them |
| `build/dictionary_text.py` | Business descriptions of tables, columns, enumeration values, sequences and checks; the Data Dictionary build stops if anything in the schema lacks a description |
| `build/source_facts.py` | Reads facts from the code: environment variables (`app-config.ts`), business parameters (`setting-keys.ts`), roles, permissions, API operations (`docs/api/openapi.json`), package versions, test inventory, and holds the sizing model |
| `build/sad_part1.py`, `build/sad_part2.py` | Solution Architecture content |
| `build/build_*.py` | One builder per document; `build_all.py` runs the three above |

Because the configuration reference, parameters, roles, API list, versions and data dictionary are read from the
source at build time, rebuild the pack after every release that changes them. A schema change also needs new
descriptions in `dictionary_text.py`. Statements about items not yet built are marked "delivered during
implementation" in the documents.
