# The Kitty — Cycle 4 plan

> Direction locked on 2026-06-02 evening after rejecting the stake/slash
> direction. The trust graph itself is the product — discovery,
> coordination, and reputation flow through it. No new economic
> primitive, no yield, no marketplace machinery.

## Premise

The Garage's current frontrunner is a CRC lending project. They tell a
DeFi story: *your CRC can earn yield*. We can't outcompete that on
their terms — and trying to (stake / slash / escrow) drags us into a
narrative we don't own.

What we **do** own: Circles is the only protocol that ships a real,
human-verified, anti-sybil **trust graph** alongside the currency.
That trust graph is unutilised in most Circles apps today. Cycle 4
makes it the engine of the services economy:

- **Discovery** through the trust graph: services and providers
  surface based on what people you trust have actually used.
- **Coordination** through the trust graph: group-pot proposals
  become first-class actions for the shared expenses your circle
  actually has.

This is the pitch the lending project physically cannot tell:
> *"Your Circles wallet is a key into a working economy your trust
> graph already powers."*

## Wave A — Discovery + Social signals (~4 days)

The trust graph stops being a binary filter ("trusted vs not") and
becomes a **recommender**. The headline insight: people you trust
rarely pay the same exact service as you, but they DO pay providers
you don't yet know. Those providers, vetted by your circle, are the
discovery surface that matters.

### Reader chain

```
readTrustsOf(viewer)
  → Set<Address>  — the viewer's direct outgoing trusts on Hub V2

readProvidersPaidByTrusts(trusts)
  → Map<provider, { payers: Set<Address>, totalCrcPaid, avgRating }>
  → aggregate every ServicePaid event where buyer ∈ trusts
  → groupBy provider

filterAlreadyTrusted(map, viewer)
  → subtract providers the viewer already trusts
  → the rest is the viewer's discovery surface

rankByTrustVetting(map)
  → sort by (payers.size desc, avgRating desc)
```

Optional bonus: Circles pathfinder for trust-hop distance
(`circlesConfig.pathfinderUrl`) — a "2 trust hops away" badge tightens
the surface further when the direct trust circle is small.

### UI

**New section on `/services`: "Recommended by your circle"**
- Card per provider (not per service)
- Provider avatar + count of trusts who paid + stacked trust avatars
- *"3 of your trusts paid here · 4.7★ average"*
- 2–3 compact rows for their most-paid services
- Inline CTA **"Trust + explore"** that fires the standalone TrustButton
  and navigates to `/providers/:address`

**Existing `/providers/:address` gains a social banner**
- When viewer doesn't trust yet AND at least one of their trusts paid →
  *"3 of your trusts paid here. They rated: 5★, 4★, 5★."*
- Surfaces concrete vetting context next to the (existing) Trust button.

**Existing `/services` gets a new sort option**
- *"Trusted by my network"* — ranks by the same trust-vetting score.

## Wave B — Group pot for collective expenses (~3 days)

The `propose / approve / execute` flow exists since cycle 1. It's been
buried as a fallback for over-threshold payments. Cycle 4 promotes it
to a first-class action with concrete templates that match what
groups actually spend money on.

### UI

**New CTA on the kitty detail page**: *"Propose a collective expense"*
(replaces the current "Propose" link buried in submenus).

**Templates**
- 🎂 *Birthday gift* → recipient picker (from members or arbitrary
  Circles human), amount, memo pre-filled `"🎂 <name>'s birthday gift"`
- 🍽️ *Group outing* → amount + memo pre-filled `"🍽️ <date>"`
- 🤝 *Solidarity contribution* → recipient + memo
- ✏️ *Custom* (existing form)

**Voting UX**
- `/kitty/:id` opens with *"Open proposals"* at the top of the page
- Each proposal: progress to quorum + your vote status + Approve CTA
- Notification badge on the burger drawer for proposals awaiting your
  vote (across all your kitties)

**Stats**
- `/stats` adds *Collective expenses funded* counter + total CRC
  mobilised across all kitties
- Optional sparkline: proposal count per template family

## Implementation phases

| # | Phase | Effort |
|---|---|---|
| 0 | Plan lock + sign-off | 0.5j |
| 1 | Wave A readers (trusts, providers-paid-by-trusts, ranking) | 1j |
| 2 | Wave A UI — `/services` recommendation section + sort + profile banner | 1.5j |
| 3 | Wave A — pathfinder trust-hop badge (bonus) | 0.5j |
| 4 | Wave B — kitty detail propose-CTA + templates | 1j |
| 5 | Wave B — proposals-list + vote UX + notification badge | 1j |
| 6 | Wave B — `/stats` Collective expenses card | 0.5j |
| 7 | DEMO.md + README sweep + cycle 4 progress note | 0.5j |
| 8 | Live test cross-wallet (Discovery flow + collective proposal) | 0.5j |

**Total: ~7 days focus**

## Risks + mitigations

- **Trust graph reads can be heavy.** A viewer with 50 trusts triggers
  50 lookups in `readProvidersPaidByTrusts`. Mitigation: cache the
  trusts list in localStorage, batch the `ServicePaid` event reads by
  buyer-indexed filter in a single eth_getLogs per viewer session.
- **Recommendation surface is empty for fresh accounts.** A viewer
  with 0 trusts sees nothing in *"Recommended by your circle"*.
  Mitigation: render an explainer empty state pointing to the Trust
  button on existing services — *"Trust some Circles humans to unlock
  recommendations from your network"*. Soft onboarding.
- **Privacy of payment history.** Every `ServicePaid` event is public
  on-chain. Surfacing *"X of your trusts paid here"* is just sugar on
  top of public data. No new privacy surface created. But document it
  in the README so users know.
- **Notification fatigue.** Burger badge for proposals can become
  noise in big groups. Mitigation: only count proposals where the
  viewer hasn't voted yet AND quorum isn't reached yet.

## Narratif Garage cycle 4

> *"Circles ships the only human-verified trust graph in crypto. In
> cycle 4 we wired it into the services economy: providers vetted by
> the people you already trust surface to you for free; collective
> expenses your circle actually has — a birthday gift, a group dinner,
> a solidarity fund — become one-tap proposals. The trust graph at
> work. No yield, no escrow, no fake security mechanisms. Just the
> humans you know making things together."*

## What this plan deliberately drops vs the earlier stake/slash plan

- **Provider stake on publish** — friction antinomic with "small humans
  helping each other in their circle". Filters the wrong way.
- **Slashable flag / counter-flag / settle** — V1 unilateral asymmetric;
  V2 voted would be heavy contract code we don't need.
- **Booking deposit** — same reasoning. Deferred indefinitely.

The case for them isn't gone forever — if a future cycle expands scope
beyond the trust circle (B2C, anonymous services), revisit. Until
then, the trust graph IS the security mechanism.

Related memories: [[project-kitty-security-stance]] (why no stake),
[[project-kitty-positioning]] (C2 hero alignment).
