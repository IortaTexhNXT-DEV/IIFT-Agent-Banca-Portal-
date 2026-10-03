# Code standards, quality, security and test reports

Four of the SalesVerse 2.0 technical documents are built from evidence files, so they can be refreshed whenever the
evidence changes.

| Document | Generator |
|---|---|
| `SalesVerse-2.0-Code-Standards-and-Quality-Report.docx` / `.pdf` | `build/build_quality_report.py` |
| `SalesVerse-2.0-Security-Assessment-Report.docx` / `.pdf` | `build/build_security_report.py` |
| `SalesVerse-2.0-Test-Cases.xlsx` | `build/build_test_cases.py` |
| `SalesVerse-2.0-Test-Strategy.docx` / `.pdf` | `build/build_test_strategy.py` |

Both generators read `evidence/` at build time (tests, coverage, npm audit, licences, code metrics, security checks)
and the repository's own configuration (tsconfig, oxlint, Prettier, CI workflow, Dockerfiles, nginx, start-up
configuration). They reuse the layout kit in `docs/proposal/build` via `build/reports_common.py`.

## Rebuild

```bash
pip install python-docx openpyxl pillow pyyaml
python3 docs/technical/build/capture_static_analysis.py   # lint, type check and format results -> evidence/api-static-analysis.json
python3 docs/technical/build/build_quality_report.py
python3 docs/technical/build/build_security_report.py
```

PDF export needs LibreOffice Writer with `python3-uno`. Front-end evidence (`evidence/web-unit-tests.json`,
`evidence/web-lint.json`, `evidence/web-typecheck.txt`, `evidence/web-build.txt`) is optional; until it exists the
quality report shows "To be refreshed after front-end build".

The security report is iorta TechNXT's internal pre-implementation assessment. It does not replace the independent
penetration test scheduled before go-live (DEL-17).

## Test status evidence

The Test Cases workbook and the status chapter of the Test Strategy read these files:

| File | Produced by |
|---|---|
| `evidence/api-unit-tests.json`, `evidence/web-unit-tests.json`, `evidence/api-e2e-tests.json` | `npx vitest run --reporter=json --outputFile=...` in `apps/api` (unit and `--config ./vitest.config.e2e.ts`) and `apps/web` |
| `evidence/test-reruns.json` | Later re-runs of the three suites (same reporter, condensed); the latest result of a test is the status shown, both runs are cited |
| `evidence/security-checks.json` | `node tools/security/security-checks.mjs` |
| `evidence/api-test-run.json` | `BASE_URL=http://localhost:3000 DEMO_PASSWORD='...' INBOUND_API_KEY='...' node tools/testing/api-test-run.mjs` against a non-production instance loaded with the demonstration data; every executed case with actor, request, response and verdict |
| `evidence/ui-screens/` | Screen captures of the manual exploratory runs, copied by `build/collect_ui_evidence.py` (`SHOTS_DIR=<folder>`) |

Rebuild after refreshing the evidence:

```bash
python3 docs/technical/build/build_test_cases.py       # fails on unknown references, missing screens or formula drift
python3 docs/technical/build/build_test_strategy.py
python3 -c "import sys; sys.path.insert(0,'docs/technical/build'); import test_status; test_status.verify_pack()"
```

The API run script creates business records in the target database (participants, quotations, payments, requests,
a staff user) and must never be pointed at production. The end-to-end suite needs a database whose name ends in
`_test` (default `iift_test`), which it drops and rebuilds.
