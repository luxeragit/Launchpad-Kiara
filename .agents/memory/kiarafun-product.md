---
name: KiaraFun product boundaries
description: User-stated identity, functionality-preservation, and real-fund safety requirements for this product.
---

The product is **KiaraFun**, with concise English copy. Use the supplied original
blonde anime character with blue eyes, a red ribbon, sailor uniform, and blue sky.
Do not generate replacement characters, create a brand token/ticker, or invent
official social destinations.

**Why:** The user explicitly established this canonical brand identity and
required the actual supplied illustration rather than a substitute.

**How to apply:** Treat the character as a controlled brand asset. Remove legacy
active branding, but preserve historical identifiers/data and compatibility.

Redesign the existing product in place, preserving every real feature and saved
setting. Do not rewrite the backend, replace wallets, migrate the stack, run
destructive migrations, change encryption secrets/formats, or silently change
RPCs, program addresses, signing, routing, fees, or deployment destinations.

**Why:** The user treats functionality and financial correctness as more
important than visual polish.

**How to apply:** Use non-destructive regression checks. Do not execute trades,
deployments, transfers, claims, or burns during UI testing. Clearly disclose
unverified live transaction paths and unsupported capability boundaries.

Production trading is intended for Solana Mainnet, but network changes and
real-money execution require explicit approval after verification. If network
configuration is ambiguous, show the actual status and block unsafe execution
without erasing saved settings.

**Why:** The user explicitly prohibited mixing Devnet wallet information with
Mainnet trading services and prohibited silent endpoint changes.

**How to apply:** Never enable transactions just to make a UI test pass; use
read-only network verification and keep stop controls accessible.

The user rejected the light-blue SaaS/dashboard composition. Reconstruct the
presentation as a dark-first trading terminal, not incremental card restyling:
a narrow fixed icon rail, compact toolbar and real-data ticker, adjacent
independently scrolling market panels, dense token rows, and purpose-built
workspaces for every major route. Retain optional light mode and original Kiara.

**Why:** The user explicitly rejected the prior implementation despite passing
technical tests; it preserved the wrong page architecture.

**How to apply:** Treat the user's Pump.fun screenshot as the spatial and
interaction acceptance reference, not branding to copy. Study supplied comparison
screenshots when available; the user clarified that the rejected interface means
the prior design, which can be captured from the app. Verify actual geometry and density in
new browser screenshots; builds and a recolored dashboard do not meet acceptance.

The MARKET strip must run horizontally rather than remain static; keep its label
fixed while the real token feed scrolls.

**Why:** The user explicitly corrected the static market strip.

**How to apply:** Preserve continuous ticker motion across shared-header routes,
with a pause control and an accessible reduced-motion alternative.
