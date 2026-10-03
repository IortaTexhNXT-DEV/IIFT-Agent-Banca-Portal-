"""Copies the screenshots cited by the manual test cases into docs/technical/evidence/ui-screens
as JPEG files (width 900 px) so the evidence ships with the pack.

Usage:
    SHOTS_DIR=/path/to/screenshots python3 docs/technical/build/collect_ui_evidence.py

Files already present are kept; the build of the workbook fails if a cited screen is missing.
"""

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image  # noqa: E402

from test_status import SCREENS_DIR  # noqa: E402
import test_cases_manual as manual  # noqa: E402

PROPOSAL_SCREENS = Path(__file__).resolve().parents[2] / "proposal" / "screenshots"


def main():
    sources = [Path(p) for p in os.environ.get("SHOTS_DIR", "").split(os.pathsep) if p] + [PROPOSAL_SCREENS]
    SCREENS_DIR.mkdir(parents=True, exist_ok=True)
    wanted = sorted({shot for entry in manual.MANUAL for shot in entry["shots"]})
    copied, missing = 0, []
    for name in wanted:
        target = SCREENS_DIR / (Path(name).stem + ".jpg")
        if target.exists():
            continue
        source = next((folder / name for folder in sources if (folder / name).exists()), None)
        if source is None:
            missing.append(name)
            continue
        image = Image.open(source).convert("RGB")
        if image.width > 900:
            image = image.resize((900, round(image.height * 900 / image.width)), Image.LANCZOS)
        image.save(target, "JPEG", quality=70, optimize=True)
        copied += 1
    print(f"{copied} screens copied to {SCREENS_DIR}; {len(wanted) - len(missing) - copied} already present")
    if missing:
        raise SystemExit("Missing screenshots: " + ", ".join(missing))


if __name__ == "__main__":
    main()
