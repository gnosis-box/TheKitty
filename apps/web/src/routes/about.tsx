import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  HeartHandshake,
  Network,
  ScrollText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { shortAddress } from '@/lib/utils';

export default function AboutRoute() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            The Kitty
          </p>
          <h1 className="text-2xl font-semibold leading-tight">About</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            On-chain tontines for Circles communities.
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
            The Kitty turns a group of Circles humans into a small treasury. The model is the
            <strong> tontine</strong> — what tandas, sou-sou, hui, and rotating savings clubs
            have been doing offline for centuries: each member chips in the same amount every
            round, and one member at a time takes the whole pot.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            The twist: the rotation runs on a smart contract. Nobody holds the money on behalf
            of the others, nobody can run off with the round.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4" /> How a tontine works here
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>
              <strong>Start a tontine</strong> with 2+ Circles humans, a round length, and a
              per-member contribution.
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
              <strong>Claim your round</strong> when your turn comes. The contract enforces the
              rotation by member index — no organizer ever has discretion.
            </li>
            <li>
              <strong>Repeat</strong>. Once everyone has claimed, the cycle wraps back to the
              first member.
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
              <strong>Trust graph</strong> — membership is bootstrapped by the BaseGroup trusting
              each member, and reinforced when members trust each other inline from the kitty
              page.
            </li>
            <li>
              <strong>CRC + demurrage</strong> — payments use CRC, which loses ~7%/yr by design.
              A tontine is exactly the kind of forced-circulation pattern a demurrage currency
              is built for.
            </li>
            <li>
              <strong>Hub V2 transfers</strong> — payouts route through Circles V2 Hub so the
              CRC ends up on the claimer's avatar, not on a wrapper token.
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
            The contracts (Solidity 0.8.24, Foundry, 61 unit tests + 3 Gnosis fork tests) and
            the front-end (Vite + React + Tailwind) live on GitHub under AGPL-3.0.
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
