/**
 * Claim Buddy form primitives — big, tactile, one-handed-on-a-roof friendly.
 * All colors come from `[data-cb]` CSS custom properties.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cbHaptic } from "./motion";

/* ---------------- Floating-label field ---------------- */

export function CbField({
  label,
  error,
  hint,
  className = "",
  ...rest
}: {
  label: string;
  error?: string | null;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const ref = useRef<HTMLInputElement | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!error) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 420);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <div className={`cb-field ${error ? "has-error" : ""} ${shake ? "is-shaking" : ""} ${className}`}>
      <input
        id={id}
        ref={ref}
        placeholder=" "
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-msg` : hint ? `${id}-hint` : undefined}
        className="cb-input"
        {...rest}
      />
      <label htmlFor={id} className="cb-float-label">
        {label}
      </label>
      {error ? (
        <p id={`${id}-msg`} className="cb-field-msg is-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="cb-field-msg">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CbTextarea({
  label,
  error,
  className = "",
  ...rest
}: { label: string; error?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`cb-field ${error ? "has-error" : ""} ${className}`}>
      <textarea id={id} placeholder=" " className="cb-input cb-textarea" {...rest} />
      <label htmlFor={id} className="cb-float-label">
        {label}
      </label>
      {error ? <p className="cb-field-msg is-error">{error}</p> : null}
    </div>
  );
}

/* ---------------- Segmented cards (replaces radios / small selects) ---------------- */

export function CbSegmentedCards<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label?: string;
  options: { value: T; title: string; body?: string; icon?: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div className="cb-seg-group" role="radiogroup" aria-label={label}>
      {label ? <span className="cb-microlabel">{label}</span> : null}
      <div className="cb-seg-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`cb-seg-card ${value === o.value ? "is-selected" : ""}`}
            onClick={() => {
              cbHaptic();
              onChange(o.value);
            }}
          >
            {o.icon ? <span className="cb-seg-icon">{o.icon}</span> : null}
            <span className="cb-seg-title">{o.title}</span>
            {o.body ? <span className="cb-seg-body">{o.body}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Chunky checkbox with a self-drawing check ---------------- */

export function CbCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={`cb-check-row ${checked ? "is-checked" : ""}`}
      onClick={() => {
        cbHaptic();
        onChange(!checked);
      }}
    >
      <span className="cb-check-box" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            className="cb-check-path"
            d="M5 12.5 L10 17.5 L19 7"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="cb-check-text">
        <span className="cb-check-label">{label}</span>
        {description ? <span className="cb-check-desc">{description}</span> : null}
      </span>
    </button>
  );
}

/* ---------------- Stepper ---------------- */

export function CbStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Number(v.toFixed(4))));
  return (
    <div className="cb-stepper">
      <span className="cb-microlabel">{label}</span>
      <div className="cb-stepper-row">
        <button
          type="button"
          className="cb-stepper-btn"
          aria-label={`Decrease ${label}`}
          onClick={() => {
            cbHaptic();
            onChange(clamp(value - step));
          }}
        >
          −
        </button>
        <span className="cb-stepper-value cb-num">
          {value.toLocaleString()}
          {suffix ? <span className="cb-stepper-suffix">{suffix}</span> : null}
        </span>
        <button
          type="button"
          className="cb-stepper-btn"
          aria-label={`Increase ${label}`}
          onClick={() => {
            cbHaptic();
            onChange(clamp(value + step));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ---------------- Multi-step progress rail ---------------- */

export function CbProgressRail({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="cb-rail" aria-label={`Step ${current + 1} of ${steps.length}`}>
      <div className="cb-rail-track">
        {steps.map((s, i) => (
          <span key={s} className={`cb-rail-seg ${i <= current ? "is-done" : ""}`} />
        ))}
      </div>
      <div className="cb-rail-labels">
        <span className="cb-microlabel">{steps[current]}</span>
        <span className="cb-microlabel cb-num">
          {current + 1}/{steps.length}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Long-form scroll memory ---------------- */

export function useScrollMemory(key: string) {
  useEffect(() => {
    const storageKey = `cb_scroll_${key}`;
    try {
      const saved = Number(sessionStorage.getItem(storageKey) ?? "0");
      if (saved > 0) window.scrollTo({ top: saved });
    } catch {
      /* ignore */
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          sessionStorage.setItem(storageKey, String(window.scrollY));
        } catch {
          /* ignore */
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);
}

/** Focus (and scroll to) the first invalid field. */
export function focusFirstError(container: HTMLElement | null) {
  const el = container?.querySelector<HTMLElement>("[aria-invalid='true']");
  el?.focus();
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}
