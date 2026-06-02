import {
  ExternalLink,
  Github,
  HeartHandshake,
  Network,
  ScrollText,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react';

import { BurgerButton } from '@/components/BurgerButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { shortAddress } from '@/lib/utils';

export default function AboutRoute() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <BurgerButton />
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            The Kitty
          </p>
          <h1 className="text-2xl font-semibold leading-tight">About</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            A working economy between people who trust each other.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="size-4" /> What it is
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            The Kitty turns a Circles trust circle into a small working economy. Two halves
            that feed each other: a <strong>services board</strong> where humans publish what
            they offer in CRC, and <strong>kitties</strong> (tontines or group pots) where a
            few people pool CRC and take turns spending it on each other.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            The pooling side is the tontine — what tandas, sou-sou, hui, and rotating savings
            clubs have done offline for centuries. The twist: the rotation runs on a smart
            contract. Nobody holds the money on behalf of the others, nobody can run off with
            the round.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4" /> The services board
          </CardTitle>
          <CardDescription>What people in the circle are offering.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>
              <strong>Publish</strong> what you offer — title, price in CRC, optional
              description and duration. One signature, one row in the on-chain registry.
            </li>
            <li>
              <strong>Browse</strong> the full board with provider avatars, 1–5 star ratings,
              and whether you already trust them.
            </li>
            <li>
              <strong>Trust + pay</strong> bundles everything into a single host signature:
              add the provider to your trust graph (if needed), send the CRC through Hub V2,
              and log the payment for the registry's aggregates.
            </li>
            <li>
              <strong>Rate</strong> after the fact — 1 to 5 stars, overwritable per rater so
              one person can't game the average by spamming.
            </li>
            <li>
              <strong>Edit or deactivate</strong> your listings any time from{' '}
              <em>My services</em> — only the provider can change a row.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4" /> How a kitty works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>
              <strong>Start a kitty</strong> with 2+ Circles humans. Pick rotating tontine
              (round length + per-member contribution) or group pot (quorum + small-spend cap).
            </li>
            <li>
              <strong>Invite the others</strong> — one signature each to opt in and trust the
              kitty's group avatar.
            </li>
            <li>
              <strong>Chip in</strong> when the round opens. The kitty contract custodies the
              pool until it pays out.
            </li>
            <li>
              <strong>Claim your round</strong> when your turn comes. The contract enforces
              the rotation by member index — no organizer ever has discretion.
            </li>
            <li>
              <strong>Spend</strong> the round on a service the circle offers. Every payout
              lands back inside the trust graph.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="size-4" /> Built on Circles
          </CardTitle>
          <CardDescription>The primitives we lean on, not around.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong>BaseGroup avatars</strong> — each kitty is a real Circles V2 group avatar,
              not a pretend abstraction. Listed in the trust graph alongside human avatars.
            </li>
            <li>
              <strong>Trust graph</strong> — service payments and kitty membership both flow
              through Hub V2 trust. The pay sheet bundles a `Hub.trust(...)` call when the
              viewer doesn't trust the provider yet, so trust always lands together with the
              transfer in one signature.
            </li>
            <li>
              <strong>CRC + demurrage</strong> — payments use CRC, which loses ~7%/yr by design.
              A working economy is exactly the kind of forced-circulation pattern a demurrage
              currency is built for.
            </li>
            <li>
              <strong>SDK-native</strong> — every Circles primitive (Hub V2, NameRegistry,
              wrappers) is built through `@aboutcircles/sdk-core`'s typed contract wrappers,
              not hand-rolled calldata. We ship a tiny `MiniappRunner` that adapts the SDK's
              `ContractRunner` to the iframe host.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Why on-chain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed">
            <li>
              <strong>No trésorier.</strong> The contract is the custodian. No member holds the
              pool on behalf of the others.
            </li>
            <li>
              <strong>Anti-rug ROSCA.</strong> The historical failure mode of tontines is the
              organizer disappearing with the round. claimRound is deterministic by member
              index — the rotation can't be subverted.
            </li>
            <li>
              <strong>Auditable.</strong> Every contribution and every payout is a transaction
              on Gnosis Chain. The dispute log is the chain itself.
            </li>
            <li>
              <strong>Anti-sybil.</strong> Members are Circles V2 verified humans linked by the
              trust graph — the same anti-sybil layer that backs CRC.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" /> Deployed contracts
          </CardTitle>
          <CardDescription>Gnosis Chain (chain id 100).</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-xs">
            {CIRCLES_CONFIG.kittyFactoryAddress && (
              <li>
                <span className="text-[var(--color-muted)]">KittyFactory:</span>{' '}
                <a
                  href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.kittyFactoryAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
                >
                  {shortAddress(CIRCLES_CONFIG.kittyFactoryAddress)}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            )}
            {CIRCLES_CONFIG.serviceRegistryAddress && (
              <li>
                <span className="text-[var(--color-muted)]">ServiceRegistry:</span>{' '}
                <a
                  href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.serviceRegistryAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
                >
                  {shortAddress(CIRCLES_CONFIG.serviceRegistryAddress)}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            )}
            <li>
              <span className="text-[var(--color-muted)]">Circles V2 Hub:</span>{' '}
              <a
                href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.v2HubAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
              >
                {shortAddress(CIRCLES_CONFIG.v2HubAddress)}
                <ExternalLink className="size-3" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="size-4" /> Open source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            The contracts (Solidity 0.8.24, Foundry, 105 tests covering the kitty governance,
            the ServiceRegistry, and the stake/slash mechanism) and the front-end (Vite +
            React + Tailwind, SDK-native through `@aboutcircles/sdk-core`) live on GitHub
            under AGPL-3.0.
          </p>
          <a
            href="https://github.com/gnosis-box/TheKitty"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[color-mix(in_oklab,var(--color-accent),black_20%)] hover:underline"
          >
            github.com/gnosis-box/TheKitty
            <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
