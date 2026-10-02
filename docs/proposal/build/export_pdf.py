"""Export the proposal DOCX to PDF with LibreOffice, refreshing the table of
contents and page fields first.

Usage:
    python3 docs/proposal/build/export_pdf.py [path/to/file.docx]

A plain `soffice --headless --convert-to pdf` does not rebuild the table of
contents, so this script drives LibreOffice through its UNO API: it opens the
document, updates all indexes and fields, and writes the PDF next to the DOCX.
It uses the system Python that ships the `uno` module (python3 on Linux).
"""

import subprocess
import sys
import time
from pathlib import Path

import uno
from com.sun.star.beans import PropertyValue

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402

PORT = 2002


def _property(name, value):
    prop = PropertyValue()
    prop.Name, prop.Value = name, value
    return prop


def _connect(retries=40):
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(retries):
        try:
            return resolver.resolve(f"uno:socket,host=localhost,port={PORT};urp;StarOffice.ComponentContext")
        except Exception:  # LibreOffice still starting
            time.sleep(0.5)
    raise RuntimeError("Could not connect to LibreOffice")


def export(docx: Path) -> Path:
    pdf = docx.with_suffix(".pdf")
    office = subprocess.Popen([
        "soffice", "--headless", "--invisible", "--nologo", "--norestore",
        f"--accept=socket,host=localhost,port={PORT};urp;",
    ])
    try:
        context = _connect()
        desktop = context.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", context)
        document = desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(docx.resolve())), "_blank", 0,
                                                (_property("Hidden", True),))
        for _ in range(2):  # second pass settles page numbers once the TOC has its final length
            indexes = document.getDocumentIndexes()
            for i in range(indexes.getCount()):
                indexes.getByIndex(i).update()
            document.getTextFields().refresh()
        document.storeToURL(uno.systemPathToFileUrl(str(pdf.resolve())),
                            (_property("FilterName", "writer_pdf_Export"),))
        document.close(True)
    finally:
        office.terminate()
        office.wait(timeout=30)
    return pdf


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else brand.DOCX_OUTPUT
    print(f"Wrote {export(target)}")
