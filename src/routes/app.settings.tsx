import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings · GCN Estimator" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Your account details.</p>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={(user?.user_metadata?.full_name as string) ?? ""} disabled />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-destructive/30 bg-card p-6 shadow-[var(--shadow-sm)]">
        <h2 className="font-semibold text-destructive">Sign out</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign out of your GCN Estimator account.</p>
        <Button variant="outline" className="mt-4" onClick={() => signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
