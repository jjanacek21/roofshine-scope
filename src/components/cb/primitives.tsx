/**
 * Claim Buddy surface primitives — depth through light and shadow.
 *
 * Every color here comes from a CSS custom property defined in the
 * `[data-cb]` block of src/styles.css, so a palette swap is a one-file change.
 */
import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useTilt, CbCountUp } from "./motion";

type Elevation = "flat" | "card" | "raised" | "floating";

export function CbCard({
  children,
  className = "",
  elevation = "card",
  tilt = false,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  elevation?: Elevation;
  tilt?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const tiltRef = useTilt<HTMLDivElement>(6);
  return (
    <div
      ref={tilt ? tiltRef : undefined}
      className={`cb-surface cb-elev-${elevation} ${tilt ? "cb-tilt" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Stat tile — card treatment plus a faint accent glow behind the number. */
export function CbTile({
  label,
  value,
  suffix,
  prefix,
  decimals = 0,
  hint,
  className = "",
  tilt = true,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  hint?: ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  return (
    <CbCard elevation="raised" tilt={tilt} className={`cb-tile ${className}`}>
      <span className="cb-microlabel">{label}</span>
      <div className="cb-tile-value">
        <CbCountUp value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </div>
      {hint ? <div className="cb-tile-hint">{hint}</div> : null}
    </CbCard>
  );
}

export const CbButton = forwardRef<
  HTMLButtonElement,
  {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "md" | "lg";
    block?: boolean;
    loading?: boolean;
    loadingText?: string;
    children: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function CbButton(
  {
    variant = "primary",
    size = "lg",
    block,
    loading,
    loadingText,
    children,
    className = "",
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`cb-btn cb-btn-${variant} cb-btn-${size} ${block ? "cb-btn-block" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      <span className="cb-btn-label">{loading ? (loadingText ?? "Working…") : children}</span>
      <span aria-hidden className="cb-specular" />
    </button>
  );
});

export function CbChip({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`cb-chip ${className}`} style={style}>
      {children}
    </span>
  );
}

export function CbBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  className?: string;
}) {
  return <span className={`cb-badge cb-badge-${tone} ${className}`}>{children}</span>;
}

/** Machined icon wrapper — hairline stroke plus a soft drop shadow. */
export function CbIcon({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`cb-icon ${className}`}>{children}</span>;
}

/**
 * Bottom sheet / modal.
 * On phone it is a full-height bottom sheet with a drag handle that can be
 * swiped down to dismiss; scroll stays inside the sheet (overscroll-contain).
 */
export function CbSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  function startDrag(e: React.TouchEvent) {
    dragRef.current = { y: e.touches[0].clientY, active: true };
  }
  function moveDrag(e: React.TouchEvent) {
    if (!dragRef.current.active || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragRef.current.y;
    sheetRef.current.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }
  function endDrag(e: React.TouchEvent) {
    if (!dragRef.current.active || !sheetRef.current) return;
    const dy = e.changedTouches[0].clientY - dragRef.current.y;
    dragRef.current.active = false;
    sheetRef.current.style.transform = "";
    if (dy > 110) onClose();
  }

  return (
    <div className="cb-scrim" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="cb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="cb-sheet-handle"
          aria-hidden
          onTouchStart={startDrag}
          onTouchMove={moveDrag}
          onTouchEnd={endDrag}
        />
        {title ? <h2 className="cb-sheet-title">{title}</h2> : null}
        <div>{children}</div>
        {footer ? <div className="cb-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Skeleton that matches the shape of what is coming. */
export function CbSkeleton({
  height = 16,
  width = "100%",
  radius = 8,
  className = "",
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`cb-skeleton ${className}`}
      style={{ height, width, borderRadius: radius }}
      aria-hidden
    />
  );
}

/** Loading state with words, not a bare spinner. */
export function CbLoading({ label }: { label: string }) {
  return (
    <div className="cb-loading" role="status" aria-live="polite">
      <span className="cb-loading-rail">
        <span className="cb-loading-fill" />
      </span>
      <span className="cb-loading-label">{label}</span>
    </div>
  );
}

/** Empty state: one warm line of copy, one obvious action. */
export function CbEmptyState({
  headline,
  body,
  action,
}: {
  headline: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <CbCard elevation="card" className="cb-empty">
      <p className="cb-empty-headline">{headline}</p>
      {body ? <p className="cb-empty-body">{body}</p> : null}
      {action ? <div className="cb-empty-action">{action}</div> : null}
    </CbCard>
  );
}
