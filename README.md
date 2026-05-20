# The Kitty

> **Chip in. Cash out together.** A shared on-chain pot for groups, on Circles V2.

## What it is

**Tricount tells you who owes who. Lydia holds the money for you if you trust the platform. The Kitty is an automatic shared vault: the rules (votes, spend caps) are public and enforced by code, and the money works for you as long as it keeps moving.**

It's a Circles V2 mini-app for housemates, families, travel groups, or any small collective who wants to pool funds and spend them together — without the "settle up later" friction of a tracker app, and without the centralized custody of a fintech cagnotte.

## How it works

1. **Create a kitty** with 2+ Circles members, a quorum (e.g. 51%), and a small-spend cap (e.g. 5 CRC under which any member can spend without a vote).
2. **Deposit personal CRC**: each member's contribution turns into pot tokens held by the governance contract.
3. **Spend**:
   - Below the cap → any member pays directly. No vote.
   - Above the cap → any member proposes, others approve. Once quorum is reached, the spend executes.
4. **Anti-decay**: Circles' demurrage costs idle CRC ~7%/yr. A kitty that keeps the money in motion preserves value that a sleeping wallet would lose.

## Why on-chain

- **Real custody, not bookkeeping.** The pot exists; it's not a tab to settle later.
- **Rules in code.** No admin can drain the pot. Votes and caps are enforced by `KittyGovernance`.
- **Auditable.** Every spend is a transaction on Gnosis Chain.
- **Uses CRC (Circles UBI).** Every registered human earns CRC daily just for existing — you pool money that was free to acquire.

## Architecture

```
User Safe (Circles human)
   │
   │ via @aboutcircles/miniapp-sdk → sendTransactions([...])
   ▼
KittyFactory  ──── createKitty() ─────► BaseGroupFactory → new BaseGroup (Circles V2 group avatar)
                                                            │
                                                            └─── trusts members
                                                            └─── owner transferred to creator
                                  ┌───────────────────────────┘
                                  ▼
                          KittyGovernance
                              (custodial: holds pot tokens, runs propose / approve / execute)
```

- `KittyGovernance.sol` — pot custodian + voting. Members deposit by bundling `Hub.groupMint` + ERC-1155 transfer.
- `KittyFactory.sol` — one-tx setup: creates the BaseGroup, trusts members, deploys governance, hands BaseGroup ownership back to the creator.

## Deployed (Gnosis Chain, chainId 100)

- KittyFactory: [`0x3a182fC64683A09B77C961E0fb9f1Abfb6bb0314`](https://gnosisscan.io/address/0x3a182fC64683A09B77C961E0fb9f1Abfb6bb0314)
- Built on Circles V2 Hub `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` + BaseGroupFactory `0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d`.

## Try it

Inside the Circles playground:
```
https://circles.gnosis.io/playground?url=<your-deploy-url>
```

## Stack

- **Frontend** — Vite 6, React 19, Tailwind v4, react-router 7, viem 2.50
- **Wallet** — `@aboutcircles/miniapp-sdk` (host iframe) + `@aboutcircles/sdk` for reads
- **Contracts** — Foundry, Solidity 0.8.24, 27 tests passing
- **Hosting** — Coolify (Docker + Caddy)

## Status

- [x] Phase 0 — sanity check the iframe / SDK / Safe chain
- [x] Phase 1 — `KittyGovernance` + `KittyFactory` deployed
- [x] Phase 2 — create-a-kitty UI (1 tx)
- [x] Phase 3 — deposit, propose, approve, execute, small-spend
- [ ] Phase 4 — polish (profile enrichment, real demurrage calc, demo video, README screenshots)

## License

AGPL-3.0
