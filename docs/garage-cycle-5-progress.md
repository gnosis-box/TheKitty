# The Kitty — Cycle 5 progress note

> Submission for the **Circles Garage** weekly judging.
> Same format as cycles 1–4: what shipped · links · what's next.

## What shipped

Cycle 5 closes the loop that cycle 4 opened. Cycle 4 wired the
opt-in community pool into every payment; cycle 5 makes the pool
**trustless on-chain**, gives it a **dedicated destination in the
app**, and rewires the **two-sided economics** so providers — not
only buyers — have skin in the pool growing. Plus a `/kitty/:id`
templates layer that finally surfaces the `propose / approve /
execute` flow as a first-class action.

We rejected three options in the process and want to surface them
because the path matters as much as the outcome:

1. **Wrap-to-ERC20** for trustless custody — works but non-native.
2. **A separate `PoolGroupAvatar` + `RewardPool`** with an
   `activate()` step — works but adds a class of "forgot to
   activate" bugs.
3. **Standard `baseGroupMintPolicy`** — per-buyer trust gate that
   forces the builder to manually `Hub.trust` every buyer. Doesn't
   scale.

What we landed on instead: a **single contract that IS the pool
group avatar** (constructor calls `Hub.registerGroup` with a custom
mint policy), backed by an **OpenMintPolicy** that replaces the
per-buyer trust gate with an activity gate (BuyerActivity log),
plus a **two-sided weekly draw** that splits the pool 80% buyer /
20% provider so providers volunteer higher pool shares.

### The on-chain rewards trio

Three Sourcify-verified contracts now run the pool entirely
on-chain — no operator, no Safe-managed custody, no Sunday-evening
manual draws.

- **`BuyerActivity`** (`0x9992…5f34`) — public attestation log of
  "this Circles human has paid ≥1 service via the Kitty".
  Self-attested via `markPaid()`. Sybil-resistant by the economic
  gradient of the bundle it rides in: the markPaid call always sits
  alongside a real CRC transfer to a service provider, so attesting
  without actually paying loses CRC for nothing.
- **`OpenMintPolicy`** (`0x7D2a…f84a`) — custom `IMintPolicy` mirroring
  the Circles V2 interface, attached to the pool group. Accepts
  collateral from any Circles V2 human present in BuyerActivity.
  Replaces `baseGroupMintPolicy`'s per-buyer trust gate with a
  protocol-level humanity check + activity check.
- **`RewardPool`** (`0x4741…b584`, current) — the contract IS the
  pool group avatar (`TheKittyPool` / `TKP`). Holds incoming pool
  tokens, runs the **two-sided weekly draw** via
  `block.prevrandao`, exposes `enterWeek` / `enterProviderWeek` /
  `drawWeekly` / `claim` / `claimProvider`. Hub V2's implicit
  self-trust rule (`to == tokenAvatar`) covers the recipient gate
  for the pool token, so no separate `activate()` step.

`block.prevrandao` for randomness is hackathon-grade and we say so
in the contract NatSpec; for production we'd commit-reveal or use
VRF. At current prize sizes the manipulation cost dominates the
prize value, so it holds.

### The PaySheet pool route — eight calls, one signature

When a buyer pays a service that opted in to a community share, the
PaySheet bundles **eight transactions in a single host signature**:

```
1. Hub.trust(rewardPool, MAX)            ← first-time only, so the
                                            buyer can later receive
                                            winnings
2. Hub.trust(provider, MAX)               ← first-time only
3. Hub.safeTransferFrom buyer → provider  ← (providerCut, personal CRC)
                                            skipped when fundraiser
                                            mode (100% to pool)
4. BuyerActivity.markPaid()               ← gate the OpenMintPolicy
                                            check at step 6
5. ServiceRegistry.logPayment(...)        ← registry aggregates
6. Hub.groupMint(pool, [buyer], [cut])    ← buyer mints TKP against
                                            their perso CRC
7. Hub.safeTransferFrom buyer → pool      ← TKP flows into the pool
                                            via self-trust
8. RewardPool.enterWeek()                 ← buyer enters the buyer draw
9. RewardPool.enterProviderWeek(provider) ← provider enters the
                                            provider draw
```

Step 3 is dropped when the provider chose 100% pool share — there's
nothing to send, and the bundle saves a useless zero-amount transfer.

### Two-sided weekly draw — 80/20 split

The retention loop we shipped in cycle 4 had a hole: the provider
had **no economic stake** in the pool growing. Every basis point a
provider added to `poolShareBps` was a basis point off their
revenue. Rational behaviour: leave the slider at 0%, pool stays
empty, draws don't happen, engagement evaporates.

Cycle 5's `drawWeekly` splits the pool **two ways**:
- **80%** → random eligible buyer (the original draw)
- **20%** → random eligible provider whose service was paid this week

