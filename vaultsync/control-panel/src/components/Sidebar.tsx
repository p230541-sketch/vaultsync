import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Server, Key, Settings, Shield, LogOut, Users, Bell, ScrollText } from "lucide-react";
import { colors } from "../styles/theme";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
  { to: "/nodes", icon: <Server size={20} />, label: "Edge Nodes" },
  { to: "/alerts", icon: <Bell size={20} />, label: "Alerts" },
  { to: "/keys", icon: <Key size={20} />, label: "Security Keys" },
  { to: "/users", icon: <Users size={20} />, label: "Users", sysAdminOnly: true },
  { to: "/audit", icon: <ScrollText size={20} />, label: "Audit Log", sysAdminOnly: true },
  { to: "/settings", icon: <Settings size={20} />, label: "Settings" },
];

export function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const navItems = NAV.filter((item) => !item.sysAdminOnly || hasRole("SysAdmin"));
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside style={{
      width: 220, background: colors.bgSidebar, borderRight: `1px solid ${colors.border}`,
      display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: colors.blue, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Restora</div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>Proven Restorable</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 12,
              padding: "9px 12px", borderRadius: 6, textDecoration: "none",
              color: isActive ? colors.textPrimary : colors.textSecondary,
              background: isActive ? colors.bgCard : "transparent",
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              transition: "all 0.15s",
            })}
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: "16px 12px", borderTop: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 12px" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: colors.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name ?? "—"}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase" }}>{user?.role ?? ""}</div>
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 6,
            padding: "9px 12px", cursor: "pointer", color: colors.textSecondary,
            fontSize: 13, fontWeight: 600,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = colors.red; e.currentTarget.style.borderColor = colors.red; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.borderColor = colors.border; }}
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
