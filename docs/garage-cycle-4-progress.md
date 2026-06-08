# The Kitty — Cycle 4 progress note

> Submission for the **Circles Garage** weekly judging.
> Same format as cycles 1–3: what shipped · links · what's next.

## What shipped

Cycle 4 turns the kitty's services board into a **two-sided rewards
network**: every payment carries an opt-in slice from the provider into
a community pool, the pool funds weekly rewards back into the network,
and the social mechanics around it (streaks, referrals, actionable
nudges) give people a reason to open the app on a Tuesday — not only
when they need to pay something specific.

We rejected the obvious move (wrap CRC into Aave for yield, the angle
the current Garage frontrunner uses): it makes us a copy on their
terms and contradicts what Circles is actually for — circulation
between humans you trust, not protocol-extracted yield. Instead we
built the smallest economic primitive that still creates pull: a 1%
default fee, declared by the provider at publish, that funds rewards
for the same humans who pay each other.

### The fee mechanism — opt-in, provider-driven

A new `ServiceRegistry` v2 contract adds one field to `Service`:
`poolShareBps` (uint16, 0..MAX_POOL_SHARE_BPS = 2000 = 20%). The
provider chooses it via a slider in the publish form (default 1%).
The buyer sees only the headline price; the PaySheet computes the
split and bundles **two** `Hub.safeTransferFrom` calls in the same
host signature — one to the provider for `priceCrc × (1 −
poolShareBps/10000)`, one to the community pool Safe for the rest.
`logPayment` still records the full headline amount so aggregate
counters reflect what the buyer paid, not the provider's net cut.

Net result: zero buyer friction, opt-in generosity becomes a visible
signal (`✨ X%` badge on every card and detail page), and the pool grows
proportionally to actual activity.

### The pool and the weekly draw

The pool address is a dedicated Safe on Gnosis (single owner, will
migrate to an on-chain `RewardPool.sol` contract in cycle 5). A
`PrizePoolCard` on `/stats` surfaces:
- the pool's Safe address with a direct gnosisscan link to view its
  on-chain balance
- a live countdown to the next draw (Sunday 18:00 UTC, automatically
  recomputed each visit)
- eligibility rule: any human who paid ≥1 service between Monday 00h
  UTC and Sunday 23h59 UTC is in the draw

Manual draw V1 (builder picks a random eligible buyer each Sunday and
sends from the Safe). The on-chain `block.prevrandao` automation lands
in Republish 4.

### Social mechanics that drive recurrence

Three smaller pieces ship alongside the pool to give the app a daily
heartbeat, not just a "I have a bill to pay" surface:

1. **Provider streak badge** — `🔥 N weeks active` on the provider
   profile, computed from `ServicePaid` events bucketed by ISO week
   (Mon→Sun UTC). Resets on a dry week, shows a `break-the-streak
   this week` hint when the current week has no payment yet. Pure
   visibility — pressure to keep showing up.
2. **Burger badge for actionable items** — red dot on the navigation
   icon when the viewer has ≥1 service paid but never rated. One
   signal, but it's the cheapest "you have something to do" pull.
3. **Referral hint on the inviter banner** — when a viewer landed via
   `?via=<inviter>`, the banner now announces *"Your first publish or
   pay drops a referral reward (5 CRC each) into the next weekly draw —
   for both you and your inviter."* Pool-funded; the actual payout is
   manual in V1, automated in cycle 5.

### Republish 1 (earlier this cycle)

Also shipped in cycle 4 before the rewards architecture:

