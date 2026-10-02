"""Shared generator kit for the SalesVerse 2.0 technical document pack.

Every technical document (Solution Architecture, Data Dictionary, Production
Support Handover, and later the Code Standards & Quality Report and the
Security Assessment Report) is built with this module so the pack matches the
tender proposal: the proposal's brand constants, DOCX helpers and diagram
primitives are imported read-only from docs/proposal/build and extended here.

Typical use:

    from tech_kit import TechnicalWriter, DocInfo, export_pdf
    info = DocInfo(code="SAD", title="Solution Architecture", ...)
    w = TechnicalWriter(info)
    w.cover()
    w.document_control()
    w.table_of_contents()
    w.h1("Purpose and Scope") ...
    w.save(path); export_pdf(path)
"""

import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

sys.dont_write_bytecode = True  # never leave caches in the proposal folder

BUILD_DIR = Path(__file__).resolve().parent
TECH_DIR = BUILD_DIR.parent
REPO_ROOT = BUILD_DIR.parents[2]
PROPOSAL_BUILD = REPO_ROOT / "docs" / "proposal" / "build"
FIGURE_DIR = BUILD_DIR / "figures"
sys.path.insert(0, str(PROPOSAL_BUILD))

import brand  # noqa: E402  (proposal brand constants, read-only)
import docx_kit  # noqa: E402
from docx_kit import (ProposalWriter, add_rich_text, add_field, set_column_widths, shade_cell,  # noqa: E402,F401
                      _paragraph_border, _table_borders, _cell_margins, _row_flags, _no_table_borders)
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT  # noqa: E402
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT  # noqa: E402
from docx.oxml import OxmlElement  # noqa: E402
from docx.oxml.ns import qn  # noqa: E402
from docx.shared import Pt, Cm, RGBColor, Twips  # noqa: E402

import pricing_data as price  # noqa: E402  (proposal commercial data, read-only: the pack quotes it, never copies it)

PRODUCT = brand.PRODUCT
CLIENT = brand.CLIENT
CLIENT_SHORT = brand.CLIENT_SHORT
BIDDER = brand.BIDDER
SOLUTION_NAME = brand.SOLUTION_NAME
ISSUE_DATE = brand.SUBMISSION_DATE
CLASSIFICATION = brand.CLASSIFICATION
MONO_FONT = "Courier New"
CODE_FILL = "F4F4F4"


@dataclass
class DocInfo:
    """Identity of one document in the technical pack."""
    code: str                       # short code used in the reference, e.g. SAD
    title: str                      # e.g. "Solution Architecture"
    subtitle: str                   # one line under the title on the cover
    deliverable: str = ""           # RFP deliverable ids, e.g. "DEL-06"
    version: str = "1.0"
    status: str = "Issued with the proposal"
    keywords: str = ""
    purpose: str = ""               # one sentence for the document-control page
    related: list = field(default_factory=list)

    @property
    def reference(self) -> str:
        return f"IIFT-SV2-{self.code}"

    @property
    def file_stem(self) -> str:
        return f"SalesVerse-2.0-{self.title.replace(' & ', '-').replace(' ', '-')}"

    @property
    def header(self) -> str:
        return f"{BIDDER} | {PRODUCT} {self.title} | {CLIENT_SHORT} Agent/Banca Portal & Back-office"


PACK = [
    ("IIFT-SV2-SAD", "Solution Architecture", "DEL-06"),
    ("IIFT-SV2-DD", "Data Dictionary", "DEL-07"),
    ("IIFT-SV2-PSH", "Production Support Handover", "DEL-26, DEL-27, MNT-28"),
    ("IIFT-SV2-CSQ", "Code Standards & Quality Report", "DEL-11, NFR-14"),
    ("IIFT-SV2-SAR", "Security Assessment Report", "DEL-17, NFR-13"),
]


