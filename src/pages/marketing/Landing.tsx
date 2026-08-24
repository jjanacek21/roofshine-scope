import { useEffect, useState } from "react";

const NAV = [
  { label: "Home", href: "/" },
  { label: "The app", href: "/#app" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Resources", href: "/#resources" },
  { label: "Blog", href: "/#blog" },
];

function CbButton({
  variant,
  href,
  children,
}: {
  variant: "primary" | "secondary";
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`cb-btn cb-btn-md cb-btn-${variant}`}
      style={{ whiteSpace: "nowrap", textDecoration: "none" }}
    >
      <span className="cb-specular" />
      <span className="cb-btn-label">{children}</span>
    </a>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px)");
    const apply = () => {
      setCompact(mq.matches);
      if (!mq.matches) setMenuOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const headerH = scrolled ? 58 : 66;

  return (
    <div
      data-cb
      data-cb-theme="light"
      style={{
        minHeight: "100vh",
        background: "var(--cb-bg)",
        color: "var(--cb-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "color-mix(in srgb, var(--cb-bg) 82%, transparent)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: scrolled ? "1px solid var(--cb-hairline)" : "1px solid transparent",
          transition: "height .2s var(--cb-ease), border-color .2s var(--cb-ease)",
        }}
      >
        <div
          style={{
            height: headerH,
            transition: "height .2s var(--cb-ease)",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "var(--cb-text)",
            }}
          >
            <img
              src="/marketing/logo/claimbuddy-mark.png"
              alt="Claim Buddy"
              width={30}
              height={30}
              style={{ width: 30, height: 30, borderRadius: 8, display: "block" }}
            />
            <span style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: 16 }}>
              Claim Buddy
            </span>
          </a>

          {!compact && (
            <nav
              style={{
                display: "flex",
                gap: 22,
                margin: "0 auto",
                alignItems: "center",
              }}
            >
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--cb-text-dim)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {compact && (
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="cb-btn cb-btn-md cb-btn-secondary"
                style={{ width: 44, padding: 0 }}
              >
                <span className="cb-btn-label" style={{ fontSize: 16 }}>
                  {menuOpen ? "✕" : "☰"}
                </span>
              </button>
            )}
            <CbButton variant="secondary" href="/cb/login">
              Log in
            </CbButton>
            <CbButton variant="primary" href="/cb/signup">
              Book a demo
            </CbButton>
          </div>
        </div>

        {compact && menuOpen && (
          <div
            style={{
              borderTop: "1px solid var(--cb-hairline)",
              background: "var(--cb-surface)",
              padding: "10px 18px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "12px 2px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--cb-text)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--cb-hairline)",
                }}
              >
                {n.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1 }} />

      <footer
        className={`cb-reveal ${revealed ? "is-in" : ""}`}
        style={{
          borderTop: "1px solid var(--cb-hairline)",
          background: "var(--cb-surface-2)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "40px 18px 28px",
            display: "grid",
            gap: 28,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div>
            <div
              style={{
                background: "#0f1216",
                border: "1px solid #232a33",
                borderRadius: 14,
                padding: "12px 16px",
                display: "inline-block",
              }}
            >
              <img
                src="/marketing/logo/claimbuddy.png"
                alt="Claim Buddy"
                loading="lazy"
                width={210}
                height={70}
                style={{ width: 210, height: "auto", display: "block" }}
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 14, color: "var(--cb-text-muted)", maxWidth: 280 }}>
              Walk the roof, document the damage, generate the report and close the job — all from
              your phone.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={["The app", "Gallery", "Pricing", "Book a demo"]}
          />
          <FooterCol title="Company" links={["About", "Contact", "Careers", "Blog"]} />
          <FooterCol title="Legal" links={["Privacy", "Terms", "Security"]} />
        </div>

        <div
          style={{
            borderTop: "1px solid var(--cb-hairline)",
            padding: "16px 18px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--cb-text-muted)",
          }}
        >
          © 2026 Global Contractor Network
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--cb-text-muted)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <a
            key={l}
            href="/"
            style={{ fontSize: 14, color: "var(--cb-text-dim)", textDecoration: "none" }}
          >
            {l}
          </a>
        ))}
      </div>
    </div>
  );
}
