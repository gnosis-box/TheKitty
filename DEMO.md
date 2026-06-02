# Demo runbook — Circles Garage cycle 3

90 seconds, mobile-first, pre-loaded state, one live pay flow.

## Pitch (10s, oral)

> Your hourly Circles UBI is small, but pooled with people you trust
> it can pay for something one of you actually needs this week — a
> haircut, a guitar lesson, a brunch. The Kitty is two halves: a
> services board where humans publish what they offer in CRC, and
> tontines where a few people pool CRC and take turns spending it on
> each other. Built on Circles.

## The 90-second story arc

| t | Screen | Spoken beat |
|---|---|---|
| 0-10s | `/services` open in playground. Two service cards visible (e.g. "Haircut at my studio · 24 CRC", "Sound design lesson · 60 CRC") | "Two humans, two services, priced in CRC." |
| 10-25s | Tap the first card → detail page. Title + description + price + provider chip + 5★ rating bar + provider's other services | "One URL per service. Shareable. You can see what others paid, what they rated." |
| 25-40s | Provider chip on detail → tap → `/providers/0x…`: all of that provider's services | "Every provider has a profile — their full catalog, one link in bio." |
| 40-55s | Back to `/services/3` → tap **Trust + pay 24 CRC** → PaySheet opens | "One signature: trust the provider, send the CRC, log the payment on-chain." |
| 55-65s | Source picker shows "My Circles wallet". Add a memo: *"Sat 14h"* | "The memo travels with the payment so calendar services know the slot." |
| 65-80s | Confirm → host signature prompt → tx confirms → sheet swaps to "How was it?" with 5 tap-to-rate stars | "After every payment, you can rate. One slot per rater — re-rating overwrites, no spam." |
| 80-90s | Tap 5★ → rating fires → toast "Thanks, 5★ saved" → back on `/services` with the card showing one more payment | "Two-sided economy between Circles humans. Done." |

## Pre-demo checklist

Run the morning of. Two Circles wallets needed (the demo is
**cross-wallet** by design: A publishes, B pays). The current contracts
on Gnosis Chain (chain id 100):

- **ServiceRegistry**: `0x26F81d723Ad1648194FAA4b7E235105Fd1212c6c`
- **KittyFactory v3**: `0xa6f38d8613F8612Fcfdf89707B479ea4ef554439`

The front-end is at `https://thekitty.gnosis.box`.

### 1. Verify the deployed build is current

Open `https://thekitty.gnosis.box/services` in a private window. Dev
tools → Sources → main bundle → grep for
`26F81d723Ad1648194FAA4b7E235105Fd1212c6c`. It must appear. If it
doesn't, Coolify served a stale bundle — push a fresh commit or
trigger redeploy with `VITE_SERVICE_REGISTRY` set in **Build
environment** (not Runtime).

### 2. Seed two services from wallet A

Open the playground as the *provider* (wallet A):

```
https://circles.gnosis.io/playground?url=https%3A%2F%2Fthekitty.gnosis.box%2Fservices
```

Tap **Publish a service** → fill the form:

- **Title**: `Haircut at my studio` (≤64 chars)
- **Description**: `Marseille center, walk-ins welcome`
- **Price · CRC**: `24`
- **Duration · minutes**: `30`

Sign. Wait for the toast "Service published". Repeat for a second
service so the list isn't a single row:

- **Title**: `Sound design lesson`
- **Description**: `One-on-one, ableton + analog`
- **Price · CRC**: `60`
- **Duration · minutes**: `60`

### 3. Verify the list

Refresh `/services`. Both services should appear, newest first. The
provider chip on each card should show wallet A's avatar (or short
address fallback).

### 4. Sanity-check the management screen

Open the burger menu (top left) → **My services**. Both rows visible
with **Edit** + **Deactivate** buttons. Tap **Edit** on one to confirm
the form prefills with the current values, then back without saving.

### 5. Switch to wallet B for the live pay

In the playground host UI, swap the active wallet to B (a different
Circles human who **does not yet trust** wallet A — the demo is more
impressive if the bundle includes the trust call).

Reload the iframe. The service cards now show:
- *"Trust + pay 24 CRC"* CTA instead of *"Pay 24 CRC"*.

That's the right pre-state.

### 6. Optional: pre-rate one of the services

If you have a third wallet handy, pay one of A's services from it and
leave a 5★ rating so the detail page's rating distribution bar isn't
empty during the demo. This step is purely cosmetic — if you skip it,
just narrate "no ratings yet, the bar is empty until the first one
lands" instead of pointing at it.

## Live demo flow (the 90 seconds)

You are on wallet B's playground view of `/services`. Camera on the
iframe. The cards above are visible.

### Beat 1 — services board (0-10s)

> *"Two humans, two services, priced in CRC."*

Scroll once to show both cards. Hover the title of the first.

### Beat 2 — detail page (10-25s)

Tap the haircut card.

> *"One URL per service. Shareable. You can see what others paid,
> what they rated."*

Point at: price + duration tile, provider chip, rating bar, payment
count.

### Beat 3 — provider profile (25-40s)

Tap the provider chip.

> *"Every provider has a profile — their full catalog, one link in
> bio."*

Show both A's services on the profile page. The lifetime CRC + rating
average aggregate across all of their services.

Back to the haircut detail page.

### Beat 4 — pay flow (40-65s)

Tap **Trust + pay 24 CRC**.

> *"One signature: trust the provider, send the CRC, log the payment
> on-chain."*

Bottom sheet slides up. Show the source picker ("My Circles wallet"
selected). Type into the memo: `Sat 14h`.

> *"The memo travels with the payment so calendar services know the
> slot."*

Tap **Trust + pay 24 CRC**.

### Beat 5 — host signature + rate prompt (65-80s)

Host pops the Safe signature sheet. Confirm.

> *"After every payment, you can rate. One slot per rater — re-rating
> overwrites, no spam."*

Wait for the receipt (~5s on Gnosis). The sheet swaps to "How was
it?" with 5 stars. Tap the 5th.

### Beat 6 — close (80-90s)

The rate tx fires, toast "Thanks, 5★ saved", the sheet closes.

Tap the burger → **Stats** to land on the Services board card showing
the new payment + the bumped CRC paid total.

> *"Two-sided economy between Circles humans. Done."*

## If something breaks during the live take

- **No host signature prompt** → the iframe lost focus, click into it
  before tapping the CTA.
- **"Insufficient balance"** toast → wallet B doesn't have 24 CRC
  spendable. Mint more on the host's faucet route, or lower the
  service price beforehand.
- **The "Trust + pay" bundle hangs without a prompt** → host may have
  swallowed the call; reload the iframe and retry. The on-chain state
  isn't affected by a hung pre-sign.
- **Rate sheet doesn't appear** → the payment still went through.
  Reload `/services` to confirm the `timesPaid` counter bumped, then
  cut to `/services/:id` to rate manually.

## After the take

- Run the same pay back the other way (wallet B → wallet A) so the
  trust graph closes both directions and the next demo doesn't need
  the trust bundle.
- Don't deactivate the demo services — leaving them up means anyone
  walking the URL after the judging window still sees something live.
