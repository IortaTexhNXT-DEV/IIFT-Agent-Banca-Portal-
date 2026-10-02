"""Chapter order of the proposal and helpers for cross-references.

build_proposal.py renders chapters in exactly this order, and section text
uses sec("security") etc. instead of hard-coded numbers, so references stay
correct when chapters are added or moved.
"""

CHAPTERS = [
    "executive_summary",
    "understanding",
    "enclosure_b",
    "enclosure_c",
    "scope",
    "fitment",
    "personas",
    "journeys",
    "functional",
    "products",
    "screens",
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


def sec(key: str) -> str:
    """Chapter number of a chapter key, as text."""
    return str(CHAPTERS.index(key) + 1)
