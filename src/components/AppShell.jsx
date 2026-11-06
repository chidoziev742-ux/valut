import { useEffect, useRef, useState } from "react";
import {
  Bell, BookOpen, Check, CheckCheck, ChevronDown, CircleUserRound, File, Folder,
  Search, GraduationCap, Home, LogOut, RefreshCw, Settings, Sparkles, Target,
  Upload, Users, X,
} from "lucide-react";
import { studentNavigation } from "../routeConfig.js";
import { formatNotificationDate, formatUnreadNotificationCount } from "../modules/notifications/notificationApi.js";

function Brand({ compact = false }) {
  return (
    <div className={"brand " + (compact ? "brand-compact" : "")}>
      <span className="brand-mark" aria-hidden="true"><GraduationCap size={25} strokeWidth={2.3} /></span>
      <span className="brand-copy">
        <strong>Vaultori</strong>
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
    >
      {Icon && <Icon size={20} />}
      <span>{label}</span>
    </a>
  );
}

function Sidebar({ currentPath }) {
  const primary = studentNavigation.filter((item) => item.group === "student");
  const account = studentNavigation.filter((item) => item.group === "account");
  return (
    <aside className="sidebar">
      <a className="brand-link" href="/" aria-label="Vaultori home"><Brand /></a>
      <nav aria-label="Student navigation" className="side-nav">
        {primary.map((item) => <RouteLink key={item.path} {...item} icon={studentIcons[item.label]} currentPath={currentPath} />)}
      </nav>
      <div className="sidebar-divider" />
      <nav aria-label="Account navigation" className="side-nav secondary-nav">
        {account.map((item) => <RouteLink key={item.path} {...item} icon={studentIcons[item.label]} currentPath={currentPath} />)}
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
      <span className="sr-only">Search documents</span>
      <input disabled={!enabled} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mobile ? "Search documents..." : "Search documents, folders or records..."} />
    </label>
  );
}

function NotificationBell({ unreadCount, onClick, expanded, mobile = false }) {
  const badge = formatUnreadNotificationCount(unreadCount);
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
  return (
    <button
      className="icon-button notification-trigger"
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      data-notification-trigger
    >
      <Bell size={mobile ? 20 : 21} />
      {badge && <span className="notification-count" aria-hidden="true">{badge}</span>}
    </button>
  );
}

