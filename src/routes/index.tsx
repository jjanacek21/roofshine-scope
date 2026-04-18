import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Calculator, FileText, Zap, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GCN Estimator — Estimating Software for Roofing Contractors" },
      {
        name: "description",
        content:
          "Build accurate roofing estimates in minutes. The modern estimating platform built for professional roofing contractors.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">GCN Estimator</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[image:var(--gradient-subtle)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-sm)]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Built for professional roofing contractors
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Estimates that close{" "}
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              more jobs
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Stop wrestling with spreadsheets. GCN Estimator turns roof measurements into
            polished, accurate estimates your customers will actually sign — in minutes, not hours.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="gap-2 shadow-[var(--shadow-md)]">
                Start your free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">See how it works</Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required · 14-day free trial</p>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <div className="rounded-2xl border border-border bg-surface-elevated p-2 shadow-[var(--shadow-lg)]">
            <div className="rounded-xl bg-[image:var(--gradient-hero)] p-12 text-primary-foreground">
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: "Avg. estimate time", value: "8 min" },
                  { label: "Win rate uplift", value: "+34%" },
                  { label: "Contractors trust us", value: "2,400+" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-3xl font-bold tracking-tight sm:text-4xl">{s.value}</div>
                    <div className="mt-1 text-sm opacity-80">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Calculator,
      title: "Smart calculations",
      desc: "Automatic material counts, waste factors, and labor pricing tailored to your business.",
    },
    {
      icon: FileText,
      title: "Beautiful proposals",
      desc: "Branded, itemized estimates that look professional and convert at a higher rate.",
    },
    {
      icon: Zap,
      title: "Built for speed",
      desc: "From measurement to signed contract in minutes. No more late-night spreadsheet sessions.",
    },
    {
      icon: ShieldCheck,
      title: "Audit-ready records",
      desc: "Every estimate, revision, and approval is tracked. Stay organized for taxes and disputes.",
    },
  ];

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Features</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Everything you need to estimate faster</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Purpose-built for roofers. No bloat, no learning curve.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-[var(--transition-smooth)] hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-[var(--transition-smooth)] group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Add your customer", d: "Capture contact info and project address in seconds." },
    { n: "02", t: "Enter roof details", d: "Square footage, pitch, and any job-specific notes." },
    { n: "03", t: "Send the estimate", d: "Polished, branded, signature-ready. Win the job." },
  ];
  return (
    <section id="how" className="border-y border-border bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">From lead to signed in three steps</h2>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-sm)]">
              <div className="text-4xl font-bold text-primary/30">{s.n}</div>
              <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="overflow-hidden rounded-3xl bg-[image:var(--gradient-hero)] p-12 text-center shadow-[var(--shadow-lg)] sm:p-16">
          <h2 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            Ready to estimate faster?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85">
            Join thousands of contractors winning more jobs with GCN Estimator.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="gap-2">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <ul className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/85">
            {["No credit card", "14-day trial", "Cancel anytime"].map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="h-4 w-4" /> {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} GCN Estimator. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}
