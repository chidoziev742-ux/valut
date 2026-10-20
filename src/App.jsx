import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Archive, ArrowRight, BookOpen, BriefcaseBusiness,
  Check, CircleHelp, CloudUpload, FileBadge, FileImage, FileText,
  Folder, FolderOpen, GraduationCap, MoreVertical, Sparkles,
  Sprout, Upload, X,
} from "lucide-react";
import AppShell from "./components/AppShell.jsx";
import AdminAppShell from "./modules/admin/components/AdminAppShell.jsx";
import AuthenticationPage from "./pages/AuthenticationPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import DocumentLibraryPage from "./modules/documents/pages/DocumentLibraryPage.jsx";
import DocumentDetailPage from "./modules/documents/pages/DocumentDetailPage.jsx";
import FoldersPage from "./modules/documents/pages/FoldersPage.jsx";
import UploadDialog from "./modules/documents/components/UploadDialog.jsx";
import AcademicRecordsPage from "./modules/academic-records/pages/AcademicRecordsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import EditProfilePage from "./pages/EditProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import AdminDashboardPage from "./modules/admin/pages/AdminDashboardPage.jsx";
import AdminStudentManagementPage, { AdminStudentDetailPage } from "./modules/admin/pages/AdminStudentManagementPage.jsx";
import AdminUsagePage from "./modules/admin/pages/AdminUsagePage.jsx";
import AdminFeedbackPage from "./modules/admin/pages/AdminFeedbackPage.jsx";
import {
  documentCategories, documentReducer, mockDocuments,
} from "./modules/documents/data/mockDocuments.js";
import { getRoute } from "./routeConfig.js";
import { folderReducer, mockFolders } from "./modules/documents/data/mockFolders.js";
import { academicRecordReducer, mockAcademicRecords } from "./modules/academic-records/data/mockAcademicRecords.js";
import { initialNotificationPreferences, initialStudentProfile } from "./data/mockProfile.js";

const categoryIcons = [FileBadge, GraduationCap, FileText, Folder, BookOpen, BriefcaseBusiness];
const categoryColors = ["green", "gold", "coral", "purple", "mint", "slate"];
const documentIcons = { PDF: FileText, JPG: FileImage };
const tintByCategory = { "Personal Documents": "green", "Academic Records": "blue", "Financial Documents": "coral", "Course Materials": "purple", Certificates: "green", Other: "slate" };
function toDashboardDocument(document) {
  return {
  name: document.name.replace("Student ID Card", "ID Card").replace("Tuition Payment Receipt", "Tuition Receipt").replace("Semester Result", "Result Slip"),
  type: document.fileType,
  size: document.fileSize,
  date: relativeDate(document.uploadedAt),
  icon: documentIcons[document.fileType] ?? FileText,
  tint: tintByCategory[document.category] ?? "green",
  };
}

function relativeDate(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(`${value}T12:00:00`).getTime()) / 86400000));
  if (days < 1) return "Today";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

const actions = [
  { title: "Upload Document", note: "Add and organize your files", icon: Upload, color: "green", id: "upload" },
  { title: "Create Folder", note: "Keep your documents organized", icon: Folder, color: "gold", id: "folder" },
  { title: "Add Academic Record", note: "Save your results, transcripts and more", icon: GraduationCap, color: "purple", id: "record" },
  { title: "Scan Document", note: "Use your camera to upload", icon: FileBadge, color: "coral", id: "scan" },
];

function MetricCard({ icon: Icon, number, label, caption, color }) {
  return (
    <article className={"metric-card tone-" + color}>
      <span className="metric-icon"><Icon size={21} strokeWidth={2.2} /></span>
      <strong className="metric-number">{number}</strong>
      <span className="metric-label">{label}</span>
      <small>{caption}</small>
    </article>
  );
}

function SectionTitle({ title, action, onAction }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && <button className="text-action" onClick={onAction}>{action}<ArrowRight size={15} /></button>}
    </div>
  );
}

