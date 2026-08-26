import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";

export function AddCustomerDialog({
  companyId,
  open,
  onClose,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rk_accounts").insert({
        company_id: companyId,
        name: name.trim(),
        primary_contact: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer added");
      qc.invalidateQueries({ queryKey: ["rk", "accounts"] });
      setName(""); setContact(""); setPhone(""); setEmail(""); setCity("");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!open) return null;
  return (
    <div data-rk className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(5,7,12,0.7)" }} onClick={onClose}>
      <div className="rk-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="rk-display text-lg">Add Customer</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--rk-panel-2)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Customer Name *"><input className="rk-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Primary Contact"><input className="rk-input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className="rk-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="City"><input className="rk-input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          </div>
          <Field label="Email"><input type="email" className="rk-input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rk-btn rk-btn-ghost">Cancel</button>
          <button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rk-btn rk-btn-primary"
          >{create.isPending ? "Saving…" : "Create Customer"}</button>
        </div>
      </div>
    </div>
  );
}

export function AddBuildingDialog({
  companyId,
  accountId,
  open,
  onClose,
}: {
  companyId: string;
  accountId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [roofType, setRoofType] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rk_properties").insert({
        company_id: companyId,
        account_id: accountId,
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        roof_type: roofType || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Building added");
      qc.invalidateQueries({ queryKey: ["rk", "properties"] });
      setName(""); setAddress(""); setCity(""); setState("FL"); setZip(""); setRoofType("");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!open) return null;
  return (
    <div data-rk className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(5,7,12,0.7)" }} onClick={onClose}>
      <div className="rk-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="rk-display text-lg">Add Building</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--rk-panel-2)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Building Name *"><input className="rk-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Suite 200 Building" /></Field>
          <Field label="Address"><input className="rk-input" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input className="rk-input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            <Field label="State"><input className="rk-input" value={state} onChange={(e) => setState(e.target.value)} /></Field>
            <Field label="Zip"><input className="rk-input" value={zip} onChange={(e) => setZip(e.target.value)} /></Field>
          </div>
          <Field label="Roof Type">
            <select className="rk-input" value={roofType} onChange={(e) => setRoofType(e.target.value)}>
              <option value="">—</option>
              {["TPO","Modified Bitumen","Built-Up","Shingle","Metal","EPDM","Tile","Other"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rk-btn rk-btn-ghost">Cancel</button>
          <button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="rk-btn rk-btn-primary">
            {create.isPending ? "Saving…" : "Create Building"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="rk-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
