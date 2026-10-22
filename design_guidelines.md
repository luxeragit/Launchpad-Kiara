# KiaraFun design guidelines

## Identity

KiaraFun is a dark-first, anime-branded Solana trading workstation, not a
promotional landing page or conventional SaaS dashboard. All visible copy is
concise English. The prior light-blue card-based presentation was rejected.

The canonical character is the user-supplied blonde schoolgirl with bright blue
eyes, a red ribbon, sailor uniform, and sky background. Use the original artwork,
not generated substitutes. Use it selectively for identity and onboarding.
Do not create new tokens, tickers, official social links, or financial products.

## Theme and typography

- Dark first: canvas `#0B0D12`, rail `#090A0E`, panels `#101218`/`#151820`,
  dividers `#292D36`, text `#F1F3F7`, secondary text `#929AA9`.
- Sky `#32A9FF` and ribbon coral `#FF5966` are microaccents. Market movement
  uses green `#36D99A` and negative red `#F16978`.
- Preserve optional light mode and persist explicit theme choice.
- Geist for the interface, Space Grotesk for restrained branded headings,
  IBM Plex Mono for addresses and tabular financial values. Load real fonts.
- Coral is restrained branding or a clearly labeled danger signal, not arbitrary
  decoration. No neon borders, excessive gradients, oversized blank heroes,
  decorative charts, stock anime art, or emoji.

## Structure

Keep Explore, Create, My Tokens, Wallets, and Monitor easy to reach.
Keep `/`, `/deploy`, `/deploy/:id`, `/wallets`, and `/docs` working.
Use a fixed 52–56px icon rail, a 48–52px toolbar, and a 30–34px genuine market
ticker. Desktop content fills the remaining viewport; adjacent panels scroll
independently. Mobile uses one active panel, tabs/drawers and compact bottom
navigation. No oversized headers, welcome banners, featured-card carousels,
centered maximum-width page foundations or generic card grids. Forms, dialogs,
token details, tables, and financial controls must remain usable at 375px.

## Financial clarity

Always distinguish unknown/loading/missing values from genuine zero. Do not
fabricate price movement, balances, token history, or execution states.
Show network status honestly and pause unsafe financial execution. A click or a
saved pending deployment is not a confirmed blockchain transaction.
Retain explicit review/confirmation for destructive operations and private-key
reveal/export. Never expose private keys by default or in logs/screenshots.

## Interaction and accessibility

Use semantic labels, keyboard-operable navigation, visible focus, readable
contrast, adequate touch targets, and contained dialog scrolling. Keep motion
short and respect reduced-motion preferences. No placeholder controls.

Preserve existing query keys, API payloads, cache invalidation, saved settings,
wallet authentication, and transaction logic. Never trade functional coverage
for visual simplification.

## Verification

Run TypeScript and production build. Inspect real browser screenshots across
desktop/tablet/mobile and both themes. Test interactions non-destructively.
Disclose anything not verified, especially wallet-provider and live on-chain
execution. See `docs/kiarafun-preservation.md`.
