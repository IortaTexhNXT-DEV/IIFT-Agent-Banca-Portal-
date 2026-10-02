"""Build the SalesVerse 2.0 Solution Architecture (DOCX and PDF).

Usage:
    python3 docs/technical/build/build_architecture.py [--no-pdf]

Content is in sad_part1.py and sad_part2.py; facts that exist in the code (API
operations, parameters, roles, versions, schema) are read from the repository at
build time by source_facts.py and schema_model.py.
"""

import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import tech_kit  # noqa: E402
from tech_kit import TechnicalWriter, DocInfo, TECH_DIR  # noqa: E402
import tech_diagrams  # noqa: E402
import schema_model  # noqa: E402
import sad_part1 as p1  # noqa: E402
import sad_part2 as p2  # noqa: E402

INFO = DocInfo(
    code="SAD",
    title="Solution Architecture",
    subtitle="Application, data, integration, security, deployment and infrastructure architecture",
    deliverable="DEL-06 (Solution Architecture)",
    keywords="solution architecture; SalesVerse 2.0; IIFT; NestJS; PostgreSQL; deployment; security",
    purpose="This document is the Solution Architecture for SalesVerse 2.0 as configured for IIFT. It is maintained "
            "throughout the contract and updated after every material change (NFR-21, MNT-27).",
    related=["SalesVerse-2.0-Data-Dictionary (.docx and .xlsx): every table and column.",
             "SalesVerse-2.0-Production-Support-Handover: support model, runbooks and configuration reference.",
             "docs/api/openapi.json: API description generated from the code."],
)

FIGURES = ["context", "module_map", "lifecycle", "logical", "pipeline_req", "entities", "integration", "security",
           "on_prem", "cloud", "dr", "cicd"]


def build(path: Path):
    pm = schema_model.load()
    with tempfile.TemporaryDirectory() as tmp:
        figs = tech_diagrams.render(FIGURES, Path(tmp))
        w = TechnicalWriter(INFO)
        w.cover(figs["cover_band"])
        w.document_control()
        w.table_of_contents()
        p1.purpose(w)
        p1.principles(w)
        p1.context(w, figs)
        p1.functional(w, figs)
        p1.application(w, figs)
        p1.data(w, figs, pm)
        p2.integration(w, figs)
        p2.security(w, figs)
        p2.deployment(w, figs)
        p2.sizing(w)
        p2.nfr(w)
        p2.stack(w)
        p2.decisions(w)
        p2.appendix_api(w)
        p2.appendix_glossary(w)
        w.save(path)


def main():
    TECH_DIR.mkdir(parents=True, exist_ok=True)
    docx = TECH_DIR / f"{INFO.file_stem}.docx"
    build(docx)
    print(f"Wrote {docx}")
    if "--no-pdf" not in sys.argv:
        pdf = tech_kit.export_pdf(docx)
        print(f"Wrote {pdf} ({tech_kit.pdf_pages(pdf)} pages)")


if __name__ == "__main__":
    main()
