import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { isAddress, parseUnits } from 'viem';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InviteButton } from '@/components/InviteButton';
import { InviteLinkField } from '@/components/InviteLinkField';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { getInviter } from '@/lib/inviter';
import { saveKitty } from '@/lib/storage';
import { buildCreateKittyTx, type TontineInput } from '@/lib/tx-builders';
import { shortAddress } from '@/lib/utils';
import { waitForKittyCreated } from '@/lib/wait-for-kitty';
import type { Address, KittyMode, KittyRef } from '@/types/kitty';

interface FormState {
  name: string;
  symbol: string;
  memberInputs: string[];
  quorum: string;
  smallThresholdCrc: string;
  votingHours: string;
  mode: KittyMode;
  roundLength: string;
  roundUnit: RoundUnit;
  roundContributionCrc: string;
  firstClaimDelayDays: string;
}

type RoundUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const ROUND_UNIT_SECONDS: Record<RoundUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const DEFAULTS: FormState = {
  name: '',
  symbol: '',
  memberInputs: ['', '', ''],
  quorum: '51',
  smallThresholdCrc: '5',
  votingHours: '24',
  mode: 'tontine',
  roundLength: '30',
  roundUnit: 'days',
  roundContributionCrc: '50',
  firstClaimDelayDays: '30',
};