function NotificationCentre({
  open,
  notifications,
  unreadCount,
  request,
  busyNotificationId,
  markingAllRead,
  onClose,
  onRetry,
  onMarkRead,
  onDelete,
  onMarkAllRead,
  onSelect,
}) {
  const panelRef = useRef(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (event.type === "keydown") {
        if (event.key === "Escape") onClose();
        return;
      }
      if (event.target.closest?.("[data-notification-trigger]")) return;
      if (!panelRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [onClose, open]);

  if (!open) return null;

  const handleMarkRead = async (notification) => {
    setActionError("");
    try {
      await onMarkRead(notification.id);
    } catch (error) {
      setActionError(error.message || "We couldn't update this notification. Please try again.");
    }
  };
  const handleMarkAllRead = async () => {
    setActionError("");
    try {
      await onMarkAllRead();
    } catch (error) {
      setActionError(error.message || "We couldn't update your notifications. Please try again.");
    }
  };
  const handleSelect = async (notification) => {
    setActionError("");
    try {
      await onSelect(notification);
      onClose();
    } catch (error) {
      setActionError(error.message || "We couldn't open this notification. Please try again.");
    }
  };
  const handleDelete = async (notification) => {
    setActionError("");
    try {
      await onDelete(notification);
    } catch (error) {
      setActionError(error.message || "We couldn't delete this notification. Please try again.");
    }
  };

  return (
    <section id="notification-centre" ref={panelRef} className="notification-panel" role="dialog" aria-modal="false" aria-labelledby="notification-panel-title">
      <header className="notification-panel-header">
        <div><p className="notification-panel-eyebrow">YOUR UPDATES</p><h2 id="notification-panel-title">Notifications</h2></div>
        <div className="notification-panel-header-actions">
          {unreadCount > 0 && <button className="notification-mark-all" type="button" onClick={handleMarkAllRead} disabled={markingAllRead}><CheckCheck size={15} /> Mark all read</button>}
          <button className="notification-close" type="button" onClick={onClose} aria-label="Close notifications"><X size={18} /></button>
        </div>
      </header>
      {actionError && <p className="notification-action-error" role="alert">{actionError}</p>}
      {request.status === "loading" && notifications.length === 0 ? (
        <div className="notification-state" role="status">Loading notifications…</div>
      ) : request.status === "error" && notifications.length === 0 ? (
        <div className="notification-state notification-state-error" role="alert">
          <p>{request.error}</p>
          <button className="notification-retry" type="button" onClick={onRetry}><RefreshCw size={15} /> Try again</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="notification-state notification-empty">
          <span className="notification-empty-icon"><Bell size={21} /></span>
          <strong>You're all caught up</strong>
          <span>New updates will appear here.</span>
        </div>
      ) : (
        <>
          {request.status === "loading" && <p className="notification-inline-status" role="status">Refreshing notifications…</p>}
          {request.status === "error" && <div className="notification-inline-error" role="alert"><span>{request.error}</span><button type="button" onClick={onRetry}>Retry</button></div>}
          <ul className="notification-list">
            {notifications.map((notification) => (
              <li className={`notification-row${notification.isRead ? " is-read" : " is-unread"}`} key={notification.id}>
                <button className="notification-content" type="button" onClick={() => handleSelect(notification)}>
                  <span className="notification-item-heading"><strong>{notification.title}</strong><span className={`notification-source notification-source-${notification.source}`}>{notification.source}</span></span>
                  <span className="notification-message">{notification.message}</span>
                  <time className="notification-time" dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
                </button>
                <div className="notification-row-actions">
                  {!notification.isRead && (
                    <button
                      className="notification-mark-read"
                      type="button"
                      aria-label={`Mark ${notification.title} as read`}
                      onClick={() => handleMarkRead(notification)}
                      disabled={busyNotificationId === notification.id || markingAllRead}
                    >
                      <Check size={15} /><span>Mark read</span>
                    </button>
                  )}
                  <button
                    className="notification-delete"
                    type="button"
                    aria-label={`Delete ${notification.title}`}
                    onClick={() => handleDelete(notification)}
                    disabled={busyNotificationId === notification.id || markingAllRead}
                  >
                    <X size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Topbar({ query, setQuery, onNotificationClick, unreadCount, notificationsOpen, searchEnabled, profile, onLogout }) {
  const initials = (profile?.fullName || "Student").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <SearchBox query={query} setQuery={setQuery} enabled={searchEnabled} />
      <div className="topbar-actions">
        <NotificationBell unreadCount={unreadCount} onClick={onNotificationClick} expanded={notificationsOpen} />
        <details className="profile-dropdown">
          <summary className="profile-chip" aria-label="Open profile menu">
          <span className="avatar">{initials}</span>
          <span className="profile-text"><strong>{profile?.fullName || "Student"}</strong><small>Student</small></span>
          <ChevronDown size={16} />
          </summary>
          <nav className="profile-menu" aria-label="Profile options">
            <a href="/profile"><CircleUserRound size={17} /> Profile</a>
            <a href="/settings"><Settings size={17} /> Settings</a>
            <div className="profile-menu-divider" />
            <button className="profile-signout" type="button" onClick={(event) => {
              event.currentTarget.closest("details").open = false;
              onLogout();
            }}><LogOut size={17} /> Sign out</button>
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
    { label: "Reminders", path: "/reminders", icon: Bell, deferred: true },
    { label: "Profile", path: "/profile", icon: CircleUserRound },
  ];
  return (
    <nav aria-label="Mobile navigation" className="mobile-nav">
      {mobileItems.slice(0, 2).map((item) => <RouteLink key={item.path} {...item} currentPath={currentPath} />)}
      <a className="mobile-add" href="/upload" aria-label="Go to upload"><span aria-hidden="true">+</span></a>
      {mobileItems.slice(2).map((item) => <RouteLink key={item.path} {...item} currentPath={currentPath} />)}
    </nav>
  );
}

export default function AppShell({
  currentPath,
  query,
  setQuery,
  onLogout,
  searchEnabled,
  profile,
  children,
  notifications = [],
  unreadNotificationCount = 0,
  notificationRequest = { status: "idle", error: "" },
  busyNotificationId = null,
  markingAllNotificationsRead = false,
  onNotificationRetry,
  onMarkNotificationRead,
  onDeleteNotification,
  onMarkAllNotificationsRead,
  onSelectNotification,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeNotifications = () => setNotificationsOpen(false);
  const toggleNotifications = () => setNotificationsOpen((open) => !open);
  const handleLogout = () => {
    setNotificationsOpen(false);
    onLogout();
  };
  return (
    <div className="app-shell">
      <Sidebar currentPath={currentPath} />
      <main className="main-area">
        <Topbar query={query} setQuery={setQuery} onNotificationClick={toggleNotifications} unreadCount={unreadNotificationCount} notificationsOpen={notificationsOpen} onLogout={handleLogout} searchEnabled={searchEnabled} profile={profile} />
        <div className="mobile-brandbar">
          <a className="brand-link" href="/" aria-label="Vaultori home"><Brand compact /></a>
          <div className="topbar-actions">
            <NotificationBell mobile unreadCount={unreadNotificationCount} onClick={toggleNotifications} expanded={notificationsOpen} />
            <a href="/profile" aria-label="View student profile"><span className="avatar">{(profile?.fullName || "Student").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span></a>
            <button className="icon-button mobile-signout" type="button" aria-label="Sign out" onClick={handleLogout}><LogOut size={18} /></button>
          </div>
        </div>
        <div className="mobile-search"><SearchBox query={query} setQuery={setQuery} mobile enabled={searchEnabled} /></div>
        <NotificationCentre
          open={notificationsOpen}
          notifications={notifications}
          unreadCount={unreadNotificationCount}
          request={notificationRequest}
          busyNotificationId={busyNotificationId}
          markingAllRead={markingAllNotificationsRead}
          onClose={closeNotifications}
          onRetry={onNotificationRetry}
          onMarkRead={onMarkNotificationRead}
          onDelete={onDeleteNotification}
          onMarkAllRead={onMarkAllNotificationsRead}
          onSelect={onSelectNotification}
        />
        {children}
      </main>
      <MobileNavigation currentPath={currentPath} />
    </div>
  );
}
