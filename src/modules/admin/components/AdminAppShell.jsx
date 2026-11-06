import { BarChart3, GraduationCap, LayoutDashboard, MessageSquare, Shield, Users } from "lucide-react";
import { adminNavigation } from "../../../routeConfig.js";
import "../styles/admin-shell.css";

const navigationIcons = [LayoutDashboard, Users, BarChart3, MessageSquare];

function activeFor(currentPath, path) {
  return currentPath === path || (path !== "/admin" && currentPath.startsWith(`${path}/`));
}

function AdminLinks({ currentPath, compact = false }) {
  return adminNavigation.map((item, index) => {
    const Icon = navigationIcons[index];
    const active = activeFor(currentPath, item.path);
    return (
      <a
        className={`admin-shell-link${active ? " is-active" : ""}${compact ? " admin-shell-link-compact" : ""}`}
        href={item.path}
        aria-current={active ? "page" : undefined}
        key={item.path}
      >
        <Icon size={compact ? 18 : 19} aria-hidden="true" />
        <span>{item.path === "/admin" ? "Dashboard" : item.path === "/admin/students" ? "Students" : item.path === "/admin/usage" ? "Usage" : "Communications"}</span>
      </a>
    );
  });
}

function AdminBrand() {
  return (
    <a className="admin-shell-brand" href="/admin" aria-label="Vaultori Admin dashboard">
      <span className="admin-shell-brand-mark" aria-hidden="true"><GraduationCap size={24} /></span>
      <span><strong>Vaultori</strong><small>Admin workspace</small></span>
    </a>
  );
}

export default function AdminAppShell({ currentPath, children, onLogout }) {
  return (
    <div className="admin-app-shell">
      <aside className="admin-sidebar">
        <AdminBrand />
        <div className="admin-sidebar-label"><Shield size={15} aria-hidden="true" /><span>ADMIN AREA</span></div>
        <nav className="admin-shell-nav" aria-label="Admin navigation">
          <AdminLinks currentPath={currentPath} />
        </nav>
      </aside>

      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-topbar-brand"><AdminBrand /></div>
        </header>

        <nav className="admin-mobile-nav" aria-label="Admin navigation">
          <AdminLinks currentPath={currentPath} compact />
        </nav>
        <main className="admin-main-content">
          <div className="admin-shell-context">
            <Shield size={14} aria-hidden="true" /> Admin workspace
            <button type="button" className="admin-auth-context-link" onClick={() => onLogout?.("/admin/login")}>Sign out</button>
            <a href="/">Return to Vaultori</a>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
