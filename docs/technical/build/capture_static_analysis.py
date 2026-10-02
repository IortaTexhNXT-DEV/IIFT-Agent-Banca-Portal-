"""Capture static-analysis evidence for the SalesVerse 2.0 API.

Runs the same lint, type-check and formatting commands as the CI pipeline and
writes the outcome to docs/technical/evidence/api-static-analysis.json, which
the code standards and quality report reads at build time.

Usage (from the repository root, after `npm ci`):
    python3 docs/technical/build/capture_static_analysis.py
"""

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "docs" / "technical" / "evidence" / "api-static-analysis.json"

CHECKS = [
    ("Lint", "oxlint", ["npx", "oxlint", "src", "test"], ROOT / "apps" / "api", ["npx", "oxlint", "--version"]),
    ("Type check", "TypeScript compiler", ["npx", "tsc", "--noEmit", "-p", "tsconfig.json"], ROOT / "apps" / "api",
     ["npx", "tsc", "--version"]),
    ("Formatting", "Prettier",
     ["npx", "prettier", "--check", "apps/api/src/**/*.ts", "apps/api/test/**/*.ts", "apps/api/prisma/**/*.ts"],
     ROOT, ["npx", "prettier", "--version"]),
]


def run(command, cwd):
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=600)
    return completed.returncode, (completed.stdout + completed.stderr).strip()


def count(pattern, text):
    match = re.search(pattern, text)
    return int(match.group(1)) if match else 0


def main():
    results = []
    for name, tool, command, cwd, version_command in CHECKS:
        exit_code, output = run(command, cwd)
        _, version = run(version_command, cwd)
        if tool == "TypeScript compiler":
            errors = len(re.findall(r"error TS\d+", output))
        elif tool == "Prettier":
            errors = len([line for line in output.splitlines() if line.startswith("[warn]") and "Code style" not in line])
        else:
            errors = count(r"(\d+) errors?", output)
        results.append({
            "check": name,
            "tool": tool,
            "version": version.splitlines()[-1].replace("Version: ", "").replace("Version ", "").strip() if version else "",
            "command": " ".join(command),
            "exitCode": exit_code,
            "errors": errors,
            "warnings": count(r"(\d+) warnings?", output),
            "passed": exit_code == 0,
        })
    EVIDENCE.write_text(json.dumps({"runAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                    "results": results}, indent=2) + "\n")
    print(f"Wrote {EVIDENCE}")


if __name__ == "__main__":
    main()
