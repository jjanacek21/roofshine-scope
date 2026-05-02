import { createContext, useContext, useState, type ReactNode } from "react";

export interface PlaybookLeadContext {
  id: string;
  address: string;
  city?: string | null;
  owner?: string | null;
  sqft?: number | null;
  roof_type?: string | null;
  year_built?: string | null;
}

interface CallPlaybookContextValue {
  open: boolean;
  lead: PlaybookLeadContext | null;
  openFor: (lead: PlaybookLeadContext | null) => void;
  close: () => void;
}

const Ctx = createContext<CallPlaybookContextValue | undefined>(undefined);

export function CallPlaybookProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<PlaybookLeadContext | null>(null);
  return (
    <Ctx.Provider
      value={{
        open,
        lead,
        openFor: (l) => {
          setLead(l);
          setOpen(true);
        },
        close: () => setOpen(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCallPlaybook() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCallPlaybook must be used inside CallPlaybookProvider");
  return ctx;
}
