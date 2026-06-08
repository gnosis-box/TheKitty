import { Link } from 'react-router-dom';
import { Check, Clock, Sparkles, Star, Users } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { TrustButton } from '@/components/services/TrustButton';
import { Card, CardContent } from '@/components/ui/card';
import { ratingAverage, type ServiceView } from '@/lib/services-reader';
import { formatCrc } from '@/lib/utils';

interface Props {
  service: ServiceView;
  /// True when the caller knows the viewer's address; used to render the
  /// "trusted" pill (✓) vs the "trust to pay" hint.
  hasViewer: boolean;
  onPay?: (service: ServiceView) => void;
  /// Called when the viewer extends trust to the provider so the parent
  /// can re-fetch the registry (the card's `trustedByViewer` flips true).
  onTrusted?: () => void;
}

/// Compact card surfacing one service in the registry:
/// title + price + duration up top, provider avatar + rating + payment
/// count in the middle, and a single CTA that adapts based on whether the
/// viewer already trusts the provider. Tapping the CTA delegates to
/// `onPay`, which the parent uses to open the pay flow (W6).
export function ServiceCard({ service, hasViewer, onPay, onTrusted }: Props) {
  const avg = ratingAverage(service);
  const trusted = service.trustedByViewer === true;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/services/${service.id.toString()}`}
            className="min-w-0 flex-1 hover:opacity-90"
          >
            <p className="text-base font-semibold leading-tight">{service.title}</p>
            {service.description && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                {service.description}
              </p>
            )}
          </Link>
          <div className="shrink-0 text-right">
            <p className="font-mono text-lg leading-tight">
              {formatCrc(service.priceCrc)}
              <span className="ml-1 text-xs text-[var(--color-muted)]">CRC</span>
            </p>
            {service.durationMins > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                <Clock className="size-3" />
                {formatDuration(service.durationMins)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Link
            to={`/providers/${service.provider.toLowerCase()}`}
            className="hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            <MemberAvatar address={service.provider} size="xs" />
          </Link>
          {hasViewer && (
            <TrustButton
              trustee={service.provider}
              trusted={service.trustedByViewer}
              onTrusted={onTrusted}
              showAffirmation={false}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
            {avg !== null && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="size-3 fill-current text-amber-500" />
                {avg.toFixed(1)}
                <span className="text-[var(--color-muted)]">({Number(service.ratingsCount)})</span>
              </span>
            )}
            {service.poolShareBps > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-amber-700"
                title="Provider contributes to the community prize pool"
              >
                <Sparkles className="size-3 fill-current text-amber-500" />
                {(service.poolShareBps / 100).toFixed(
                  service.poolShareBps % 100 === 0 ? 0 : 1,
                )}
                %
              </span>
            )}
            {service.timesPaid > 0n && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {Number(service.timesPaid)} paid
              </span>
            )}
          </div>
        </div>

        {hasViewer && onPay && (
          <button
            type="button"
            onClick={() => onPay(service)}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-medium text-[var(--color-accent-fg)] hover:brightness-110"
          >
            {trusted ? (
              <>
                <Check className="size-3.5" />
                Pay {formatCrc(service.priceCrc)} CRC
              </>
            ) : (
              <>Trust + pay {formatCrc(service.priceCrc)} CRC</>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