- **Tip the builder** on `/about` (🙏 10 / ☕ 100 / 🍕 500 CRC, bundled
  trust + safeTransferFrom from the viewer's wallet) — parallels what
  the Yield miniapp does on `/about`, but stays inside the trust
  circle.
- **Active counters band** on `/services` — one line summary of the
  current state of the registry: active count, providers, lifetime
  CRC circulated, payments logged.
- **Recently paid feed** — last five `ServicePaid` events network-wide,
  rendered as a compact strip of clickable rows leading to each
  service's detail page. Fresh content every visit.
- **Top providers leaderboard** on `/stats` — ranked by lifetime CRC
  received with unique-buyer counts. Public reputation building.

All live on Gnosis Chain mainnet.

## Links

### Live app

- App URL: `https://thekitty.gnosis.box`
- In Circles Playground:
  `https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2F`
- Services board: `https://thekitty.gnosis.box/services`
- My services: `https://thekitty.gnosis.box/services/mine`
- Funding: `https://thekitty.gnosis.box/funding`
- Stats (prize pool card + leaderboard): `https://thekitty.gnosis.box/stats`
- About (tip the builder): `https://thekitty.gnosis.box/about`

### Source code

- Repo: <https://github.com/gnosis-box/TheKitty>
- README: <https://github.com/gnosis-box/TheKitty/blob/main/README.md>
- `ServiceRegistry.sol` (v2 with poolShareBps):
  <https://github.com/gnosis-box/TheKitty/blob/main/contracts/src/ServiceRegistry.sol>
- `PaySheet.tsx` (the bundled split):
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/components/services/PaySheet.tsx>
- `services-reader.ts` (streak + recently paid + leaderboard readers):
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/lib/services-reader.ts>

### Upstream contribution

- **PR open**: `aboutcircles/sdk#52` — *MiniappRunner: ContractRunner
  for the Circles miniapps iframe host*. Adds the
  `MiniappRunner` + `MiniappBatchRun` classes to `@aboutcircles/sdk-runner`,
  aligned with the existing `SafeBrowserRunner` shape (static `create()`
  factory, `RunnerError` patterns, viem `TransactionReceipt` returns).
  In production use in The Kitty since cycle 3.
  <https://github.com/aboutcircles/sdk/pull/52>

### Deployed contracts (Gnosis Chain, chain id 100)

| Contract | Address | Notes |
|---|---|---|
| **ServiceRegistry v2** (current) | [`0x4E20279EeE9f77673A4f1605E58607cD9A597d70`](https://gnosisscan.io/address/0x4E20279EeE9f77673A4f1605E58607cD9A597d70) | Sourcify exact_match · adds `poolShareBps` per service (0–20% opt-in cut to the community pool) |
| **Community Pool Safe** (current) | [`0x5A1773A01E403376c76B31dF63DF8D79dFDE8F11`](https://gnosisscan.io/address/0x5A1773A01E403376c76B31dF63DF8D79dFDE8F11) | Receives the `poolShareBps` cut from every payment; funds the weekly draw. Will be replaced by `RewardPool.sol` contract in cycle 5 |
| ServiceRegistry v1 (legacy) | [`0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`](https://gnosisscan.io/address/0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c) | Cycle 3 catalog. Read-only since the v2 deploy; no data migration |
| KittyFactory v3 (current) | [`0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`](https://gnosisscan.io/address/0xa6f38d8613F8612Fcfdf89707B479ea4ef554439) | Sourcify-verified · stake mode + slash, from cycle 2 |
| KittyFactory v2 (legacy) | [`0x880E213224Ce5B6B8a01A21D4318819c67146533`](https://gnosisscan.io/address/0x880E213224Ce5B6B8a01A21D4318819c67146533) | First tontine release |
| KittyFactory v1 (legacy) | [`0x21539cb2b5a80C88a0D05E631662972589bD010A`](https://gnosisscan.io/address/0x21539cb2b5a80C88a0D05E631662972589bD010A) | Trail-of-Bits-audited free-pot core |
| Circles V2 Hub (Aboutcircles) | [`0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8) | |
| BaseGroupFactory (Aboutcircles) | [`0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d`](https://gnosisscan.io/address/0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d) | |

### Tests & audit

- **112 Foundry tests** passing (105 from cycle 3 + 7 new for the
  `poolShareBps` field and the `MAX_POOL_SHARE_BPS` cap, including a
  fuzz test on bounds).
- Free-pot kitty core still under Trail of Bits audit; v2 of the
  ServiceRegistry is a pure-additive extension of v1 (single new field,
  same storage layout for the rest) so the post-audit posture is
  preserved.
- 3 Gnosis fork tests against real chain state still pass.

## Why this beats the lending narrative

> *A single 1% fee creates a pool the trust circle owns. The pool funds
> a weekly draw between paying humans, plus referral rewards for
> growing the network, plus tip cascades for spreading CRC further
> still. No yield, no Aave, no protocol extracts the gain. The reward
> for paying each other is paying each other better.*

The lending miniapp wraps CRC into Aave and surfaces an APY. We don't
play that game — Circles has demurrage by design, and no real CRC↔fiat
off-ramp at the human level. Our edge is the **only protocol with a
real human-verified trust graph**, and cycle 4 wires it into a
small-scale, opt-in, self-funded rewards economy.

## What's next

Three Republish 5 candidates, ranked by leverage on the Garage criteria:

1. **`RewardPool.sol` + on-chain draw** — replace the Safe-managed pool
   with a contract that receives deposits, indexes weekly eligibility
   from on-chain events, and runs the Sunday draw with
   `block.prevrandao`. Fully trustless; the builder stops being the
   operator. Pairs with the **trust expansion bonus** and the **CRC
   side of tip cascade** (V1 only shipped the badge layer).

2. **Trust-graph-as-recommender** — the *"providers your trusts paid
   for"* discovery layer that we deferred when we pivoted to rewards
   in cycle 4. Surfaces providers the viewer doesn't yet trust but at
   least one of their trusts has paid. Composes with the existing
   `<TrustButton>` for one-tap onboarding to new providers. The
   discovery and rewards systems reinforce each other.

3. **Collective expense templates** — promote the existing
   `propose / approve / execute` flow in `KittyGovernance` to a
   first-class action on `/kitty/:id` with templates (birthday gift,
   group outing, solidarity contribution). The group pot becomes a
   concrete coordination tool, not a savings primitive that nobody
   reaches for.
