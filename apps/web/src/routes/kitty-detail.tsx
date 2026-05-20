import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/hooks/use-wallet';
import { loadKitties } from '@/lib/storage';
import { shortAddress } from '@/lib/utils';
import type { Address, KittyRef } from '@/types/kitty';

export default function KittyDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();
  const [kitty, setKitty] = useState<KittyRef | null>(null);

  useEffect(() => {
    if (!address || !id) return;
    const match = loadKitties(address).find(
      (k) => k.governance.toLowerCase() === id.toLowerCase(),
    );
    setKitty(match ?? null);
  }, [address, id]);

  if (!address) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center text-sm text-[var(--color-muted)]">
        Connect via the Circles host to view a kitty.
      </main>
    );
  }

  if (!kitty) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-12">
        <header className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="px-2"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold">Kitty not found</h1>
        </header>
        <p className="text-sm text-[var(--color-muted)]">
          We have no local record of <code>{shortAddress(id as Address)}</code>. If you joined
          someone else's kitty, ask the creator to share the link directly.
        </p>
      </main>
    );
  }

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
            {kitty.symbol}
          </p>
          <h1 className="text-2xl font-semibold">{kitty.name}</h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Coming next phase — balance, proposals, history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Members" value={String(kitty.members.length)} />
            <Stat label="Quorum" value={`${kitty.quorumPercent}%`} />
            <Stat
              label="Small cap"
              value={`${formatRawCrc(kitty.smallTxThreshold)} CRC`}
            />
            <Stat
              label="Voting"
              value={`${Math.round(kitty.votingPeriod / 3600)}h`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressRow label="Governance" value={kitty.governance} />
          <AddressRow label="Group avatar" value={kitty.groupAvatar} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {kitty.members.map((m) => (
            <div
              key={m}
              className="flex items-center justify-between rounded-lg bg-[var(--color-surface-hi)] px-3 py-2 font-mono text-xs"
            >
              <span>{shortAddress(m)}</span>
              {address.toLowerCase() === m.toLowerCase() && <Badge tone="accent">you</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="text-sm text-[var(--color-muted)]">
            Deposits, proposals and spending land in Phase 3. For now, the kitty is created and
            members are trusted on-chain.
          </p>
          <Link
            to="/"
            className="inline-flex h-9 items-center justify-center self-start rounded-xl border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hi)]"
          >
            Back to all kitties
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="font-mono text-base">{value}</p>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: Address }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
        <p className="font-mono text-xs">{shortAddress(value)}</p>
      </div>
      <a
        href={`https://gnosisscan.io/address/${value}`}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Open in GnosisScan"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function formatRawCrc(raw: string): string {
  try {
    const n = BigInt(raw);
    const whole = n / 10n ** 18n;
    const fraction = (n % 10n ** 18n) / 10n ** 14n; // 4 dp
    return fraction === 0n ? whole.toString() : `${whole}.${String(fraction).padStart(4, '0')}`;
  } catch {
    return raw;
  }
}
