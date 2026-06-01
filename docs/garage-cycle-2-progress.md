# The Kitty — Cycle 2 progress note

> Submission for the **Circles Garage** weekly judging (Sunday 23:59 CET).
> Same format as cycle 1: what shipped · links · what's next.

## What shipped

Cycle 2 hardened the tontine into an economically defensible primitive.
The big addition is a **stake + slash mechanism**: at creation, members
commit a per-member penalty stake; the kitty stays in a `Setup` phase
until every member has locked theirs, then opens round 0. When
`claimRound` runs, the contract checks each member's cumulative deposits
against the expected mark for that round, slashes 2× the shortfall from
any defaulter's stake, and tops up the pot so the claimer still gets
full payout. Insufficient stake reverts `TontineBankrupt` — the cycle
halts cleanly instead of paying partial. After `cycleRounds` claims, the
kitty transitions to `Complete` and members can `withdrawStake` whatever
survived the slashing.

Beyond the contract:

- **Factory v3 deployed and Sourcify-verified** at
  `0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`.
- **77 Foundry tests** (16 new for the stake / Setup → Active / slash /
  Complete flows + a factory-level end-to-end for stake-mode creation).
- **Phase-aware UI** on the detail page: Setup banner with "X / N
  staked" progress + Lock-my-stake CTA, Withdraw CTA on Complete.
- **Storage filter** so the home only lists kitties spawned by the
  current factory — legacy v1 / v2 entries no longer linger in the
  cache after the upgrade.
- **Brand refresh**: new logo, favicon, social preview, transparent
  mark.

All live on Gnosis Chain.

## Links

### Live app

- App URL: `https://thekitty.gnosis.box`
- In Circles Playground:
  `https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2F`
- About page: `https://thekitty.gnosis.box/about`
- Public stats: `https://thekitty.gnosis.box/stats`

### Source code

- Repo: <https://github.com/gnosis-box/TheKitty>
- README: <https://github.com/gnosis-box/TheKitty/blob/main/README.md>
- Demo runbook: <https://github.com/gnosis-box/TheKitty/blob/main/DEMO.md>
- Contracts directory:
  <https://github.com/gnosis-box/TheKitty/tree/main/contracts>

### Deployed contracts (Gnosis Chain, chain id 100)

| Contract | Address | Notes |
|---|---|---|
| **KittyFactory v3** (current) | [`0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`](https://gnosisscan.io/address/0xa6f38d8613F8612Fcfdf89707B479ea4ef554439) | Sourcify-verified · tx [`0x5f60…ea490`](https://gnosisscan.io/tx/0x5f605641e65356915152a0e890bf2563e1d83f09f02151ddb04c5d349dc8e490), block 46474667 |
| KittyFactory v2 (tontine, no stake) | [`0x880E213224Ce5B6B8a01A21D4318819c67146533`](https://gnosisscan.io/address/0x880E213224Ce5B6B8a01A21D4318819c67146533) | First tontine release |
| KittyFactory v1 (free pot only) | [`0x21539cb2b5a80C88a0D05E631662972589bD010A`](https://gnosisscan.io/address/0x21539cb2b5a80C88a0D05E631662972589bD010A) | Trail-of-Bits-audited core |
| Circles V2 Hub (Aboutcircles) | [`0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8) | |
| BaseGroupFactory (Aboutcircles) | [`0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d`](https://gnosisscan.io/address/0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d) | |

### Tests & audit

- Trail of Bits audit fixes commit:
  `cccc6a5 — fix(contracts): trail of bits audit (reentrancy guards,
  safecast, zero-checks)`. Covers the free-pot core; tontine + stake
  extensions land on top, unit-tested.
- 77 Foundry unit tests: `cd contracts && forge test` (16 new for
  stake / Setup → Active / slash / Complete + factory stake-mode
  end-to-end).
- 3 Gnosis fork tests against real chain state:
  `cd contracts && forge test --match-contract TontineLiveTest -vv --fork-url https://rpc.gnosischain.com`

## What's next

Three cycle 3 candidates, ranked by leverage on the Garage judging
criteria:

1. **Redeem to CRC button** — call `Hub.groupRedeem` directly so a
   claimer can cash out group tokens into spendable personal CRC of
   any collateral avatar the kitty holds, no detour through the kitty
   contract. Closes the most-asked UX gap from cycle 1's live test.

2. **Revenue model aligned with Circles** — small rake on slashed
   stakes (10–20% of the burn into a protocol treasury) plus an opt-in
   "tip the creator" at claim time (claimer can voluntarily redirect
   1–5% of their payout to the protocol). Captures value without
   taxing honest behaviour and stays compatible with the
   post-monetary philosophy of CRC.

3. **Inline deposit + depositStake bundle** — Setup-phase users
   currently sign two separate transactions (groupMint + safeTransfer
   to deposit the stake amount, then `depositStake` to reclassify it).
   Bundle into one `sendTransactions([...])` so the friction matches
   cycle 1's invite flow.
