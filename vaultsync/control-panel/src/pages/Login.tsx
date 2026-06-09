import React, { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Shield, ShieldCheck, Lock, Activity, LogIn } from "lucide-react";
import { colors } from "../styles/theme";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";

const inputStyle: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 8,
  padding: "11px 12px", color: colors.textPrimary, fontSize: 14, width: "100%", outline: "none",
};

const FEATURES = [
  { icon: ShieldCheck, title: "Proven restorable", desc: "Every backup is auto-restored into a throwaway database and integrity-checked — not just stored." },
  { icon: Lock, title: "Encrypted end-to-end", desc: "AES-256-GCM before upload, so storage only ever holds ciphertext." },
  { icon: Activity, title: "Live monitoring & alerts", desc: "Failures, latency-SLA breaches, and stale nodes surfaced in real time." },
];

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/";
  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in.");
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap", background: colors.bg }}>
      {/* ── Brand panel ────────────────────────────────────────────── */}
      <div style={{
        flex: "1 1 460px", minHeight: "100vh", position: "relative",
        background: `radial-gradient(1100px 560px at -10% -15%, ${colors.blueDim} 0%, transparent 55%), linear-gradient(160deg, #010409 0%, #0b1220 60%, #0d1117 100%)`,
        borderRight: `1px solid ${colors.border}`,
        display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 56px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 44 }}>
          <div style={{ width: 44, height: 44, background: colors.blue, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 26px ${colors.blue}55` }}>
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, letterSpacing: 0.3 }}>Restora</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Backups, Proven Restorable</div>
          </div>
        </div>

        <h1 style={{ fontSize: 34, lineHeight: 1.15, fontWeight: 800, color: colors.textPrimary, maxWidth: 470, marginBottom: 14 }}>
          Backups you can <span style={{ color: colors.green }}>actually recover</span>.
        </h1>
        <p style={{ fontSize: 15, color: colors.textSecondary, maxWidth: 440, marginBottom: 38, lineHeight: 1.6 }}>
          Restora doesn't just store your data — it continuously proves every backup
          is restorable, encrypted end-to-end, on one live operations dashboard.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 470 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 9, background: colors.bgCard, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: colors.green }}>
                <f.icon size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{f.title}</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 26, left: 56, fontSize: 12, color: colors.textMuted }}>
          © 2026 Restora · Disaster Recovery Platform
        </div>
      </div>

      {/* ── Sign-in panel ──────────────────────────────────────────── */}
      <div style={{ flex: "1 1 420px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: 360, maxWidth: "100%" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>Sign in</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 26 }}>Access your backup control plane.</div>

          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Email</label>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restora.io" style={{ ...inputStyle, marginBottom: 16 }} />

            <label style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, marginBottom: 24 }} />

            <button type="submit" disabled={busy || !email || !password} style={{
              width: "100%", background: !email || !password ? colors.bgCardHover : colors.blue,
              border: "none", borderRadius: 8, padding: "12px", color: !email || !password ? colors.textSecondary : "#fff",
              fontWeight: 600, fontSize: 14, cursor: busy || !email || !password ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.85 : 1,
            }}>
              {busy ? <Spinner size={15} /> : <LogIn size={16} />}
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 22, fontSize: 12, color: colors.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={12} /> Secured with httpOnly-cookie sessions &amp; CSRF protection
          </div>
        </div>
      </div>
    </div>
  );
}
