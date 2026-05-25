// Compatibility shim: maps the shadcn `useToast()` API onto sonner so ported
// components from other projects can keep using `const { toast } = useToast()`.
import { toast as sonner } from "sonner";

type ToastVariant = "default" | "destructive";

interface ToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

function toast(input: ToastInput | string) {
  if (typeof input === "string") {
    sonner(input);
    return;
  }
  const { title, description, variant } = input;
  const msg = title ?? "";
  const opts = description ? { description } : undefined;
  if (variant === "destructive") {
    sonner.error(msg, opts);
  } else {
    sonner(msg, opts);
  }
}

export function useToast() {
  return { toast };
}

export { toast };
