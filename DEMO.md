# Demo runbook — Circles Garage

90 seconds, single-screen, pre-loaded state, live final act.

## Pitch beat (oral, 10s)

> Tontines and sou-sou are how a billion people save together. The Kitty
> makes the rotation a smart contract: every round, one Circles human
> takes the whole pot. No organizer, no rug.

## The story arc (90s)

| t | What's on screen | What you say |
|---|---|---|
| 0-10s | Home, the demo kitty visible | "Five neighbours, fifty CRC each, monthly round." |
| 10-25s | Open kitty-detail, tontine card front and center | "Round 3 of 5. Maria's turn. The pot is 250 CRC." |
| 25-40s | Rotation roster: 2 checkmarks, 1 highlighted, 2 upcoming | "Past rounds already paid out on-chain. Anyone can audit." |
| 40-70s | Big "Claim 250 CRC" CTA — sign the Safe tx live | "Maria claims. One transaction, the contract enforces it's her turn." |
| 70-85s | Confirmation, balance updates, next claimer highlighted | "Next month, the contract rotates to the next member." |
| 85-90s | Brief return to home | "Programmable mutual aid on Circles. Done." |

## Pre-demo checklist (run the day before)

### 1. Deploy the new factory

The contract changed (tontine extension). Old factory `0x21539cb2b5a80C88a0D05E631662972589bD010A` doesn't know `claimRound`.

```bash
cd contracts
# Make sure .env has PRIVATE_KEY, GNOSIS_RPC, HUB_ADDRESS, BASE_GROUP_FACTORY
forge script script/Deploy.s.sol \
  --rpc-url $GNOSIS_RPC \
  --broadcast \
  --verify
```

Copy the new factory address into `apps/web/.env.local`:

```
VITE_KITTY_FACTORY=0x<new-factory-address>
```

Then redeploy the front-end (Coolify or `bun build && vite preview`).

### 2. Create the demo kitty

Open the app inside the Circles playground as the *creator* Safe.

- **Mode**: Rotating tontine
- **Name**: `Demo Round`
- **Symbol**: `DEMO`
- **Members** (in rotation order — index 0 claims round 0):
  1. Member A — `0x...`
  2. Member B — `0x...`
  3. Member C — `0x...`
  4. Member D — `0x...`
  5. Member E (will claim live) — `0x...`
- **Quorum**: 51% (irrelevant for the tontine path but the contract requires it)
- **Small spend cap**: `5` CRC
- **Voting period**: `24` hours
- **Round length**: `30` days
- **Per-member contribution**: `50` CRC
- **First claim opens in**: pick a value such that **round 3 opens roughly during your slot** if you let rounds 0-2 advance, OR set it to **0** and manually advance the clock by claiming as members A→B→C before the demo.

For a single-slot demo, the cleaner play is:
- Set first-claim delay to `0`
- Have members A, B, C each `claimRound` from their Safe in advance
- On demo day, the kitty is already at round 3, member D's turn
- ⚠️ Don't claim as D yet — that's your live act.

### 3. Pre-fund the pot

Each of the 5 members deposits their contribution:

- Open the kitty → Deposit
- Amount: `50` CRC
- Sign

Pot balance after 5 deposits: `250 CRC`. Each claim drains `250 CRC` and the next member's turn opens 30 days later (so in practice, the pre-claimed rounds in step 2 already drained the pot; you'll need to **top up** before the live demo so member D's claim has 250 CRC available).

Safer pre-demo state: keep all 5 deposits intact and DON'T pre-claim. Set first-claim delay to `0` and the live demo shows round 0 (member A's turn). Less narrative arc, fewer moving parts.

### 4. Test the playground link

```
https://circles.gnosis.io/playground?url=<your-deploy-url>
```

Open on a phone. Verify:
- Wallet detected, address badge top right
- Home shows the demo kitty
- Detail page shows the tontine card with the right round number
- "Your turn" badge appears when the viewing Safe is the current claimer
- Countdown stops at 0 if `nextClaimAt` is in the past

## Backup plans

- **Tx hangs**: hub.aboutcircles.com sometimes lags. Keep a second tab open with the playground URL and the demo kitty pre-loaded; if the first tab gets stuck, switch.
- **Wrong member tries to claim**: contract reverts `NotYourTurn`. The UI hides the CTA from non-claimers but if you mis-signed from the wrong Safe, the tx fails fast. No state corruption.
- **Round not ready**: contract reverts `RoundNotReady`. Means `block.timestamp < nextClaimAt`. Fix by setting `firstClaimAt` to now (chain time may drift from local time by a few seconds at round boundaries).
- **No CRC in the pot**: contract calls `Hub.safeTransferFrom` which reverts on insufficient balance. Always pre-fund.

## What NOT to demo

- The free-pot mode (propose/approve/execute). Mention it exists; don't show it. Too many txs.
- The history tab. Visually busy, distracts from the round claim.
- The deposit flow. Too many signatures.
- Anything around demurrage delta — the placeholder is intentionally cosmetic.