export default function KittyNewRoute() {
  const { address, isConnected, sendTransactions } = useWallet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<FormState>(() => {
    const inviter = getInviter();
    const seed: string[] = [];
    if (address) seed.push(address);
    if (inviter && (!address || inviter.toLowerCase() !== address.toLowerCase())) {
      seed.push(inviter);
    }
    while (seed.length < 3) seed.push('');
    const queryMode = searchParams.get('mode');
    const mode: KittyMode = queryMode === 'free' ? 'free' : 'tontine';
    return { ...DEFAULTS, memberInputs: seed, mode };
  });
  const [submitting, setSubmitting] = useState(false);

  const factoryReady = Boolean(CIRCLES_CONFIG.kittyFactoryAddress);

  const validation = useMemo(() => validate(form, address), [form, address]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setMember(i: number, value: string) {
    setForm((f) => ({
      ...f,
      memberInputs: f.memberInputs.map((m, idx) => (idx === i ? value : m)),
    }));
  }

  function addMember() {
    setForm((f) => ({ ...f, memberInputs: [...f.memberInputs, ''] }));
  }

  function removeMember(i: number) {
    setForm((f) => ({
      ...f,
      memberInputs: f.memberInputs.length <= 2 ? f.memberInputs : f.memberInputs.filter((_, idx) => idx !== i),
    }));
  }

  /// In tontine mode the order of members is the rotation order — index 0
  /// claims round 0, etc. Let the user reorder before creating.
  function swapMembers(i: number, j: number) {
    setForm((f) => {
      if (i < 0 || j < 0 || i >= f.memberInputs.length || j >= f.memberInputs.length) return f;
      const next = [...f.memberInputs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...f, memberInputs: next };
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validation.ok || !address) {
      if (validation.error) toast.error(validation.error);
      return;
    }
    if (!factoryReady) {
      toast.error('KittyFactory address not configured (VITE_KITTY_FACTORY).');
      return;
    }

    setSubmitting(true);
    try {
      const tx = buildCreateKittyTx({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        members: validation.members,
        quorumPercent: validation.quorum,
        smallTxThreshold: validation.smallThreshold,
        votingPeriodSeconds: validation.votingPeriodSeconds,
        feeCollection: address,
        tontine: validation.tontine,
      });

      toast.loading('Creating the kitty…', { id: 'create-kitty' });
      const [txHash] = await sendTransactions([tx]);
      if (!txHash) throw new Error('Host returned no tx hash');

      toast.loading('Waiting for confirmation…', { id: 'create-kitty' });
      const created = await waitForKittyCreated(txHash as `0x${string}`);

      // Use the values we actually submitted for the local cache. The on-chain
      // event decode is only load-bearing for `governance` / `baseGroup` (which
      // are addresses we couldn't predict client-side) — the rest is what the
      // form passed in.
      const ref: KittyRef = {
        governance: created.governance,
        groupAvatar: created.baseGroup,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        members: validation.members,
        quorumPercent: validation.quorum,
        smallTxThreshold: validation.smallThreshold.toString(),
        votingPeriod: validation.votingPeriodSeconds,
        createdAt: Math.floor(Date.now() / 1000),
        chainId: CIRCLES_CONFIG.chainId,
        mode: form.mode,
        ...(form.mode === 'tontine' && validation.tontine.enabled
          ? {
              roundContribution: validation.tontine.roundContribution.toString(),
              roundDuration: validation.tontine.roundDurationSeconds,
            }
          : {}),
      };
      saveKitty(address, ref);

      toast.success('Kitty created ✓', { id: 'create-kitty' });
      navigate(`/kitty/${created.governance}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create kitty', {
        id: 'create-kitty',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
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
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {form.mode === 'tontine' ? 'New tontine' : 'New group pot'}
          </p>
          <h1 className="text-2xl font-semibold">
            {form.mode === 'tontine' ? 'Start a tontine' : 'Set up a group pot'}
          </h1>
        </div>
      </header>

      {!factoryReady && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-200">
              KittyFactory address is missing. Deploy contracts/script/Deploy.s.sol on Gnosis
              Chain and set <code>VITE_KITTY_FACTORY</code> in <code>apps/web/.env.local</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>How the kitty shows up on-chain.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name · max 19 chars</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value.slice(0, 19))}
                placeholder="Flat 23"
                maxLength={19}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="symbol">Symbol · 3-4 letters</Label>
              <Input
                id="symbol"
                value={form.symbol}
                onChange={(e) =>
                  setField(
                    'symbol',
                    e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
                  )
                }
                placeholder="FLAT"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {form.mode === 'tontine'
                ? 'Order is the rotation order. Index 0 claims round 0.'
                : 'Safe addresses that can deposit, propose and vote. Min 2, no duplicates.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteButton variant="primary" label="Invite a friend" />
            <InviteLinkField />
            <div className="flex flex-col gap-2">
              {form.memberInputs.map((value, idx) => {
                const isSelf = address && value.toLowerCase() === address.toLowerCase();
                const looksValid = !value || isAddress(value);
                const isTontine = form.mode === 'tontine';
                return (
                  <div key={idx} className="flex items-center gap-2">
                    {isTontine && (
                      <span className="w-6 text-center text-xs font-mono text-[var(--color-muted)]">
                        {idx + 1}
                      </span>
                    )}
                    <Input
                      value={value}
                      onChange={(e) => setMember(idx, e.target.value.trim())}
                      placeholder="0x…"
                      className={
                        !looksValid
                          ? 'border-rose-500/60 focus-visible:ring-rose-500/40'
                          : undefined
                      }
                      required={idx < 2}
                    />
                    {isSelf && <Badge tone="accent">you</Badge>}
                    {isTontine && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => swapMembers(idx, idx - 1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                          className="px-1.5"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => swapMembers(idx, idx + 1)}
                          disabled={idx === form.memberInputs.length - 1}
                          aria-label="Move down"
                          className="px-1.5"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(idx)}
                      disabled={form.memberInputs.length <= 2}
                      aria-label="Remove member"
                      className="px-2"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMember}
              className="self-start"
            >
              <Plus className="size-4" />
              Add member
            </Button>
          </CardContent>
        </Card>

        {form.mode === 'free' && (
          <Card>
            <CardHeader>
              <CardTitle>Governance</CardTitle>
              <CardDescription>How the pot spends.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quorum">Quorum · % of members</Label>
                <Input
                  id="quorum"
                  type="number"
                  min={1}
                  max={100}
                  value={form.quorum}
                  onChange={(e) => setField('quorum', e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="threshold">Small spend cap · CRC (no vote below this)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.smallThresholdCrc}
                  onChange={(e) => setField('smallThresholdCrc', e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="period">Voting period · hours</Label>
                <Input
                  id="period"
                  type="number"
                  min={1}
                  value={form.votingHours}
                  onChange={(e) => setField('votingHours', e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>
        )}

        {form.mode === 'tontine' && (
          <Card>
            <CardHeader>
              <CardTitle>Rotation</CardTitle>
              <CardDescription>
                Each round, every member commits the same amount. The current
                claimer takes the full pot ({form.memberInputs.filter(Boolean).length || '—'}×
                contribution).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roundLength">Round length</Label>
                <div className="flex gap-2">
                  <Input
                    id="roundLength"
                    type="number"
                    min={1}
                    step="any"
                    value={form.roundLength}
                    onChange={(e) => setField('roundLength', e.target.value)}
                    required
                    className="flex-1"
                  />
                  <select
                    value={form.roundUnit}
                    onChange={(e) => setField('roundUnit', e.target.value as RoundUnit)}
                    className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                  >
                    <option value="seconds">seconds</option>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  Need to test the rotation live? Pick seconds or minutes.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roundContribution">Per-member contribution · CRC</Label>
                <Input
                  id="roundContribution"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.roundContributionCrc}
                  onChange={(e) => setField('roundContributionCrc', e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstClaim">First claim opens in · days</Label>
                <Input
                  id="firstClaim"
                  type="number"
                  min={0}
                  step="any"
                  value={form.firstClaimDelayDays}
                  onChange={(e) => setField('firstClaimDelayDays', e.target.value)}
                  required
                />
                <p className="text-xs text-[var(--color-muted)]">
                  Use 0 to let round 0 be claimable as soon as the pot is funded.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {validation.error && (
          <p className="text-sm text-rose-300">{validation.error}</p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!isConnected || !validation.ok || !factoryReady || submitting}
        >
          {submitting
            ? 'Creating…'
            : form.mode === 'tontine'
            ? 'Start the tontine'
            : 'Create the group pot'}
        </Button>

        {!isConnected ? (
          <p className="text-center text-xs text-[var(--color-muted)]">
            No host wallet detected. Open this app inside the Circles playground —{' '}
            <a
              href="https://circles.gnosis.io/playground"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-[var(--color-text)]"
            >
              circles.gnosis.io/playground
            </a>{' '}
            — to sign with your Safe.
          </p>
        ) : (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Signing as {shortAddress(address)} on Gnosis Chain (id {CIRCLES_CONFIG.chainId})
          </p>
        )}
      </form>
    </main>
  );
}

interface Validation {
  ok: boolean;
  error?: string;
  members: Address[];
  quorum: number;
  smallThreshold: bigint;
  votingPeriodSeconds: number;
  tontine: TontineInput;
}

const TONTINE_OFF: TontineInput = {
  enabled: false,
  roundDurationSeconds: 0,
  roundContribution: 0n,
  firstClaimAtSeconds: 0,
};

function validate(form: FormState, _self: Address | null): Validation {
  const fallback: Validation = {
    ok: false,
    members: [],
    quorum: 0,
    smallThreshold: 0n,
    votingPeriodSeconds: 0,
    tontine: TONTINE_OFF,
  };

  const name = form.name.trim();
  if (!name) return { ...fallback, error: 'Pick a name for the kitty.' };
  if (name.length > 19) return { ...fallback, error: 'Name must be 19 chars or fewer.' };

  const symbol = form.symbol.trim().toUpperCase();
  if (symbol.length < 3) return { ...fallback, error: 'Symbol must be 3-4 letters.' };

  const raw = form.memberInputs.map((m) => m.trim()).filter(Boolean);
  if (raw.length < 2) return { ...fallback, error: 'Add at least 2 members.' };
  const lower = new Set<string>();
  const members: Address[] = [];
  for (const m of raw) {
    if (!isAddress(m)) return { ...fallback, error: `"${m}" is not a valid address.` };
    const key = m.toLowerCase();
    if (lower.has(key)) return { ...fallback, error: 'Duplicate member address.' };
    lower.add(key);
    members.push(m as Address);
  }

  const quorum = Number(form.quorum);
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > 100) {
    return { ...fallback, error: 'Quorum must be an integer between 1 and 100.' };
  }

  let smallThreshold: bigint;
  try {
    smallThreshold = parseUnits(form.smallThresholdCrc || '0', 18);
  } catch {
    return { ...fallback, error: 'Small spend cap is not a valid number.' };
  }
  if (smallThreshold < 0n) {
    return { ...fallback, error: 'Small spend cap cannot be negative.' };
  }

  const hours = Number(form.votingHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ...fallback, error: 'Voting period must be a positive number of hours.' };
  }
  const votingPeriodSeconds = Math.floor(hours * 3600);

  let tontine: TontineInput = TONTINE_OFF;
  if (form.mode === 'tontine') {
    const roundLength = Number(form.roundLength);
    if (!Number.isFinite(roundLength) || roundLength <= 0) {
      return { ...fallback, error: 'Round length must be a positive number.' };
    }
    const roundDurationSeconds = Math.floor(roundLength * ROUND_UNIT_SECONDS[form.roundUnit]);
    if (roundDurationSeconds < 1) {
      return { ...fallback, error: 'Round length is too short — at least 1 second.' };
    }
    let contribution: bigint;
    try {
      contribution = parseUnits(form.roundContributionCrc || '0', 18);
    } catch {
      return { ...fallback, error: 'Per-member contribution is not a valid number.' };
    }
    if (contribution <= 0n) {
      return { ...fallback, error: 'Per-member contribution must be greater than zero.' };
    }
    const firstClaimDelayDays = Number(form.firstClaimDelayDays);
    if (!Number.isFinite(firstClaimDelayDays) || firstClaimDelayDays < 0) {
      return { ...fallback, error: 'First-claim delay must be zero or more days.' };
    }
    // Add a 60-second buffer to dodge the race between "now" computed in
    // the browser and `block.timestamp` at tx execution time. Without it,
    // firstClaimDelayDays=0 always reverts BadTontineParams because the
    // chain has advanced a few seconds since the form was submitted.
    const now = Math.floor(Date.now() / 1000);
    const FIRST_CLAIM_BUFFER_SECONDS = 60;
    tontine = {
      enabled: true,
      roundDurationSeconds,
      roundContribution: contribution,
      firstClaimAtSeconds:
        now + FIRST_CLAIM_BUFFER_SECONDS + Math.floor(firstClaimDelayDays * 86400),
    };
  }

  return { ok: true, members, quorum, smallThreshold, votingPeriodSeconds, tontine };
}
