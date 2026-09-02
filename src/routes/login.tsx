import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dumbbell, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLoggedIn, login } from "@/lib/gym/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Secure offline admin sign in for the IRONVAULT gym management suite: members, memberships, payments and inventory.",
      },
      { property: "og:title", content: "Admin Sign In — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Secure offline admin sign in for the IRONVAULT gym management suite.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) navigate({ to: "/" });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || password.length < 4) {
      setError("Enter a valid email and password (min 4 characters).");
      return;
    }
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) navigate({ to: "/" });
    else setError("Invalid credentials. Please try again.");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full opacity-25 blur-[120px]"
        style={{ background: "var(--gradient-gold)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-52 -right-32 h-[460px] w-[460px] rounded-full opacity-15 blur-[130px]"
        style={{ background: "var(--gradient-gold)" }}
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-[image:var(--gradient-surface)] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-gold)] text-primary-foreground">
              <Dumbbell className="h-5 w-5" />
            </div>
            <p className="font-display text-2xl tracking-[0.22em] text-gradient-gold">IRONVAULT</p>
          </div>
          <div>
            <h2 className="font-display text-5xl leading-[1.05] tracking-wide">
              Run your gym like a<br />
              <span className="text-gradient-gold">premium brand.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Members, memberships, payments, inventory and reporting — all in one elegant, fully
              offline workspace. No cloud, no external services.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-6 text-center">
            {[
              ["100%", "Offline"],
              ["0", "External APIs"],
              ["1", "Admin role"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="font-display text-2xl text-gold">{v}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center bg-card p-8 sm:p-10 lg:min-h-[560px]">
          <h1 className="font-display text-3xl tracking-wide">Admin Sign In</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials to access the management suite.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  value={email}
                  autoComplete="username"
                  placeholder="you@yourgym.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
