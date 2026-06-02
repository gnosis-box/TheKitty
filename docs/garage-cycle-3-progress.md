# The Kitty — Cycle 3 progress note

> Submission for the **Circles Garage** weekly judging.
> Same format as cycles 1–2: what shipped · links · what's next.

## What shipped

Cycle 3 turns the kitty from a single-purpose savings primitive into a
working two-sided economy. The big addition is the **services board**:
a singleton `ServiceRegistry` contract that lets any Circles human
publish what they offer in CRC (a haircut, a guitar lesson, a brunch),
and any other human pay them in a single host signature that bundles
trust + transfer + on-chain logging.

The contract holds **no funds** — the actual CRC moves through
`Hub.safeTransferFrom` between the buyer's and provider's Circles
avatars. The registry only owns the catalog metadata, the payment
aggregates (count, total CRC, rating), and the per-rater 1–5 star
slot. That keeps the trust assumption flat: the buyer trusts the
provider on Hub V2 (one tap, bundled with the payment), the registry
just records what happened.

### Pay flow in one signature

The pay sheet bundles **up to three calldata items** in one
`sendTransactions`:

1. `Hub.trust(provider, type(uint96).max)` — only if the buyer doesn't
   trust the provider yet.
2. `Hub.safeTransferFrom(buyer, provider, buyerTokenId, priceCrc, "0x")`
   — the actual CRC transfer, ERC-1155 over the buyer's personal avatar.
3. `ServiceRegistry.logPayment(serviceId, amount, memo)` — bumps the
   aggregates and records the optional memo (256-char cap, used for
   "Sat 14h" / "mat haircut" style notes on calendar-shaped services).

Right after a successful pay, the sheet transitions to "How was it?"
with five tap-to-rate stars; tapping fires `rate(serviceId, stars)` as
a separate signature. Re-rating overwrites the previous slot per rater,
so the average stays accurate without anonymous spam.

### SDK-native posture

To get there we replaced our hand-rolled Hub V2 calldata with the
typed wrappers shipped in `@aboutcircles/sdk-core`. The blocker was
that the SDK is designed around a `ContractRunner`, but the only
runners it ships are `SafeBrowserRunner` / `SafeContractRunner`, both
of which assume direct `window.ethereum` access — useless inside the
Circles miniapp iframe. We built a small **`MiniappRunner`** that
implements the `ContractRunner` interface against
`@aboutcircles/miniapp-sdk`'s `sendTransactions` (writes) plus a viem
`publicClient` (reads), wired it into the React `WalletProvider`, and
swapped every Hub V2 op in `tx-builders.ts` over to `core.hubV2.*`.
Only our own contracts (`KittyGovernance`, `ServiceRegistry`) still
use raw viem `encodeFunctionData` — everything Circles-side now flows
through the SDK. The runner is in-tree for this cycle; we'll PR it
upstream to `aboutcircles/sdk-runner` once it's seen production.

### The rest

- **`/services/:id` detail page** — provider chip, rating breakdown,
  payment counters, the provider's other active services, Web Share
  → clipboard fallback. Deep-linkable URLs.
- **`/services/mine` management** — list of every service the viewer
  has published (active + inactive) with Edit and Deactivate actions
  and a "Last: …" receipt line showing the most recent payment per
  service (avatar + amount + memo, sourced from `ServicePaid` logs).
