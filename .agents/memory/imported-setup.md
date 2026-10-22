---
name: Imported setup boundaries
description: Scope decisions for getting the imported trading app running and package-firewall installation behavior.
---

Treat local startup verification as separate from real-fund trading readiness. Do not silently switch blockchain networks during environment setup.

**Why:** The import setup request authorized running the existing app, not changing transaction behavior. No real-wallet or real-fund transactions were verified.

**How to apply:** Explicitly distinguish preview/build checks from signed-in and on-chain verification. Obtain direction before changing the intended trading network.

An install that updates a direct dependency can still retain a blocked transitive version from the imported lockfile.

**Why:** Updating Express within its existing major version did not force its locked proxy dependency to refresh, despite a permitted patched release being available.

**How to apply:** Follow the package-firewall recovery rules; inspect the parent range and lockfile before assuming a parent update resolved the blocked dependency. Never bypass the firewall.

Do not assume every runner described by an installed skill is available in the
current runtime. If browser testing is unavailable, use an existing browser
without changing application authentication or adding production-only test data.

**Why:** The advertised testing subagent kind was rejected by this runtime;
non-destructive Chromium/CDP checks provided actual browser evidence instead.

**How to apply:** Confirm runner support, keep safe sign-in and real backend
contracts intact, and distinguish actual browser results from unverified flows.
