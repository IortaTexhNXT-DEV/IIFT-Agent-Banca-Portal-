"""Brand constants and shared paths for the IIFT proposal build scripts."""

from pathlib import Path

# --- Paths -----------------------------------------------------------------
BUILD_DIR = Path(__file__).resolve().parent
PROPOSAL_DIR = BUILD_DIR.parent
ASSETS_DIR = PROPOSAL_DIR / "assets"
SCREENSHOT_DIR = PROPOSAL_DIR / "screenshots"

IORTA_LOGO = ASSETS_DIR / "iorta-logo.png"
CLIENT_LOGO = ASSETS_DIR / "iift-logo.png"

DOCX_OUTPUT = PROPOSAL_DIR / "IIFT-Agent-Banca-Portal-Proposal-iorta-TechNXT.docx"
XLSX_OUTPUT = PROPOSAL_DIR / "IIFT-Commercial-Pricing-iorta-TechNXT.xlsx"
BOM_OUTPUT = PROPOSAL_DIR / "IIFT-Bill-of-Materials-iorta-TechNXT.xlsx"

# --- Document identity -----------------------------------------------------
BIDDER = "iorta TechNXT"
BIDDER_WEBSITE = "https://iortatechnxt.com"
CLIENT = "Insurans Islam Family Takaful Sendirian Berhad"
CLIENT_SHORT = "IIFT"
PRODUCT = "SalesVerse 2.0"
SOLUTION_NAME = "IIFT Agent/Banca Portal & Back-office"
PROPOSAL_TITLE = "Proposal for Agent/Banca Portal & Back-office Solution"
HEADER_TEXT = "iorta TechNXT | Proposal – IIFT Agent/Banca Portal & Back-office"
CLASSIFICATION = "Commercial-in-Confidence"
SUBMISSION_DATE = "October 2026"
DOCUMENT_VERSION = "1.0"

# --- Colours (hex without '#') ---------------------------------------------
MAGENTA = "E1058C"
ORANGE = "F58220"
TEXT_DARK = "333333"
TEXT_MUTED = "6B6B6B"
WHITE = "FFFFFF"
ZEBRA = "FDF0F7"          # very light magenta tint for alternate rows
GROUP_ROW = "FEEBDD"      # light orange tint for group/sub-header rows
BORDER_GREY = "D0D0D0"
CALLOUT_FILL = "FFF4EC"
PLACEHOLDER_GREY = "E6E6E6"


def rgb(hex_code: str) -> tuple:
    """Convert 'RRGGBB' to an (r, g, b) tuple."""
    return tuple(int(hex_code[i:i + 2], 16) for i in (0, 2, 4))


# --- Fonts -------------------------------------------------------------------
BODY_FONT = "Arial"
FONT_DIR = Path("/usr/share/fonts/truetype/liberation")
DIAGRAM_FONT_REGULAR = FONT_DIR / "LiberationSans-Regular.ttf"
DIAGRAM_FONT_BOLD = FONT_DIR / "LiberationSans-Bold.ttf"