- **`/services/:id/edit`** — pre-filled form, provider-only.
- **Burger drawer + nav shell** — left slide-in with the viewer chip,
  active-route highlight (longest-match wins so `/services/mine`
  doesn't also light up Services), and an internal footer. Replaces
  the discreet legal-mention footer that nobody perceived as
  navigation.
- **Search + sort on `/services`** — text filter on title/description,
  sort by Newest / Cheapest / Most paid / Highest rated, client-side.
- **`/stats` covers both halves** — a Services board card (active
  count, distinct providers, payments logged, CRC paid) sits above
  the existing Funding side card.
- **Bundle split** — Vite `manualChunks` for `@aboutcircles/*`, viem,
  React. Cold load streams them in parallel; the app chunk drops to
  ~100 kB.
- **C2 hero copy + brand sweep** — *"Build a working economy with
  people you trust"* across index.html, README, About, social card
  (regenerated with the punchline overlay).

All live on Gnosis Chain mainnet.

## Links

### Live app

- App URL: `https://thekitty.gnosis.box`
- In Circles Playground:
  `https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2F`
- Services board: `https://thekitty.gnosis.box/services`
- My services: `https://thekitty.gnosis.box/services/mine`
- Funding: `https://thekitty.gnosis.box/funding`
- About: `https://thekitty.gnosis.box/about`
- Stats: `https://thekitty.gnosis.box/stats`

### Source code

- Repo: <https://github.com/gnosis-box/TheKitty>
- README: <https://github.com/gnosis-box/TheKitty/blob/main/README.md>
- `ServiceRegistry.sol`:
  <https://github.com/gnosis-box/TheKitty/blob/main/contracts/src/ServiceRegistry.sol>
- `MiniappRunner.ts`:
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/lib/miniapp-runner.ts>
- `PaySheet.tsx`:
  <https://github.com/gnosis-box/TheKitty/blob/main/apps/web/src/components/services/PaySheet.tsx>

### Deployed contracts (Gnosis Chain, chain id 100)

| Contract | Address | Notes |
|---|---|---|
| **ServiceRegistry** (new) | [`0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`](https://gnosisscan.io/address/0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c) | Singleton services board · 25 unit tests · no funds custodied |
| KittyFactory v3 (current) | [`0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`](https://gnosisscan.io/address/0xa6f38d8613F8612Fcfdf89707B479ea4ef554439) | Sourcify-verified · stake mode + slash |
| KittyFactory v2 (tontine, no stake) | [`0x880E213224Ce5B6B8a01A21D4318819c67146533`](https://gnosisscan.io/address/0x880E213224Ce5B6B8a01A21D4318819c67146533) | First tontine release |
| KittyFactory v1 (free pot only) | [`0x21539cb2b5a80C88a0D05E631662972589bD010A`](https://gnosisscan.io/address/0x21539cb2b5a80C88a0D05E631662972589bD010A) | Trail-of-Bits-audited core |
| Circles V2 Hub (Aboutcircles) | [`0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8) | |
| BaseGroupFactory (Aboutcircles) | [`0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d`](https://gnosisscan.io/address/0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d) | |

### Tests & audit

- Trail of Bits audit fixes still cover the free-pot core
  (`KittyGovernance` + factory). Tontine + stake + `ServiceRegistry`
  extensions land on top, unit-tested.
- **105 Foundry tests** total (25 new this cycle for ServiceRegistry:
  publish / update / deactivate / logPayment / rate + per-rater
  overwrite + view paths + fuzz on rating bounds).
- 3 Gnosis fork tests against real chain state still pass.

## What's next

Three cycle 4 candidates, ranked by leverage on the Garage criteria:

1. **Kitty sources in the pay sheet** — currently the source picker
   only exposes the buyer's Circles wallet. Add **tontine claim → pay**
   (when the viewer has a tontine kitty with a claimable round, bundle
   `claimRound` + `safeTransferFrom` + `logPayment`) and **free-pot
   small spend** (when the price is under the kitty's `smallTxThreshold`,
   pay directly out of the kitty's pool through governance). Closes the
   loop the two halves were designed for.

2. **PR `MiniappRunner` upstream** — submit it as a new file in
   `aboutcircles/sdk-runner` once it's seen prod payments. Signals
   "deep Circles contribution" rather than "we built our own thing"
   and gives every future miniapp dev the same shortcut.

3. **Calendar-shaped services** — bookable slots stored on-chain (a
   tiny extension to `ServiceRegistry` or a sibling contract), so the
   memo isn't the only way to communicate "Sat 14h". Unblocks the
   class of services (lessons, sessions, treatments) that need a
   booking confirmation, not just a transfer.
