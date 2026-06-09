import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, Database, Key, Server, Pause, Play, RefreshCw } from "lucide-react";
import { api, BackupRecord, NodeRecord, AppSettings } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { KpiCard } from "../components/KpiCard";
import { BackupHeatmap } from "../components/BackupHeatmap";
import { BackupLogTable } from "../components/BackupLogTable";
import { ConfirmModal } from "../components/ConfirmModal";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import { formatHMS, formatBytes } from "../lib/format";
import { secondsUntilNextRun } from "../lib/cron";

const PRIMARY_NODE = "us-east-prod-01";
const REFRESH_MS = 10000;

export function Dashboard() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, forceTick] = useState(0);
  const toast = useToast();
  const { hasRole } = useAuth();
  const canTrigger = hasRole("SysAdmin", "BusinessOwner");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, n, s] = await Promise.all([
        api.getBackups(30),
        api.getNodes(),
        api.getSettings(),
      ]);
      setBackups(b);
      setNodes(n);
      setSettings(s);
      setLastUpdated(new Date());
    } catch {
      /* keep last good data */
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Polling when auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // Tick the "updated Ns ago" label once a second
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const agoLabel = lastUpdated
    ? `${Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))}s ago`
    : "—";

  const passCount = backups.filter((b) => b.status === "pass").length;
  const failCount = backups.filter((b) => b.status === "fail" || b.status === "critical_failure").length;
  const allHealthy = failCount === 0 && backups.length > 0;
  // db_size_bytes is a Postgres BIGINT, which arrives as a string — coerce to a
  // number so this sums instead of string-concatenating (which produced "Infinity TB").
  const totalBytes = backups.reduce((s, b) => s + Number(b.db_size_bytes ?? 0), 0);

  // Real KPI derivations
  const activeNodes = nodes.filter((n) => n.status === "connected").length;
  const totalNodes = nodes.length;

  const rotationRemaining = settings?.key_rotated_at
    ? Math.round(settings.key_rotation_days - (Date.now() - new Date(settings.key_rotated_at).getTime()) / 86400000)
    : null;
  const rotationValid = rotationRemaining == null || rotationRemaining > 0;

  // Countdown to the next scheduled backup, derived from the real cron expression
  const countdown = formatHMS(settings ? secondsUntilNextRun(settings.cron_schedule) : null);

  async function confirmTrigger() {
    setTriggering(true);
    try {
      await api.triggerBackup(PRIMARY_NODE);
      toast.success(`Manual sync queued for ${PRIMARY_NODE}.`);
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue manual sync.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <TopBar />
      <div style={{ padding: 24 }}>
        {/* Live refresh control bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textSecondary }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: autoRefresh ? colors.green : colors.textMuted, boxShadow: autoRefresh ? `0 0 6px ${colors.green}` : "none" }} />
            {autoRefresh ? "Live" : "Paused"} · updated {agoLabel}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh now"
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "6px 10px", cursor: refreshing ? "default" : "pointer", color: colors.textSecondary, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "vs-spin 0.7s linear infinite" : "none" }} />
            Refresh
          </button>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: colors.textSecondary, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            {autoRefresh ? <Pause size={13} /> : <Play size={13} />}
            {autoRefresh ? "Pause" : "Resume"}
          </button>
        </div>

        {/* Hero banner */}
        <div style={{
          background: colors.bgCard, border: `1px solid ${allHealthy ? colors.greenDim : colors.redDim}`,
          borderRadius: 8, padding: "20px 24px", marginBottom: 20,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {allHealthy
              ? <CheckCircle size={40} color={colors.green} />
              : <XCircle size={40} color={colors.red} />}
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>
                {loading ? "Loading..." : allHealthy ? "All Nodes Validated" : `${failCount} Backup${failCount !== 1 ? "s" : ""} Failed`}
              </div>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, maxWidth: 480 }}>
                {allHealthy
                  ? `Your enterprise backup mesh is fully operational. ${passCount} backups are reporting healthy status with zero integrity failures in the last 24 hours.`
                  : `${failCount} backup(s) require attention. Check the logs below for details.`}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Next Sync Cycle</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, fontFamily: "monospace" }}>{countdown}</div>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={triggering || !canTrigger}
              title={canTrigger ? undefined : "Requires SysAdmin or BusinessOwner role"}
              style={{ marginTop: 8, background: canTrigger ? colors.blue : colors.bgCardHover, border: "none", borderRadius: 6, padding: "8px 16px", color: canTrigger ? "#fff" : colors.textSecondary, fontWeight: 600, cursor: triggering || !canTrigger ? "default" : "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8, opacity: triggering ? 0.85 : 1 }}
            >
              {triggering && <Spinner size={13} />}
              {triggering ? "Queuing…" : "Trigger Manual Sync"}
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <KpiCard
            label="Global Integrity"
            value={backups.length ? `${((passCount / backups.length) * 100).toFixed(2)}%` : "—"}
            sub={passCount + " verified"}
            accentColor={colors.green}
            icon={<CheckCircle size={16} />}
          />
          <KpiCard
            label="Total Data Secured"
            value={totalBytes ? formatBytes(totalBytes) : "—"}
            sub="Across all zones"
            accentColor={colors.blue}
            icon={<Database size={16} />}
          />
          <KpiCard
            label="Key Rotation Status"
            value={rotationRemaining == null ? "—" : rotationValid ? "Valid" : "Rotate now"}
            sub={rotationRemaining == null ? "" : rotationValid ? `Expire ${rotationRemaining}d` : "Overdue"}
            accentColor={rotationValid ? colors.yellow : colors.red}
            icon={<Key size={16} />}
          />
          <KpiCard
            label="Active Edge Nodes"
            value={totalNodes ? `${activeNodes}/${totalNodes}` : "—"}
            sub={activeNodes === totalNodes ? "All online" : `${totalNodes - activeNodes} offline`}
            accentColor={activeNodes === totalNodes ? colors.green : colors.orange}
            icon={<Server size={16} />}
          />
        </div>

        {/* Heatmap */}
        <div style={{ marginBottom: 20 }}>
          <BackupHeatmap backups={backups} />
        </div>

        {/* Log table */}
        <BackupLogTable backups={backups} />
      </div>

      {confirmOpen && (
        <ConfirmModal
          title="Trigger manual sync?"
          message={
            <>
              This queues an immediate full snapshot on <strong style={{ color: colors.textPrimary }}>{PRIMARY_NODE}</strong>,
              outside the normal schedule. The node will extract, encrypt, and upload a fresh backup for validation.
            </>
          }
          confirmLabel="Trigger Sync"
          loading={triggering}
          onConfirm={confirmTrigger}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
