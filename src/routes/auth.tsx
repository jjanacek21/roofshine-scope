import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · GCN Estimator" },
      { name: "description", content: "Sign in or create your GCN Estimator account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Please enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/app" });
    }
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-[image:var(--gradient-subtle)]">
      <div className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              <span className="text-lg font-bold text-primary-foreground">R</span>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Welcome to GCN Estimator</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in or create an account to get started</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)]">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <SignInForm />
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <SignUpForm />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailParse = emailSchema.safeParse(email);
    if (!emailParse.success) return toast.error(emailParse.error.issues[0].message);
    if (!password) return toast.error("Password is required");

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailParse.data, password });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.error("Please confirm your email before signing in. Check your inbox.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/app" });
  };

  if (showReset) return <ResetForm onBack={() => setShowReset(false)} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <button type="button" onClick={() => setShowReset(true)} className="text-xs font-medium text-primary hover:underline">
            Forgot?
          </button>
        </div>
        <Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nameParse = nameSchema.safeParse(fullName);
    if (!nameParse.success) return toast.error(nameParse.error.issues[0].message);
    const emailParse = emailSchema.safeParse(email);
    if (!emailParse.success) return toast.error(emailParse.error.issues[0].message);
    const pwParse = passwordSchema.safeParse(password);
    if (!pwParse.success) return toast.error(pwParse.error.issues[0].message);

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: emailParse.data,
      password: pwParse.data,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: nameParse.data },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Account created! Check your email to confirm.");
  };

  if (sent) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
          <MailCheck className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Check your inbox</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input id="signup-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}

function ResetForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parse = emailSchema.safeParse(email);
    if (!parse.success) return toast.error(parse.error.issues[0].message);

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parse.data, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="py-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-success" />
        <h3 className="mt-3 font-semibold">Check your email</h3>
        <p className="mt-1 text-sm text-muted-foreground">If an account exists for {email}, we sent a reset link.</p>
        <Button variant="ghost" className="mt-4" onClick={onBack}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h3 className="font-semibold">Reset your password</h3>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a link.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button type="submit" disabled={busy} className="flex-1">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send link
        </Button>
      </div>
    </form>
  );
}