The 20% slice is what gives providers a direct economic stake.
They publish more services with `poolShareBps > 0`, promote them to
their circle, and pull buyers in — because growing the pool grows
their own draw value. Both sides of the marketplace become flywheel
participants, not just buyers.

When no provider entered the week's draw, the full 100% folds back
to the buyer winner. The prize never gets stuck.

### `/pool` — its own destination in the app

Cycle 4 buried the pool inside `/stats` as one of three cards.
Cycle 5 promoted it to a **dedicated route**, top-down:

- **PrizeHeadline** — live balance, side-by-side "Buyers / Providers"
  entry counts, countdown to Sunday 18:00 UTC, explainer on the
  80/20 split.
- **ViewerStatusCard** — three discriminated states: disconnected
  (open in playground), in some draw (🎟 badge naming which draws),
  in none (CTA "Pay any service to enter").
- **EntriesThisWeekCard** — two avatar stacks (amber for buyers,
  emerald for providers), each capped at 12 + "+N more". Avatars
  link to their provider profile.
- **ClaimableWinningsCard** and **ClaimableProviderWinningsCard** —
  self-hiding panels that surface a per-week Claim button only when
  the viewer has unclaimed wins on that side.
- **PastDrawsCard** — newest 5 winners, claim-state badge inline.
- **HowItWorksCard** — the protocol in 4 numbered steps.

The slimmed `/stats` page opens with a **PoolTeaser** linking to
`/pool`, so the headline balance stays visible there but the deep
dive lives on its own surface.

### `ServiceRegistry` v3 — 100% pool share cap (fundraiser mode)

We bumped `MAX_POOL_SHARE_BPS` from 2000 (20%) to 10000 (100%).
Providers can now publish a **pure-fundraiser service** that routes
the entire payment to the community pool — the slider goes all the
way to the right, the publish form shows a ⚠️ banner explaining the
provider keeps 0 CRC per sale, and the PaySheet auto-skips the
provider transfer (it would be a zero-amount move).

This unlocks two service shapes that didn't exist:
1. **Direct solidarity donations** routed through a Circles human
   acting as a relay.
2. **Community fundraisers** for shared events / infrastructure.

### Collective expense templates on `/kitty/:id/propose`

The `propose / approve / execute` flow in `KittyGovernance` was
technically complete since cycle 1 but **visually buried** behind a
blank form. Most users never reached for it because they didn't
know what to put in the fields.

Three first-class templates land at the top of the propose page:

- **🎂 Birthday gift** — prefills the memo, sets the amount to the
  kitty's small-spend cap (single-sig route), and unfolds a member
  chip picker so the user taps a celebrating member instead of
  pasting an address.
- **🍽 Group outing** — memo prefill + amount defaults to 2× the
  cap, forcing the vote path that the group's quorum actually
  decides.
- **🤝 Solidarity** — memo prefill, recipient and amount free for
  donations outside the circle.

The empty-proposals state on `/kitty/:id` detail page now teases
the templates inline: *"No active proposals. Birthday gift, group
outing, or solidarity — one tap to start."*

## Links

### Live app

- App URL: `https://thekitty.gnosis.box`
- In Circles Playground:
  `https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2F`
- Weekly pool (new top-level destination):
  `https://thekitty.gnosis.box/pool`
- Services board: `https://thekitty.gnosis.box/services`
- My services: `https://thekitty.gnosis.box/services/mine`
- Stats: `https://thekitty.gnosis.box/stats`
- About: `https://thekitty.gnosis.box/about`

### Source code

- Repo: <https://github.com/gnosis-box/TheKitty>
- README: <https://github.com/gnosis-box/TheKitty/blob/main/README.md>
- `RewardPool.sol` (fused custodian + pool group avatar):
  <https://github.com/gnosis-box/TheKitty/blob/main/contracts/src/RewardPool.sol>
- `OpenMintPolicy.sol`:
  <https://github.com/gnosis-box/TheKitty/blob/main/contracts/src/OpenMintPolicy.sol>
- `BuyerActivity.sol`:
  <https://github.com/gnosis-box/TheKitty/blob/main/contracts/src/BuyerActivity.sol>
- `PaySheet.tsx` (the 8-call pool route):
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/components/services/PaySheet.tsx>
- `pool.tsx` (the new dedicated route):
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/routes/pool.tsx>
- `kitty-propose.tsx` (templates):
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/routes/kitty-propose.tsx>

### Upstream contribution

- **PR open**: `aboutcircles/sdk#52` — *MiniappRunner: ContractRunner
  for the Circles miniapps iframe host*. Awaiting review since
  cycle 3. <https://github.com/aboutcircles/sdk/pull/52>

