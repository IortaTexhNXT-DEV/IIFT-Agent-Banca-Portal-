"""Chapter order of the proposal and helpers for cross-references.

build_proposal.py renders chapters in exactly this order, and section text
uses sec("security") etc. instead of hard-coded numbers, so references stay
correct when chapters are added or moved.

The personas, journeys and screens are one chapter ("people"). Its sub-sections
are listed in PEOPLE_SECTIONS so that sec("journeys") and sec("screens") still
resolve, to "7.14"-style numbers, from the other chapters.
"""

CHAPTERS = [
    "executive_summary",
    "understanding",
    "enclosure_b",
    "enclosure_c",
    "scope",
    "fitment",
    "personas",
    "functional",
    "products",
    "architecture",
    "security",
    "deployment",
    "infrastructure",
    "techdocs",
    "methodology",
    "timeline",
    "commercials",
    "maintenance",
    "team",
    "assumptions",
    "risks",
    "validity",
    "supporting",
    "terms",
]

# Sub-sections (h2) of the personas chapter, in the order sections_people writes them.
PEOPLE_SECTIONS = [
    "overview",
    "navigation",
    "main_agent",
    "sub_agent",
    "bank_officer",
    "bank_supervisor",
    "ops_maker",
    "ops_checker",
    "underwriter",
    "finance",
    "compliance",
    "support",
    "sysadmin",
    "journeys",
    "screens",
]

ALIASES = {key: ("personas", key) for key in PEOPLE_SECTIONS}


def sec(key: str) -> str:
    """Chapter (or sub-section) number of a key, as text, e.g. "7" or "7.14"."""
    if key in CHAPTERS:
        return str(CHAPTERS.index(key) + 1)
    chapter, sub = ALIASES[key]
    return f"{sec(chapter)}.{PEOPLE_SECTIONS.index(sub) + 1}"
