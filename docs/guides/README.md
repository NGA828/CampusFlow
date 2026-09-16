# CampusFlow handover guide

- **[guide.pdf](guide.pdf)** — 34-page setup, usage, handover-call and acceptance-testing guide.
- [guide.md](guide.md) — editable source, including 95 acceptance-test scenarios.

## Rebuild the PDF

From the repository root, with Python 3 installed:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r docs/guides/requirements.txt
.venv/bin/python scripts/build-guide.py
```

On Windows use `.venv\Scripts\python.exe` instead. DejaVu Sans fonts, when installed
at `/usr/share/fonts/truetype/dejavu`, are embedded for consistent typography;
otherwise the generator falls back to built-in PDF fonts. The page count can change
with fonts or content. Python dependencies are only for documentation generation,
not for running CampusFlow.

The PDF has a linked table of contents and chapter bookmarks. Review its layout
after rebuilding. Update the source baseline and verification results whenever
rechecking the guide. The manual test catalogue is a test plan, not a claim that
all application workflows passed.