### Deployed contracts (Gnosis Chain, chain id 100)

| Contract | Address | Notes |
|---|---|---|
| **ServiceRegistry v3** (current) | [`0x295Fe49F2b00dd3aF05Bc245b2dFADbEB9c3F35f`](https://gnosisscan.io/address/0x295Fe49F2b00dd3aF05Bc245b2dFADbEB9c3F35f) | Sourcify exact_match · `MAX_POOL_SHARE_BPS` = 100% (fundraiser mode) |
| **RewardPool v2** (current, two-sided draw) | [`0x4741561247a8f87daA1E8354a17B350c8053b584`](https://gnosisscan.io/address/0x4741561247a8f87daA1E8354a17B350c8053b584) | Sourcify exact_match · IS the pool group avatar `TheKittyPool` / `TKP` · 80% buyer + 20% provider |
| **OpenMintPolicy** | [`0x7D2a0C97324876F327281BBffFfE076Eaf3af84a`](https://gnosisscan.io/address/0x7D2a0C97324876F327281BBffFfE076Eaf3af84a) | Sourcify exact_match · activity-gated `IMintPolicy` |
| **BuyerActivity** | [`0x99921C234d4Ca518DC58ba63ff9bfD2Cc9435f34`](https://gnosisscan.io/address/0x99921C234d4Ca518DC58ba63ff9bfD2Cc9435f34) | Sourcify exact_match · public attestation log |
| RewardPool v1 (legacy) | [`0x57CA75a98aC06De9708e29f239600eEC47Ca9888`](https://gnosisscan.io/address/0x57CA75a98aC06De9708e29f239600eEC47Ca9888) | Buyer-only draw, replaced by v2 |
| ServiceRegistry v2 (legacy) | [`0x4E20279EeE9f77673A4f1605E58607cD9A597d70`](https://gnosisscan.io/address/0x4E20279EeE9f77673A4f1605E58607cD9A597d70) | 20% cap, replaced by v3 |
| ServiceRegistry v1 (legacy) | [`0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`](https://gnosisscan.io/address/0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c) | Cycle 3 catalog |
| KittyFactory v3 (current) | [`0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`](https://gnosisscan.io/address/0xa6f38d8613F8612Fcfdf89707B479ea4ef554439) | Sourcify-verified · stake mode + slash |
| Circles V2 Hub | [`0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8) | Aboutcircles |

### Tests & audit

- **173 Foundry tests** passing (112 from cycle 4 + 11 new for the
  rewards trio's two-sided draw + 50 across BuyerActivity /
  OpenMintPolicy / RewardPool).
- Free-pot kitty core under Trail of Bits audit; v3 of
  ServiceRegistry is a pure constant bump (storage layout untouched)
  so the post-audit posture for the audited core is preserved.
- 3 Gnosis fork tests against real chain state still pass.

## Why this beats the lending narrative — sharpened

The lending miniapp routes CRC through Aave to surface an APY. The
yield is real but extracted by the protocol; Circles users don't
even get to redeem to fiat at the human level.

Our cycle 5 architecture takes the opposite stance and now has the
data to show it:
- **No protocol extracts the gain.** 100% of pool inflow stays in
  the trust circle.
- **Provider AND buyer both win.** Cycle 4's design had providers as
  net contributors to the pool with no upside; cycle 5's 80/20 split
  fixes that.
- **A `100%` slider exists.** Fundraisers for community events run
  through the same machinery as paid services — same trust graph,
  same wallet, same UI.
- **It's all on-chain.** No Safe operator, no manual draws, no
  off-chain custody. `drawWeekly` is a public function and the
  randomness is on-chain too.

## What's next — cycle 6 candidates

Three directions, ranked by leverage on the Garage criteria:

1. **Streak bonuses** — buyers/providers active 3 weeks in a row get
   a draw-ticket multiplier next week. Pure on-chain logic (streak
   counter in `RewardPool`), no UI hike. Doubles down on the
   weekly-rhythm engagement the pool already creates.
2. **Calendar / RDV for slot-based services** — many of the
   service shapes we want to encourage (guitar lessons, brunches,
   freelance sessions) need a time slot to be useful. A simple
   slot-picker on the service detail page + an on-chain
   `bookings[serviceId][slot]` mapping makes those services real
   instead of theoretical.
3. **VRF instead of `block.prevrandao`** — the manipulation surface
   only opens once prize sizes get interesting. Worth wiring before
   then rather than after.

## Mini-app submission status

- App is live, all R5/R6 contracts Sourcify-verified.
- README and CLAUDE.md kept current with deployed addresses + flows.
- Submission entry for `aboutcircles/CirclesMiniapps/static/miniapps.json`
  unchanged from cycle 4 — manifest unchanged across cycle 5.
