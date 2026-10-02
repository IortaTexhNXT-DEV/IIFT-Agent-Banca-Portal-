# Code standards, quality and security reports

Two of the SalesVerse 2.0 technical documents are built from evidence files, so they can be refreshed whenever the
evidence changes.

| Document | Generator |
|---|---|
| `SalesVerse-2.0-Code-Standards-and-Quality-Report.docx` / `.pdf` | `build/build_quality_report.py` |
| `SalesVerse-2.0-Security-Assessment-Report.docx` / `.pdf` | `build/build_security_report.py` |

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

PDF export needs LibreOffice Writer with `python3-uno`. Front-end evidence (`evidence/web-lint.json`,
`evidence/web-typecheck.txt`, `evidence/web-build.txt`) is optional; until it exists the quality report shows
"To be refreshed after front-end build".

The security report is iorta TechNXT's internal pre-implementation assessment. It does not replace the independent
penetration test scheduled before go-live (DEL-17).