function RecentDocuments({ items, onNotice, onNavigate }) {
  return (
    <section className="panel recent-panel">
      <SectionTitle title="Recent Documents" action="See all" onAction={() => onNavigate("/documents")} />
      <ul className="document-list">
        {items.map(({ name, type, size, date, icon: Icon, tint }) => (
          <li className="document-row" key={name}>
            <span className={"file-icon tone-" + tint}><Icon size={19} /></span>
            <span className="document-main"><strong>{name}</strong><small>{type} · {size}</small></span>
            <time>{date}</time>
            <button className="icon-button" aria-label={"More options for " + name} onClick={() => onNotice(name + " is sample content")}><MoreVertical size={17} /></button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <div className="empty-state"><FolderOpen size={27} /><strong>No matching sample documents</strong><span>Try a different search.</span></div>}
    </section>
  );
}

function QuickActions({ onAction, onSeeAll }) {
  return (
    <section className="panel actions-panel">
      <SectionTitle title="Quick Actions" action="See all" onAction={onSeeAll} />
      <div className="action-grid">
        {actions.map(({ title, note, icon: Icon, color, id }) => (
          <button className={"action-card tone-" + color} key={id} onClick={() => onAction(id)}>
            <span className="action-icon"><Icon size={21} /></span><strong>{title}</strong><small>{note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function StoragePanel({ onNotice }) {
  return (
    <section className="panel storage-panel">
      <div className="storage-head"><h2>Storage Usage</h2><button className="upgrade-button" onClick={() => onNotice("Storage figures are illustrative sample data")}>Learn more</button></div>
      <div className="storage-bar" role="img" aria-label="Illustrative storage usage: 1.8 gigabytes of 5 gigabytes, or 36 percent"><span /></div>
      <div className="storage-meta"><span><strong>1.8 GB</strong> of 5 GB used <em>· sample</em></span><span>36%</span></div>
    </section>
  );
}

function CategorySection({ onNotice, documents, onNavigate }) {
  const categories = documentCategories.map((name, index) => {
    const count = documents.filter((document) => document.category === name && !document.archived).length;
    return { name, count: `${count} ${count === 1 ? "file" : "files"}`, icon: categoryIcons[index], color: categoryColors[index] };
  });
  return (
    <section className="panel category-panel">
      <SectionTitle title="Document Categories" action="Manage categories" onAction={() => onNavigate("/folders")} />
      <div className="category-grid">
        {categories.map(({ name, count, icon: Icon, color }) => (
          <button key={name} className={"category-card tone-" + color} onClick={() => onNotice(name + " · " + count + " (sample data)")}>
            <Icon size={20} /><strong>{name}</strong><span>{count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Notice({ message, onClose }) {
  if (!message) return null;
  return <div role="status" className="notice"><Check size={17} /><span>{message}</span><button aria-label="Dismiss message" onClick={onClose}><X size={16} /></button></div>;
}

function DashboardPage({ query, onNotice, onUpload, documents, onNavigate, profile }) {
  const activeDocuments = documents.filter((document) => !document.archived);
  const visibleDocs = useMemo(() => activeDocuments
    .filter((document) => document.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 5)
    .map(toDashboardDocument), [documents, query]);
  const handleAction = (id) => {
    if (id === "upload" || id === "scan") return onUpload();
    if (id === "folder") return onNavigate("/folders");
    if (id === "record") return onNavigate("/academic-records");
  };

  return (
    <div className="content-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">MONDAY, OCTOBER 19</p>
          <h1>Welcome back, {profile.fullName || "Student"} <span aria-hidden="true">👋</span></h1>
          <p className="welcome-subtitle">Your university life, organized in one place.</p>
          <span className="sample-badge">Sample dashboard · illustrative data</span>
        </div>
        <aside className="welcome-note"><span className="sprout" aria-hidden="true"><Sprout size={27} strokeWidth={1.8} /></span><p><strong>Small steps today</strong><br />build your bigger tomorrow.</p></aside>
      </section>
      <section aria-label="Overview" className="metrics-grid">
        <MetricCard icon={FileText} number={activeDocuments.length} label="Documents" caption="active · prototype" color="green" />
        <MetricCard icon={GraduationCap} number={activeDocuments.filter((document) => document.category === "Academic Records").length} label="Academic Records" caption="saved · sample" color="gold" />
        <MetricCard icon={CloudUpload} number="3" label="Pending Uploads" caption="complete to stay up to date" color="coral" />
        <MetricCard icon={Archive} number="—" label="Shared Files" caption="Deferred from MVP" color="purple" />
      </section>
      <div className="dashboard-grid">
        <RecentDocuments items={visibleDocs} onNotice={onNotice} onNavigate={onNavigate} />
        <div className="right-column">
          <QuickActions onAction={handleAction} onSeeAll={() => onNotice("Quick actions are available below")} />
          <StoragePanel onNotice={onNotice} />
        </div>
      </div>
      <CategorySection onNotice={onNotice} documents={documents} onNavigate={onNavigate} />
      <footer className="prototype-footer">Student Vault · Prototype with sample data <CircleHelp size={14} /></footer>
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const route = getRoute(currentPath);
  const [documents, dispatchDocuments] = useReducer(documentReducer, mockDocuments);
  const [folders, dispatchFolders] = useReducer(folderReducer, mockFolders);
  const [academicRecords, dispatchAcademicRecords] = useReducer(academicRecordReducer, mockAcademicRecords);
  const [profile, setProfile] = useState(initialStudentProfile);
  const [notificationPreferences, setNotificationPreferences] = useState(initialNotificationPreferences);
  const previewUrls = useRef(new Set());
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(route?.path === "/upload");
  const announce = (message) => {
    setNotice(message);
    window.clearTimeout(window.noticeTimeout);
    window.noticeTimeout = window.setTimeout(() => setNotice(""), 3600);
  };

  const navigateTo = (destination) => {
    const target = new URL(destination, window.location.href);
    if (target.origin !== window.location.origin) return;
    window.history.pushState({}, "", target.pathname + target.search + target.hash);
    setCurrentPath(target.pathname.replace(/\/$/, "") || "/");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname.replace(/\/$/, "") || "/");
    const onDocumentClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      const current = new URL(window.location.href);
      if (target.pathname === current.pathname && target.search === current.search && target.hash) return;
      event.preventDefault();
      navigateTo(target.pathname + target.search + target.hash);
    };
    window.addEventListener("popstate", syncPath);
    window.document.addEventListener("click", onDocumentClick);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.document.removeEventListener("click", onDocumentClick);
    };
  }, []);

  useEffect(() => {
    const sectionId = decodeURIComponent(window.location.hash.slice(1));
    if (!sectionId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentPath]);

  useEffect(() => {
    if (route?.path === "/upload") setDialog(true);
  }, [route?.path]);

  useEffect(() => {
    document.title = (route?.title ?? "Not found") + " | Student Vault";
  }, [route?.title]);

  useEffect(() => {
    const retainedUrls = new Set(documents.map((item) => item.previewUrl).filter(Boolean));
    for (const url of previewUrls.current) {
      if (!retainedUrls.has(url)) {
        if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
        previewUrls.current.delete(url);
      }
    }
  }, [documents]);

  useEffect(() => () => {
    for (const url of previewUrls.current) {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    }
    previewUrls.current.clear();
  }, []);

  return (
    <>
      {route?.kind === "auth" ? <AuthenticationPage route={route} /> : ["admin", "admin-student-detail"].includes(route?.kind) ? (
        <AdminAppShell currentPath={currentPath}>
          {route.kind === "admin-student-detail"
            ? <AdminStudentDetailPage studentId={route.studentId} />
            : route.path === "/admin"
              ? <AdminDashboardPage />
              : route.path === "/admin/students"
                ? <AdminStudentManagementPage />
                : route.path === "/admin/usage"
                  ? <AdminUsagePage />
                  : route.path === "/admin/feedback"
                    ? <AdminFeedbackPage />
                : <PlaceholderPage route={route} />}
        </AdminAppShell>
      ) : (
        <AppShell currentPath={currentPath} query={query} setQuery={setQuery} searchEnabled={route?.kind === "dashboard"} profile={profile} onNotice={() => announce("Notifications are a prototype preview.")}>
          {route?.kind === "dashboard"
            ? <DashboardPage query={query} documents={documents} onNotice={announce} onUpload={() => setDialog(true)} onNavigate={navigateTo} profile={profile} />
            : route?.path === "/profile/edit"
              ? <EditProfilePage profile={profile} onSave={setProfile} onNotice={announce} onNavigate={navigateTo} />
              : route?.path === "/profile"
                ? <ProfilePage profile={profile} />
              : route?.path === "/settings"
                ? <SettingsPage profile={profile} preferences={notificationPreferences} onPreferencesChange={setNotificationPreferences} documents={documents} onNavigate={navigateTo} />
                : route?.path === "/change-password"
                  ? <ChangePasswordPage onNavigate={navigateTo} />
            : route?.kind === "document-detail"
              ? <DocumentDetailPage
                document={documents.find((item) => item.id === route.documentId) ?? null}
                documentId={route.documentId}
                folders={folders}
                onNavigate={navigateTo}
                onRename={(id, name) => dispatchDocuments({ type: "rename", id, name })}
                onCategory={(id, category) => dispatchDocuments({ type: "category", id, category })}
                onMove={(id, folderId) => dispatchDocuments({ type: "move", id, folderId })}
                onArchive={(id) => dispatchDocuments({ type: "archive", id })}
                onRestore={(id) => dispatchDocuments({ type: "restore", id })}
                onDelete={(id) => dispatchDocuments({ type: "delete", id })}
                onNotice={announce}
              />
            : route?.path === "/folders"
              ? <FoldersPage
                folders={folders}
                documents={documents}
                onCreate={(folder) => dispatchFolders({ type: "create", folder })}
                onRename={(id, name) => dispatchFolders({ type: "rename", id, name })}
                onDelete={(id) => {
                  if (documents.some((item) => item.folderId === id)) {
                    announce("Move this folder’s documents before deleting it.");
                    return;
                  }
                  dispatchFolders({ type: "delete", id });
                }}
                onMove={(id, folderId) => dispatchDocuments({ type: "move", id, folderId })}
                onNotice={announce}
                onNavigate={navigateTo}
              />
              : route?.path === "/academic-records"
                ? <AcademicRecordsPage
                  records={academicRecords}
                  onCreate={(record) => dispatchAcademicRecords({ type: "create", record })}
                  onUpdate={(id, changes) => dispatchAcademicRecords({ type: "update", id, changes })}
                  onDelete={(id) => dispatchAcademicRecords({ type: "delete", id })}
                  onNotice={announce}
                  onNavigate={navigateTo}
                />
              : route?.path === "/documents" || route?.path === "/upload"
              ? <DocumentLibraryPage
                documents={documents}
                onUpload={() => setDialog(true)}
              />
            : <PlaceholderPage route={route} />}
        </AppShell>
      )}
      <Notice message={notice} onClose={() => setNotice("")} />
      {dialog && <UploadDialog onClose={() => setDialog(false)} onAdd={(document) => {
        const supportsPreview = ["JPG", "JPEG", "PNG", "PDF"].includes(document.fileType);
        const previewUrl = supportsPreview && document.attachment && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(document.attachment)
          : undefined;
        if (previewUrl) previewUrls.current.add(previewUrl);
        dispatchDocuments({ type: "add", document: { ...document, previewUrl } });
        setDialog(false);
        announce("Document added to this browser session only.");
      }} />}
    </>
  );
}
