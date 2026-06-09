import React, { useState, useEffect } from "react";
import { colors } from "../styles/theme";
import { AlertTriangle, Eye, EyeOff, Download, Printer, Copy, X } from "lucide-react";
import { KeyData } from "../api/client";
import { useToast } from "./Toast";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { downloadFile } from "../lib/format";

interface Props {
  keyData: KeyData;
  onClose: () => void;
}

export function EmergencyKeyModal({ keyData, onClose }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const toast = useToast();

  useEscapeKey(onClose);

  useEffect(() => {
    if (!revealed) return;
    setCountdown(10);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); setRevealed(false); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [revealed]);

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(keyData.fullKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Decryption key copied to clipboard.");
    } catch {
      toast.error("Could not access clipboard. Copy the key manually.");
    }
  }

  function handleDownload() {
    try {
      downloadFile(
        `restora-key-${keyData.id}.txt`,
        `Restora Emergency Decryption Key\nID: ${keyData.id}\n\n${keyData.fullKey}\n\nRotate every 90 days. Keep offline.\n`,
        "text/plain"
      );
      toast.success("Key downloaded as .txt — store it offline.");
    } catch {
      toast.error("Download failed. Please try again.");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(1,4,9,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "#161b22", border: `1px solid ${colors.border}`,
        borderRadius: 12, padding: 32, width: 520, maxWidth: "95vw",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertTriangle size={24} color={colors.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>Emergency Decryption Key</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Critical Security Asset • Action Required</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary }}>
            <X size={18} />
          </button>
        </div>

        {/* Warning box */}
        <div style={{ background: colors.orangeDim, border: `1px solid ${colors.orange}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ color: colors.orange, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Access Restricted.{" "}
            <span style={{ color: colors.textPrimary, fontWeight: 400 }}>
              This key is the only way to recover your data in the event of a system failure. Loss of this key will result in permanent data loss.
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {["Keep offline in a physical safe", "Do not share via email or chat", "Rotate every 90 days"].map((tip) => (
              <div key={tip} style={{ fontSize: 12, color: colors.textSecondary, display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: colors.orange }}>⊙</span> {tip}
              </div>
            ))}
          </div>
        </div>

        {/* Key field */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Private Decryption Key
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#010409", border: `1px solid ${colors.border}`,
            borderRadius: 6, padding: "10px 14px",
          }}>
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: 14, color: colors.textPrimary, letterSpacing: revealed ? 0 : 4 }}>
              {revealed ? keyData.fullKey : "•".repeat(Math.min(keyData.fullKey.length, 32))}
            </span>
            <button
              onClick={() => setRevealed((r) => !r)}
              style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "4px 10px", cursor: "pointer", color: colors.textSecondary, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealed ? `HIDE (${countdown}s)` : "SHOW"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleDownload}
            style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px", cursor: "pointer", color: colors.textPrimary, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <Download size={20} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Download .txt</span>
            <span style={{ fontSize: 11, color: colors.textSecondary }}>ENCRYPTED LOCAL COPY</span>
          </button>
          <button
            onClick={() => window.print()}
            style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px", cursor: "pointer", color: colors.textPrimary, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <Printer size={20} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Print Key</span>
            <span style={{ fontSize: 11, color: colors.textSecondary }}>OFFLINE STORAGE RECOMMENDED</span>
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: "monospace" }}>
            ID: {keyData.id}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: colors.textSecondary, fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              style={{ background: colors.blue, border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Copy size={14} />
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
