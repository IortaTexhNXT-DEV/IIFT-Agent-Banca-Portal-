"""Rebuild the SalesVerse 2.0 technical document pack produced by this folder.

Usage:
    python3 docs/technical/build/build_all.py [--no-pdf]

Builds the Data Dictionary (XLSX, DOCX, PDF), the Solution Architecture (DOCX,
PDF) and the Production Support Handover (DOCX, PDF). Each builder can also be run
on its own.
"""

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_data_dictionary  # noqa: E402
import build_architecture  # noqa: E402
import build_handover  # noqa: E402


def main():
    for builder in (build_data_dictionary, build_architecture, build_handover):
        builder.main()


if __name__ == "__main__":
    main()
