"""Rebuild the SalesVerse 2.0 technical document pack produced by this folder.

Usage:
    python3 docs/technical/build/build_all.py [--no-pdf]

Builds the Data Dictionary (XLSX, DOCX, PDF), the Solution Architecture (DOCX,
PDF), the Production Support Handover (DOCX, PDF), the Test Cases workbook (XLSX)
and the Test Strategy (DOCX, PDF), then verifies that the Test Strategy's status
chapter and the workbook's Summary sheet agree. Each builder can also be run on
its own.
"""

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_data_dictionary  # noqa: E402
import build_architecture  # noqa: E402
import build_handover  # noqa: E402
import build_test_cases  # noqa: E402
import build_test_strategy  # noqa: E402
import test_status  # noqa: E402


def main():
    for builder in (build_data_dictionary, build_architecture, build_handover, build_test_cases,
                    build_test_strategy):
        builder.main()
    totals = test_status.verify_pack()
    print(f"Test Strategy and Test Cases agree: {totals['cases']} cases, "
          f"{', '.join(f'{k} {v}' for k, v in totals['by_status'].items())}")


if __name__ == "__main__":
    main()
