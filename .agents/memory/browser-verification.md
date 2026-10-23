---
name: Browser verification runtime
description: Container-specific Chromium choice for actual browser checks.
---

Prefer the installed Playwright Chromium discovered in the Nix store, not the
generic tools Chromium wrapper. Do not depend on Screenshot's temporary browser
process being active to discover that binary.

**Why:** The tools browser exposed CDP and accepted navigation but left an empty,
complete document without runtime exceptions. The app, public API and screenshot
browser worked normally; the installed Playwright browser passed the same tests.

**How to apply:** Discover a compatible installed binary, check navigation errors,
and inspect document/runtime diagnostics before interpreting a blank CDP page as
an app regression. Do not install a new browser or weaken app/auth checks merely
to work around this environment issue.
