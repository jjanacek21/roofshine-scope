import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import {
  CB_FEATURE_LABEL,
  CB_TIER_LABEL,
  cbTierFor,
  cbUpgradeCopy,
  type CbFeature,
} from "@/lib/cbFeatures";

/** True when the active company's plan includes the feature. */
export function useCbFeature(feature: CbFeature) {
  const { can, tier } = useCbSession();
  return { allowed: can(feature), tier, requiredTier: cbTierFor(feature) };
}

/** Toasts the upgrade message. Returns false when the feature is locked. */
export function useCbFeatureGuard() {
  const { can } = useCbSession();
  return (feature: CbFeature) => {
    if (can(feature)) return true;
    toast.info(cbUpgradeCopy(feature));
    return false;
  };
}

/** Small padlock chip shown on a locked control. */
export function CbLockChip({ feature }: { feature: CbFeature }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "rgba(0,0,0,.06)", color: "var(--cb-text-muted)" }}
    >
      <Lock className="h-3 w-3" />
      {CB_TIER_LABEL[cbTierFor(feature)]}
    </span>
  );
}

/**
 * Renders children when the plan allows the feature, otherwise an upgrade card.
 * Used for whole screens (Survival Guide, Storm Intel).
 */
export function CbFeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: CbFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { allowed } = useCbFeature(feature);
  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <CbUpgradeCard feature={feature} />;
}

export function CbUpgradeCard({ feature }: { feature: CbFeature }) {
  return (
    <div
      className="mx-auto mt-6 w-full max-w-[520px] rounded-[16px] p-5 text-center"
      style={{
        background: "var(--cb-surface, #fff)",
        border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
        boxShadow: "0 12px 30px rgba(0,0,0,.08)",
      }}
    >
      <div
        className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "rgba(0,0,0,.06)" }}
      >
        <Lock className="h-5 w-5" />
      </div>
      <p className="text-[16px] font-semibold">{CB_FEATURE_LABEL[feature]} is locked</p>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
        {cbUpgradeCopy(feature)}
      </p>
    </div>
  );
}
