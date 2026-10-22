# KiaraFun design guidelines

## Identity

KiaraFun is an anime-inspired Solana trading playground, not a promotional
landing page. Preserve a fast, information-dense product experience. All visible
copy is concise English.

The canonical character is the user-supplied blonde schoolgirl with bright blue
eyes, a red ribbon, sailor uniform, and sky background. Use the original artwork,
not generated substitutes. Use it selectively for identity and onboarding.
Do not create new tokens, tickers, official social links, or financial products.

## Theme and typography

- Light first: off-white canvas, white surfaces, sky-blue accents, navy text,
  subtle blue-gray borders.
- Dark mode: midnight/navy surfaces with readable blue accents; persist the
  user's explicit theme choice.
- Sora for headings and brand, DM Sans for interface copy, IBM Plex Mono for
  addresses and financial figures. Use real font assets and tabular numerals.
- Coral is restrained branding or a clearly labeled danger signal, not arbitrary
  decoration. No neon borders, excessive gradients, oversized blank heroes,
  decorative charts, stock anime art, or emoji.

## Structure

Keep Explore, Create, My Tokens, Wallets, and Monitor easy to reach.
Keep `/`, `/deploy`, `/deploy/:id`, `/wallets`, and `/docs` working.
Use compact desktop navigation and usable mobile navigation. Avoid permanent
oversized sidebars and stacked navigation bars. Forms, dialogs, token details,
tables, and financial controls must remain usable at 375px width.

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