class TechnicalWriter(ProposalWriter):
    """ProposalWriter with a per-document running header, cover and front matter."""

    def __init__(self, info: DocInfo):
        super().__init__()
        self.info = info
        self.set_properties(f"{PRODUCT} {info.title}", f"{SOLUTION_NAME} – {info.title}", info.keywords)
        self.doc.core_properties.identifier = info.reference
        self.doc.core_properties.version = info.version
        self._configure_extra_styles()
        self.header_footer()

    # -- styles ------------------------------------------------------------------------------
    def _configure_extra_styles(self):
        styles = self.doc.styles
        for name in ("List Number",):
            style = styles[name]
            docx_kit._set_font(style.font, style.element)
            style.font.size = Pt(self.BODY_SIZE)
            style.paragraph_format.space_after = Pt(3)

    # -- running header and footer ---------------------------------------------------------------
    def header_footer(self, section=None, width_cm=None, first_page_blank=True, **_ignored):
        """Running header: small iorta logo at the left (when the asset exists), document title at the right.

        Accepts the keyword arguments the proposal kit passes from landscape_section and
        portrait_section, so later sections get a header whose right tab matches their width."""
        section = section or self.doc.sections[0]
        width_cm = width_cm or self.CONTENT_WIDTH_CM
        section.different_first_page_header_footer = first_page_blank
        section.header.is_linked_to_previous = False
        section.footer.is_linked_to_previous = False
        header = section.header.paragraphs[0]
        for run in list(header.runs):
            run._r.getparent().remove(run._r)
        header.paragraph_format.space_after = Pt(0)
        header_text = self.info.header
        if brand.IORTA_LOGO.exists():
            header.alignment = WD_ALIGN_PARAGRAPH.LEFT
            tabs = header.paragraph_format.tab_stops
            for inherited in (4680, 9360):      # centre and right tabs of the built-in Header style
                tabs.add_tab_stop(Twips(inherited), WD_TAB_ALIGNMENT.CLEAR)
            tabs.add_tab_stop(Cm(width_cm), WD_TAB_ALIGNMENT.RIGHT)
            header.add_run().add_picture(str(brand.IORTA_LOGO), height=Cm(0.55))
            header.add_run("\t")
            header_text = header_text.replace(f"{BIDDER} | ", "", 1)   # the logo already names the bidder
        else:
            header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        add_rich_text(header, header_text, size=8, colour=brand.TEXT_MUTED)
        if header._p.pPr is None or header._p.pPr.find(qn("w:pBdr")) is None:
            _paragraph_border(header, "bottom", brand.ORANGE, size=6)
        footer = section.footer.paragraphs[0]
        for run in list(footer.runs):
            run._r.getparent().remove(run._r)
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if footer._p.pPr is None or footer._p.pPr.find(qn("w:pBdr")) is None:
            _paragraph_border(footer, "top", brand.MAGENTA, size=6)
        add_rich_text(footer, f"{CLASSIFICATION} | {self.info.reference} v{self.info.version} | Page ",
                      size=8, colour=brand.TEXT_MUTED)
        add_field(footer, "PAGE", "1", size=8, colour=brand.TEXT_MUTED)
        add_rich_text(footer, " of ", size=8, colour=brand.TEXT_MUTED)
        add_field(footer, "NUMPAGES", "1", size=8, colour=brand.TEXT_MUTED)

    def landscape_section(self):
        return super().landscape_section()      # the proposal kit calls header_footer(first_page_blank=False)

    def portrait_section(self):
        return super().portrait_section()

    # -- cover -----------------------------------------------------------------------------------
    def cover(self, band_path):
        doc, info = self.doc, self.info
        top = doc.add_paragraph()
        top.paragraph_format.space_after = Pt(30)
        if brand.IORTA_LOGO.exists():
            top.add_run().add_picture(str(brand.IORTA_LOGO), height=Cm(1.6))
        else:
            add_rich_text(top, "iorta", size=26, colour=brand.MAGENTA, bold=True)
            add_rich_text(top, " TechNXT", size=26, colour=brand.TEXT_DARK)
        self.image(band_path, width_cm=17.0)
        self.spacer(16)
        self.para(f"{PRODUCT}", size=15, colour=brand.ORANGE, bold=True, space_after=4)
        self.para(info.title, size=28, colour=brand.MAGENTA, bold=True, space_after=10)
        self.para(info.subtitle, size=13, colour=brand.TEXT_DARK, space_after=6)
        self.para(f"{SOLUTION_NAME} for {CLIENT}", size=11, colour=brand.TEXT_MUTED, space_after=34)

        table = doc.add_table(rows=1, cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        logo_cell, client_cell = table.rows[0].cells
        logo_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if brand.CLIENT_LOGO.exists():
            logo_cell.paragraphs[0].add_run().add_picture(str(brand.CLIENT_LOGO), height=Cm(3.2))
        client_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        lines = [("PREPARED FOR", 9, brand.ORANGE, True), (CLIENT, 14, brand.TEXT_DARK, True),
                 ("Bandar Seri Begawan, Brunei Darussalam", 10, brand.TEXT_MUTED, False),
                 ("PREPARED BY", 9, brand.ORANGE, True), (BIDDER, 14, brand.TEXT_DARK, True),
                 (brand.BIDDER_WEBSITE, 10, brand.TEXT_MUTED, False)]
        for index, (text, size, colour, bold) in enumerate(lines):
            paragraph = client_cell.paragraphs[0] if index == 0 else client_cell.add_paragraph()
            paragraph.paragraph_format.space_after = Pt(2)
            if index == 3:
                paragraph.paragraph_format.space_before = Pt(12)
            add_rich_text(paragraph, text, size=size, colour=colour, bold=bold)
        set_column_widths(table, [3.4, 13.6])
        self.spacer(26)
        self.key_value_table([
            ("Document reference", info.reference),
            ("Version", info.version),
            ("Date", ISSUE_DATE),
            ("RFP deliverable", info.deliverable or "–"),
            ("Status", info.status),
            ("Classification", CLASSIFICATION),
        ], widths=(5.0, 12.0))
        self.spacer(12)
        self.para(f"{CLASSIFICATION}. Prepared by {BIDDER} for {CLIENT} as part of the response to IIFT's Request "
                  "for Proposal for an Agent/Banca Portal and Back-office solution. Not to be disclosed to third "
                  "parties without prior written consent.", size=8, colour=brand.TEXT_MUTED, italic=True)

    # -- front matter ------------------------------------------------------------------------------
    def document_control(self, history=None, extra_related=None):
        info = self.info
        self.h1("Document Control", numbered=False)
        if info.purpose:
            self.para(info.purpose)
        self.h3("Version history")
        self.table(["Version", "Date", "Author", "Description"],
                   history or [["0.9", "September 2026", BIDDER, "Internal technical review"],
                               [info.version, ISSUE_DATE, BIDDER, "Issued with the tender proposal"]],
                   widths=[2.0, 3.2, 3.6, 8.2])
        self.h3("Review and approval")
        self.table(["Role", "Name", "Signature / date"],
                   [["Prepared by (Solution Architect, iorta TechNXT)", "[Name]", ""],
                    ["Reviewed by (Engineering Lead, iorta TechNXT)", "[Name]", ""],
                    ["Approved by (Project Director, iorta TechNXT)", "[Name]", ""],
                    ["Accepted by (IIFT IT)", "[Name, designation]", ""]],
                   widths=[7.4, 5.0, 4.6])
        self.h3("Document pack")
        rows = []
        for reference, title, deliverable in PACK:
            status = "This document" if reference == info.reference else "Issued"
            rows.append([reference, f"{PRODUCT} {title}", deliverable, status])
        self.table(["Reference", "Document", "RFP deliverable", "Status"], rows, widths=[3.2, 7.2, 3.6, 3.0])
        related = list(info.related) + list(extra_related or [])
        if related:
            self.h3("Related material")
            self.bullets(related)
        self.h3("Conventions")
        self.bullets([
            "Monetary amounts are in Brunei dollars (B$). Times are Brunei time (UTC+8) unless marked UTC.",
            "RFP requirement identifiers (AP, BO, INT, COM, NFR, DEL, MNT) refer to IIFT's Request for Proposal. "
            "COM-01 to COM-10 in this pack are the shared platform requirements of RFP section 4.4.",
            "Items marked **delivered during implementation** are designed here but not yet present in the "
            "working application; everything else describes the application as it runs today.",
            "Option A, B and C are the commercial options of the proposal: on-premise with a perpetual licence, "
            "subscription hosted and managed by iorta on cloud, and source code handover. Prices and commercial "
            "terms are in the proposal and its pricing workbook; this pack quotes a figure only where a technical "
            "statement depends on it, and reads it from the same source as the proposal.",
            "Text in [square brackets] is to be completed with IIFT during mobilisation.",
        ])

    def table_of_contents(self):
        self.h1("Contents", numbered=False)
        self.toc()

    def table(self, headers, rows, widths, caption=None, **kwargs):
        """Branded table; group rows are kept with the row that follows them."""
        table = super().table(headers, rows, widths, caption=caption, **kwargs)
        for index, row_values in enumerate(rows, start=1):
            if isinstance(row_values, tuple) and row_values and row_values[0] == "GROUP":
                for cell in table.rows[index].cells:
                    for paragraph in cell.paragraphs:
                        paragraph.paragraph_format.keep_with_next = True
        return table

    # -- extra building blocks ---------------------------------------------------------------------
    def code(self, text, size=8):
        """Monospaced block on a light grey panel for commands and configuration."""
        table = self.doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        _no_table_borders(table)
        _cell_margins(table, top=80, bottom=80, left=140, right=140)
        cell = table.rows[0].cells[0]
        shade_cell(cell, CODE_FILL)
        docx_kit._set_cell_borders(cell, left=(18, brand.MAGENTA), top=None, bottom=None, right=None)
        for index, line in enumerate(text.strip("\n").split("\n")):
            paragraph = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.0
            run = paragraph.add_run(line if line else " ")
            run.font.size = Pt(size)
            docx_kit._set_font(run.font, run._r, MONO_FONT)
        set_column_widths(table, [self.CONTENT_WIDTH_CM])
        self.spacer(4)

    def steps(self, items, title=None):
        """Numbered procedure as a two-column table (step number, action)."""
        if title:
            self.para(title, bold=True, space_after=3, keep_with_next=True)
        rows = [[str(index), text] for index, text in enumerate(items, start=1)]
        self.table(["#", "Action"], rows, widths=[1.0, 16.0], center_cols=(0,), font_size=8.5, padding=40)

    def numbered(self, items):
        for item in items:
            paragraph = self.doc.add_paragraph(style="List Number")
            add_rich_text(paragraph, item)

    def note(self, title, lines):
        self.callout(title, lines)


# --- PDF export -------------------------------------------------------------------------------
def export_pdf(docx_path: Path, port: int = 2093) -> Path:
    """Convert to PDF with LibreOffice, refreshing the table of contents and fields first.

    Runs its own LibreOffice instance with a private profile and port so it can work
    alongside other conversions on the same machine.
    """
    import uno  # system Python module shipped with LibreOffice
    from com.sun.star.beans import PropertyValue

    def prop(name, value):
        p = PropertyValue()
        p.Name, p.Value = name, value
        return p

    pdf_path = docx_path.with_suffix(".pdf")
    profile = Path(tempfile.mkdtemp(prefix="lo-tech-"))
    office = subprocess.Popen([
        "soffice", f"-env:UserInstallation={profile.as_uri()}", "--headless", "--invisible", "--nologo",
        "--norestore", f"--accept=socket,host=localhost,port={port};urp;",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        context = None
        for _ in range(80):
            try:
                context = resolver.resolve(f"uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(0.5)
        if context is None:
            raise RuntimeError("Could not connect to LibreOffice")
        desktop = context.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", context)
        document = desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(docx_path.resolve())), "_blank", 0,
                                                (prop("Hidden", True),))
        for _ in range(2):
            indexes = document.getDocumentIndexes()
            for i in range(indexes.getCount()):
                indexes.getByIndex(i).update()
            document.getTextFields().refresh()
        document.storeToURL(uno.systemPathToFileUrl(str(pdf_path.resolve())),
                            (prop("FilterName", "writer_pdf_Export"),))
        document.close(True)
    finally:
        office.terminate()
        try:
            office.wait(timeout=30)
        except subprocess.TimeoutExpired:
            office.kill()
        subprocess.run(["rm", "-rf", str(profile)], check=False)
    return pdf_path


def pdf_pages(pdf_path: Path) -> int:
    out = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("Pages:"):
            return int(line.split()[1])
    return 0


# --- XLSX helpers -----------------------------------------------------------------------------
def xlsx_styles():
    """Common openpyxl styles matching the proposal workbook look."""
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    thin = Side(style="thin", color=brand.BORDER_GREY)
    return {
        "title": Font(name="Arial", size=14, bold=True, color=brand.MAGENTA),
        "subtitle": Font(name="Arial", size=10, color=brand.TEXT_MUTED, italic=True),
        "header_font": Font(name="Arial", size=9, bold=True, color="FFFFFF"),
        "header_fill": PatternFill("solid", fgColor=brand.MAGENTA),
        "group_fill": PatternFill("solid", fgColor=brand.GROUP_ROW),
        "zebra_fill": PatternFill("solid", fgColor=brand.ZEBRA),
        "body": Font(name="Arial", size=9, color=brand.TEXT_DARK),
        "bold": Font(name="Arial", size=9, bold=True, color=brand.TEXT_DARK),
        "link": Font(name="Arial", size=9, color=brand.MAGENTA, underline="single"),
        "wrap": Alignment(wrap_text=True, vertical="top"),
        "center": Alignment(horizontal="center", vertical="top", wrap_text=True),
        "border": Border(left=thin, right=thin, top=thin, bottom=thin),
    }


def set_workbook_properties(workbook, title, subject):
    props = workbook.properties
    props.creator = BIDDER
    props.lastModifiedBy = BIDDER
    props.title = title
    props.subject = subject
    props.company = BIDDER if hasattr(props, "company") else None
    props.category = CLASSIFICATION
    props.keywords = f"{PRODUCT}; {CLIENT_SHORT}; data dictionary"
    props.description = None


def ensure_dirs():
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    TECH_DIR.mkdir(parents=True, exist_ok=True)


def is_ci() -> bool:
    return os.environ.get("TECH_DOCS_SKIP_PDF") == "1"
