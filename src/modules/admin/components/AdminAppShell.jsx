import { ArrowLeft, BarChart3, BookOpen, GraduationCap, LayoutDashboard, MessageSquare, Shield, Users } from "lucide-react";
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
        <span>{item.path === "/admin" ? "Dashboard" : item.path === "/admin/students" ? "Students" : item.path === "/admin/usage" ? "Usage" : "Feedback"}</span>
      </a>
    );
  });
}

function AdminBrand() {
  return (
    <a className="admin-shell-brand" href="/admin" aria-label="Student Vault Admin dashboard">
      <span className="admin-shell-brand-mark" aria-hidden="true"><GraduationCap size={24} /></span>
      <span><strong>Student Vault</strong><small>Admin workspace</small></span>
    </a>
  );
}

export default function AdminAppShell({ currentPath, children }) {
  return (
    <div className="admin-app-shell">
      <aside className="admin-sidebar">
        <AdminBrand />
        <div className="admin-sidebar-label"><Shield size={15} aria-hidden="true" /><span>ADMIN AREA</span></div>
        <nav className="admin-shell-nav" aria-label="Admin navigation">
          <AdminLinks currentPath={currentPath} />
        </nav>
        <div className="admin-sidebar-foot">
          <span className="admin-prototype-dot" aria-hidden="true" />
          <span><strong>Prototype preview</strong><small>No authorization is active</small></span>
        </div>
      </aside>

      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-topbar-brand"><AdminBrand /></div>
          <div className="admin-account-area" aria-label="Prototype account context">
            <span className="admin-account-avatar" aria-hidden="true">A</span>
            <span className="admin-account-copy"><strong>Admin preview</strong><small>Sample account · no sign-in</small></span>
            <span className="admin-account-state">Prototype</span>
          </div>
        </header>

        <nav className="admin-mobile-nav" aria-label="Admin navigation">
          <AdminLinks currentPath={currentPath} compact />
        </nav>
        <main className="admin-main-content">
          <div className="admin-shell-context"><Shield size={14} aria-hidden="true" /> Prototype workspace · no real admin access <a href="/">Return to student preview <ArrowLeft size={13} aria-hidden="true" /></a></div>
          {children}
        </main>
        <footer className="admin-shell-footer"><BookOpen size={14} aria-hidden="true" /> Student Vault Admin frontend prototype</footer>
      </div>
    </div>
  );
}
