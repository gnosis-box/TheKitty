# Demo runbook — Circles Garage

90 seconds, mobile-first, pre-loaded state, one live claim.

## Pitch (10s, oral)

> Sou-sou, tanda, hui — tontines. Hundreds of millions of people save
> together this way. Whoever runs the round holds the money. We replaced
> the organizer with a smart contract on Circles. Every round, the pot
> rotates to the next member, on-chain.

## The 90-second story arc

| t | Screen | Spoken beat |
|---|---|---|
| 0-10s | Home of The Kitty, demo tontine visible in the list with the orange "tontine" badge | "Six members. Fifty CRC each. Monthly round." |
| 10-25s | Open the kitty → detail page. TontineCard sits front and center: Round N, current claimer avatar, countdown ticking | "Round 3 of 6. Maria's turn. The pot is 300 CRC." |
| 25-40s | Rotation roster scrolls: two checkmarks past, one highlighted current, three faded upcoming | "Past payouts are already on-chain. Anyone can audit." |
| 40-70s | Tap the big primary CTA "Claim 300 CRC" → Safe sheet → sign → confirmation animation | "Maria claims her round. One transaction. The contract verifies it's her turn and rotates automatically." |
| 70-85s | Balance updates, "your turn" badge moves to the next member, countdown resets | "Next month, the rotation moves to the next member. No organizer ever held the pot." |
| 85-90s | Brief return to home, demo tontine on the list now shows the next round | "Programmable mutual aid on Circles. Done." |

## Pre-demo checklist

Run the day before. The current production factory is
`0x880E213224Ce5B6B8a01A21D4318819c67146533` on Gnosis Chain (chain id
100). The front-end is deployed at `https://thekitty.gnosis.box`.

### 1. Verify the build is current

Open `https://thekitty.gnosis.box` in a private window. Dev tools →
Sources → main bundle → search for `880E213224Ce5B6B8a01A21D4318819c67146533`
(case-insensitive). It must appear. If it doesn't, Coolify served a stale
bundle — force a rebuild with the right `VITE_KITTY_FACTORY` in **Build
environment** (not Runtime).

### 2. Seed the demo tontine

Open the app inside the playground as the *creator* Safe:

```
https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2F
```

On the home, tap **Start a tontine** (primary orange CTA — the secondary
"Or a group pot" link goes to the free-pot form, ignore it for the demo).

Form values:
- **Name**: `Demo Round`
- **Symbol**: `DEMO`
- **Members** (order = rotation order, index 0 claims round 0; use up/down
  arrows to reorder):
  1. Member A — `0x...`
  2. Member B — `0x...`
  3. Member C — `0x...`
  4. Member D — `0x...`
  5. Member E (will claim live on stage) — `0x...`
- **Round length**: `1 minute` *for live testing*, or set to your real
  demo cadence. The dropdown next to the number picks the unit
  (seconds / minutes / hours / days).
- **Per-member contribution**: `1` CRC (small, easy to reason about)
- **First claim opens in**: `0` days — the client adds a 60-second buffer
  automatically to dodge the firstClaimAt race against `block.timestamp`,
  so round 0 will be claimable about a minute after creation.

Tap **Start the tontine**, sign in the Safe sheet.

### 3. Share the invite link to each member

On the kitty detail page, tap the **share pill** in the header. It copies
or shares a link of the form:

```
https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2Fkitty%2F<governance>%2Fjoin%3Fvia%3D<creator>
```

Each member opens it in their playground, lands on `/kitty/<gov>/join`,
taps **Opt in · 1 signature**, signs `Hub.trust(group)` from their Safe.
That's the only friction they hit.

### 4. Pre-fund the pot

Each member deposits their `1 CRC` contribution. Pot balance after 5
deposits: `5 CRC` = `roundContribution × memberCount` = round payout.

Two safer routes if you don't want to coordinate 5 humans live:
- **One operator route**: do members A-D's deposits from your own Safes
  before the demo. Member E (you) is the only one whose deposit happens
  live — or even pre-deposit E and just claim live.
- **Pre-claim 0-2**: have rounds 0, 1, 2 already claimed before stage
  time so the demo starts on round 3. Every claim drains the pot, so
  **top up before each claim** to keep the pot at exactly
  `roundContribution × memberCount`. If you can't top up between rounds,
  do a fresh setup with `firstClaimDelay = 0` and demo round 0 directly.

The cleanest single-slot demo setup: 5 members deposited once, demo
shows round 0 with member A claiming live. Less narrative ("first
round!") but zero moving parts.

### 5. Verify on a phone

Open the playground link on your phone (and a backup phone if you have
one). Verify:

- App loads inside the iframe
- Connected Safe badge top right
- Home shows the seeded tontine with the **tontine** badge and
  `5 members · 1 CRC / round` detail line
- Tap into the kitty → TontineCard renders with round number,
  countdown ticking, current claimer avatar
- "your turn" badge appears when you're the current claimer
- Claim CTA enables when the countdown hits 0

## Backup plans

- **Hub lag**: occasionally `pathfinder.aboutcircles.com` and the V2 Hub
  return slowly. Keep a second tab open with the playground URL
  pre-loaded. If the first stalls, switch.
- **Wrong member signs**: contract reverts `NotYourTurn` (0x6c08c5a5). The
  UI hides the claim CTA from non-claimers, so this only happens if you
  switched Safes server-side and didn't reload. Reload + sign from the
  right Safe.
- **RoundNotReady** (0xa9ab86fa): countdown not finished yet. Wait a few
  seconds, the timer ticks every second. If the chain's `block.timestamp`
  is more than a minute behind the device clock, force a soft refresh.
- **BadTontineParams** at create time (0x60c8fda8): the 60-second
  firstClaimAt buffer should prevent this — but if it still hits, the
  device clock is drifting more than 60 seconds behind real time. Fix the
  device clock and retry.
- **Empty pot at claim time** (Hub revert): the pot didn't have
  `roundContribution × memberCount` available. Top up before clicking
  claim. The contract rolls back rotation state on failed transfer, so
  `currentRound` does NOT advance — the next try will be cleaner.

## What NOT to demo

- The free-pot mode (Or a group pot). Mention it exists as a secondary
  mode if asked; don't show it. Too many txs for 90s, and it dilutes the
  tontine pitch.
- The history tab. It's noisy and pulls attention from the claim moment.
- The deposit form. Pre-fund before stage time and stay on the claim
  story.
- Anything from the free-pot governance fields (quorum, small cap,
  voting period). In a tontine kitty the UI already hides them — but if
  the demo accidentally lands on a free pot they re-appear, which breaks
  the narrative.

## After the demo

The contract holds your `currentRound` and `nextClaimAt` state — leave
the kitty as-is to use as the live proof artifact during the Q&A. Have
the gnosisscan link to the governance contract ready in case a judge
asks "show me the code on-chain":

- Factory: https://gnosisscan.io/address/0x880E213224Ce5B6B8a01A21D4318819c67146533
- The demo kitty's governance address (note it after creation in
  step 2): https://gnosisscan.io/address/0x...
