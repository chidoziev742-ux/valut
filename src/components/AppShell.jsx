import {
  Bell, BookOpen, ChevronDown, CircleUserRound, File, Folder, Search,
  GraduationCap, Home, LogOut, Settings, Sparkles, Target, Upload, Users,
} from "lucide-react";
import { adminNavigation, studentNavigation } from "../routeConfig.js";

function Brand({ compact = false }) {
  return (
    <div className={"brand " + (compact ? "brand-compact" : "")}>
      <span className="brand-mark" aria-hidden="true"><GraduationCap size={25} strokeWidth={2.3} /></span>
      <span className="brand-copy">
        <strong>Student Vault</strong>
        {!compact && <small>Your university life,<br /> organized in one place.</small>}
      </span>
    </div>
  );
}

const studentIcons = {
  Home, "My Documents": File, "Academic Records": BookOpen, Upload,
  Folders: Folder, Goals: Target, Reminders: Bell, Profile: CircleUserRound, Settings,
};

function RouteLink({ path, label, icon: Icon, currentPath, deferred = false }) {
  const active = currentPath === path || (path !== "/" && currentPath.startsWith(path + "/"));
  return (
    <a
      className={"nav-link " + (active ? "active" : "")}
      href={path}
      aria-current={active ? "page" : undefined}
      aria-label={deferred ? label + " (deferred feature)" : undefined}
    >
      {Icon && <Icon size={20} />}
      <span>{label}</span>
      {deferred && <span className="nav-deferred">Later</span>}
    </a>
  );
}

function Sidebar({ currentPath }) {
  const primary = studentNavigation.filter((item) => item.group === "student");
  const account = studentNavigation.filter((item) => item.group === "account");
  return (
    <aside className="sidebar">
      <a className="brand-link" href="/" aria-label="Student Vault home"><Brand /></a>
      <nav aria-label="Student navigation" className="side-nav">
        {primary.map((item) => <RouteLink key={item.path} {...item} icon={studentIcons[item.label]} currentPath={currentPath} />)}
      </nav>
      <div className="sidebar-divider" />
      <nav aria-label="Account navigation" className="side-nav secondary-nav">
        {account.map((item) => <RouteLink key={item.path} {...item} icon={studentIcons[item.label]} currentPath={currentPath} />)}
      </nav>
      <div className="sidebar-divider admin-divider" />
      <nav aria-label="Admin navigation" className="side-nav admin-nav">
        <p className="nav-group-label"><Users size={15} /> Admin area</p>
        {adminNavigation.map((item) => <RouteLink key={item.path} {...item} icon={Users} currentPath={currentPath} />)}
      </nav>
      <div className="sidebar-note"><Sparkles size={17} /><p>Organize today for a brighter tomorrow.</p><span /></div>
      <div className="side-botanical" aria-hidden="true"><span /><span /><span /></div>
    </aside>
  );
}

function SearchBox({ query, setQuery, mobile = false, enabled = true }) {
  return (
    <label className={"search-box " + (mobile ? "" : "desktop-search")}>
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">{enabled ? "Search sample documents" : "Search unavailable on this placeholder screen"}</span>
      <input disabled={!enabled} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={enabled ? (mobile ? "Search documents..." : "Search documents, folders or records...") : "Search is not available on this placeholder"} />
    </label>
  );
}

function Topbar({ query, setQuery, onNotice, searchEnabled, profile }) {
  const initials = (profile?.fullName || "Student").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <SearchBox query={query} setQuery={setQuery} enabled={searchEnabled} />
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications (prototype)" onClick={onNotice}><Bell size={21} /><i className="notification-dot" /></button>
        <details className="profile-dropdown">
          <summary className="profile-chip" aria-label="Open profile menu">
          <span className="avatar">{initials}</span>
          <span className="profile-text"><strong>{profile?.fullName || "Student"}</strong><small>Student · sample</small></span>
          <ChevronDown size={16} />
          </summary>
          <nav className="profile-menu" aria-label="Profile options">
            <a href="/profile"><CircleUserRound size={17} /> Profile</a>
            <a href="/settings"><Settings size={17} /> Settings</a>
            <div className="profile-menu-divider" />
            <a className="profile-signout" href="/welcome?prototypeSignOut=1"><LogOut size={17} /> Sign out <small>Prototype</small></a>
          </nav>
        </details>
      </div>
    </header>
  );
}

function MobileNavigation({ currentPath }) {
  const mobileItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Documents", path: "/documents", icon: File },
    { label: "Goals", path: "/goals", icon: Target, deferred: true },
    { label: "Profile", path: "/profile", icon: CircleUserRound },
  ];
  return (
    <nav aria-label="Mobile navigation" className="mobile-nav">
      {mobileItems.slice(0, 2).map((item) => <RouteLink key={item.path} {...item} currentPath={currentPath} />)}
      <a className="mobile-add" href="/upload" aria-label="Go to upload placeholder"><span aria-hidden="true">+</span></a>
      {mobileItems.slice(2).map((item) => <RouteLink key={item.path} {...item} currentPath={currentPath} />)}
    </nav>
  );
}

export default function AppShell({ currentPath, query, setQuery, onNotice, searchEnabled, profile, children }) {
  return (
    <div className="app-shell">
      <Sidebar currentPath={currentPath} />
      <main className="main-area">
        <Topbar query={query} setQuery={setQuery} onNotice={onNotice} searchEnabled={searchEnabled} profile={profile} />
        <div className="mobile-brandbar">
          <a className="brand-link" href="/" aria-label="Student Vault home"><Brand compact /></a>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications (prototype)" onClick={onNotice}><Bell size={20} /><i className="notification-dot" /></button>
            <a href="/profile" aria-label="View student profile"><span className="avatar">{(profile?.fullName || "Student").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span></a>
          </div>
        </div>
        <div className="mobile-search"><SearchBox query={query} setQuery={setQuery} mobile enabled={searchEnabled} /></div>
        {children}
      </main>
      <MobileNavigation currentPath={currentPath} />
    </div>
  );
}
