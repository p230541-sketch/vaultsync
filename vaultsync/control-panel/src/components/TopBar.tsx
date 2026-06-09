import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, HelpCircle, Search, CheckCheck, Check } from "lucide-react";
import { colors } from "../styles/theme";
import { useToast } from "./Toast";
import { api, Alert } from "../api/client";
import { SEVERITY } from "../lib/severity";
import { timeAgo } from "../lib/format";
import { usePolling } from "../hooks/usePolling";

interface Props {
  title?: string;
  subtitle?: React.ReactNode;
}

const ALERTS_POLL_MS = 15000;

export function TopBar({ title, subtitle }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function loadAlerts() {
    const data = await api.getAlerts(50);
    setAlerts(data.alerts);
    setUnread(data.unread);
  }

  usePolling(loadAlerts, ALERTS_POLL_MS);

  // Close the panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) { toast.warning("Enter a node name or archive to search."); return; }
    toast.info(`Searching nodes for "${q}"…`);
    navigate(`/nodes?q=${encodeURIComponent(q)}`);
  }

  async function ackOne(id: string) {
    await api.ackAlert(id);
    loadAlerts();
  }
  async function ackAll() {
    await api.ackAllAlerts();
    loadAlerts();
    toast.success("All notifications marked read.");
  }

  return (
    <div style={{
      height: 56, background: colors.bgSidebar, borderBottom: `1px solid ${colors.border}`,
      display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
      position: "sticky", top: 0, zIndex: 90,
    }}>
      {title ? (
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{title}</span>
          {subtitle && <span style={{ marginLeft: 10 }}>{subtitle}</span>}
        </div>
      ) : (
        <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "6px 12px", maxWidth: 360 }}>
          <button type="submit" aria-label="Search" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
            <Search size={14} color={colors.textSecondary} />
          </button>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search backup archives or nodes..."
            style={{ background: "none", border: "none", outline: "none", color: colors.textPrimary, fontSize: 13, width: "100%" }} />
        </form>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Notifications bell + panel */}
        <div style={{ position: "relative" }} ref={panelRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Notifications"
            style={{ background: "none", border: "none", cursor: "pointer", color: open ? colors.textPrimary : colors.textSecondary, display: "flex", position: "relative", padding: 2 }}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -5, minWidth: 15, height: 15, padding: "0 3px",
                background: colors.red, color: "#fff", borderRadius: 8, fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div style={{
              position: "absolute", top: 32, right: 0, width: 380, maxHeight: 460, overflowY: "auto",
              background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8,
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 200,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${colors.border}`, position: "sticky", top: 0, background: colors.bgCard }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                  Notifications {unread > 0 && <span style={{ color: colors.textSecondary, fontWeight: 400 }}>· {unread} unread</span>}
                </span>
                {unread > 0 && (
                  <button onClick={ackAll} style={{ background: "none", border: "none", cursor: "pointer", color: colors.blue, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: colors.textSecondary, fontSize: 13 }}>
                  No notifications.
                </div>
              ) : (
                alerts.map((a) => {
                  const { color, Icon } = SEVERITY[a.severity];
                  return (
                    <div key={a.id} style={{
                      display: "flex", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${colors.borderMuted}`,
                      background: a.acknowledged ? "transparent" : "rgba(56,139,253,0.06)",
                    }}>
                      <span style={{ color, flexShrink: 0, marginTop: 1 }}><Icon size={15} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.4 }}>{a.message}</div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                          {a.node_id ? `${a.node_id} · ` : ""}{timeAgo(a.created_at)}
                        </div>
                      </div>
                      {!a.acknowledged && (
                        <button onClick={() => ackOne(a.id)} title="Mark read" style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex", flexShrink: 0, padding: 2 }}>
                          <Check size={15} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <button onClick={() => toast.info("Restora support: docs.restora.io · L3 on-call 24/7.")} aria-label="Help"
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex" }}>
          <HelpCircle size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: colors.greenDim, borderRadius: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors.green }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.green }}>SYSTEM LIVE</span>
        </div>
      </div>
    </div>
  );
}
