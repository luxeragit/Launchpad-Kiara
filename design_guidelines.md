# Zapera Design Guidelines

## Design Approach
**Hybrid Approach**: Crypto dashboard aesthetic drawing from platforms like Phantom, Solflare, and trading dashboards (Binance, Coinbase Pro), combined with modern design system principles for data-dense interfaces.

## Core Design Principles
- **Data Clarity**: Information hierarchy optimized for quick scanning of wallet balances, transaction data
- **Action Confidence**: Clear visual feedback for high-stakes operations (transfers, deployments)
- **Crypto Aesthetic**: Dark mode with glowing accents, technical precision, futuristic feel

## Typography
**Fonts**: 
- Primary: JetBrains Mono - terminal/hacker aesthetic throughout the entire application
- All text uses monospace fonts for a consistent crypto-terminal feel

**Hierarchy**:
- Hero/Section Headers: text-2xl to text-4xl, font-bold
- Subsections: text-lg, font-semibold
- Body: text-sm to text-base, font-normal
- Data/Numbers: text-base, font-mono for addresses/keys
- Labels: text-xs, uppercase, tracking-wide, text-gray-400

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Container padding: px-6 py-8 (mobile), px-8 py-12 (desktop)

**Grid Structure**:
- Max-width container: max-w-7xl mx-auto
- Dashboard layout: Sidebar navigation (w-64) + main content area
- Table layouts: Full-width with horizontal scroll on mobile

## Component Library

**Navigation**:
- Vertical sidebar with Zapera logo at top
- Navigation items with icon + label
- Active state: background accent with subtle glow effect
- Sections: Monitor, Deploy, Wallets

**Data Tables** (Wallet Management):
- Zebra striping for row readability
- Fixed header on scroll
- Action buttons: icon-only in compact view
- Monospace font for addresses
- Hover state reveals full address/key

**Form Elements** (Token Deploy):
- Large, touch-friendly inputs with h-12 minimum
- Clear label positioning above inputs
- Upload zones with drag-and-drop visual feedback
- Platform selector: Card-based selection with visual differentiation
- Mode toggle (Normal/Mayhem): Switch component with clear active state

**Buttons**:
- Primary actions: Solid with brand accent
- Secondary: Outline or ghost style
- Danger actions (Transfer, Burn): Red accent with confirmation
- Icon buttons: Consistent sizing (h-10 w-10)

**Cards**:
- Wallet cards: rounded-lg border with subtle shadow
- Balance display: Large numeric emphasis with SOL suffix
- Status indicators: Small badges (Active/Inactive)

**Modals/Dialogs**:
- Create/Import wallet: Centered modal with backdrop blur
- Transaction confirmations: Clear summary before execution
- Warning dialogs for private key exposure

## Visual Design

**Dark Theme Foundation**:
- Background: Very dark blue-gray (#0a0e1a to #0f1419)
- Surface: Slightly lighter (#1a1f2e to #1e2433)
- Borders: Subtle cyan/blue tint (#2a3548)

**Accent Colors**:
- Primary accent: Soft Green (HSL 150 50% 45%) - buttons, links, active states
- Secondary accent: Red #FF4444 (warnings, destructive actions)
- Success: Soft green for confirmations
- Warning: Amber for caution states

**Data Visualization**:
- Balance displays: Large, bold numbers with subtle color coding
- Status indicators: Small colored dots (green = active, gray = inactive)
- Progress indicators: Linear bars for multi-step processes

## Animations
**Minimal & Purposeful**:
- Page transitions: Fade in content (200ms)
- Balance updates: Number counting animation when refreshing
- Success feedback: Checkmark animation on transaction completion
- Loading states: Subtle spinner, never block entire interface

## Images
**Logo Integration**:
- Favicon: Provided anime character logo
- Sidebar header: Logo + "Zapera" wordmark
- Empty states: Simplified icon versions

**No Hero Images**: This is a dashboard application - prioritize immediate access to tools over marketing visuals

## Key Screens Layout

**Trade Monitor**:
- Top: SOL amount input + Auto-redirect toggle
- Middle: Wallet selection grid (checkboxes with balance preview)
- Bottom: Selected count + Execute button

**Deploy**:
- Multi-step wizard (3 steps with progress indicator)
- Platform cards: Visual differentiation between Pump.fun, Bonk.fun, Meteora
- Form fields in single column for focus

**Wallets**:
- Action toolbar: Row of icon buttons (New, Import, Refresh, etc.)
- Full-width table with columns: Label, Address, Balance, Actions
- Empty state: Clear call-to-action to create first wallet

## Accessibility
- High contrast ratios for readability
- Keyboard navigation for all actions
- Clear focus indicators with brand accent
- Confirmation dialogs for destructive actions
- Monospace fonts ensure address readability