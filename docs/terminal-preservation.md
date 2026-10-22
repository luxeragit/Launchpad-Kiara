# Terminal reconstruction: protected baseline and inventory

Actual implementation starting commit:
`bf407d1459952a6eb32ec997d32cfe11f5b8a246`.

The user supplied audited reference `696e038f5da33d1c165c9b67ab5d7332f46f6921`
is present in history. No reset was performed. The current working tree was
clean before reconstruction. Safety branch: `safety/kiarafun-before-terminal`.

The complete underlying feature inventory is retained in
`docs/kiarafun-preservation.md`. This rebuild replaces presentation only:

| Capability | New destination | Protected dependency |
|---|---|---|
| Feed, newest, last traded, trending, movers, filters, mint search, chart access, quick buy | Three-panel Explore and token inspector | Public Pump.fun endpoints; search; trading endpoint; managed wallets |
| Start/stop, all market-cap/social/volume filters, wallet selection, buy amount, auto-sell and exit thresholds, holdings/manual exit | Dedicated Monitor zones | Trade settings, monitoring, auto-sell and holding APIs |
| Identity, image/social fields, three platforms, normal/mayhem, funding wallet, initial buy, review and actual response | Launch workstation | Existing deployment form/payload/API and validation |
| Deployment records and navigation | My Tokens directory and inspector | Existing authenticated token records |
| Analytics/history, buy/sell, holdings, safety, allocations/claim/distribution/auto-claim, LP information/burn, activity/delete | Token trading workspace and operations tabs | All existing token, trade, fee, holding and LP routes |
| Create/import, balance/refresh, selection, archive/delete, reveal/export, transfer/fund/consolidate/cleanup, SPL burn, devnet airdrop | Wallet directory, inspector and action zones | All eleven existing wallet mutations and their dialogs |
| All documentation topics | Topic/content/reference workspace | Actual implementation guidance and API reference |
| Connection/signing/session/logout, theme, notifications, deep links, network details | Shared terminal shell | Existing authentication contracts and fail-closed network middleware |

Baseline page mutation counts: Explore/Monitor 5, Create 1, Wallets 11,
Token Dashboard 7. Splitting logic into additional components must not remove
operations; retaining names alone does not prove reachable UI coverage.

## Verification boundaries

No real trades, launches, transfers, claims, distributions, exports or burns.
No automation activation. No migrations, encryption/key changes, RPC switching,
server-route changes, user-record changes or saved-setting resets.

For an unavailable populated token record, browser-only fixtures may be used
exclusively in an isolated visual test and must be visibly labelled. Such images
are layout evidence, not evidence of live blockchain execution.

## Reference inspection

The user clarified that the prior design is the rejected design and supplied no
additional image. An actual rejected desktop capture and actual live Pump.fun
reference capture were saved under `generated-artifacts/terminal/`. The live
reference has a welcome overlay; its underlying icon rail, compact toolbar,
ticker and divided dense panels are visible. The detailed supplied geometry is
the acceptance specification. No reference branding or artwork is reused.
