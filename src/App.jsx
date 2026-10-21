import { useEffect, useReducer, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import AppShell from "./components/AppShell.jsx";
import AdminAppShell from "./modules/admin/components/AdminAppShell.jsx";
import AuthenticationPage from "./modules/auth/pages/AuthenticationPage.jsx";
import AdminAuthenticationPage from "./modules/admin/pages/AdminAuthenticationPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import DocumentLibraryPage from "./modules/documents/pages/DocumentLibraryPage.jsx";
import DocumentDetailPage from "./modules/documents/pages/DocumentDetailPage.jsx";
import FoldersPage from "./modules/documents/pages/FoldersPage.jsx";
import UploadDialog from "./modules/documents/components/UploadDialog.jsx";
import AcademicRecordsPage from "./modules/academic-records/pages/AcademicRecordsPage.jsx";
import DashboardPage from "./modules/dashboard/pages/DashboardPage.jsx";
import ProfilePage from "./modules/profile/pages/ProfilePage.jsx";
import EditProfilePage from "./modules/profile/pages/EditProfilePage.jsx";
import SettingsPage from "./modules/settings/pages/SettingsPage.jsx";
import ChangePasswordPage from "./modules/settings/pages/ChangePasswordPage.jsx";
import AdminDashboardPage from "./modules/admin/pages/AdminDashboardPage.jsx";
import AdminStudentManagementPage, { AdminStudentDetailPage } from "./modules/admin/pages/AdminStudentManagementPage.jsx";
import AdminUsagePage from "./modules/admin/pages/AdminUsagePage.jsx";
import AdminCommunicationsPage from "./modules/admin/pages/AdminCommunicationsPage.jsx";
import { documentReducer, mockDocuments } from "./modules/documents/data/mockDocuments.js";
import { getRoute } from "./routeConfig.js";
import { folderReducer, mockFolders } from "./modules/documents/data/mockFolders.js";
import { academicRecordReducer, mockAcademicRecords } from "./modules/academic-records/data/mockAcademicRecords.js";
import { initialNotificationPreferences, initialStudentProfile } from "./data/mockProfile.js";

function Notice({ message, onClose }) {
  if (!message) return null;
  return <div role="status" className="notice"><Check size={17} /><span>{message}</span><button aria-label="Dismiss message" onClick={onClose}><X size={16} /></button></div>;
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
      {route?.kind === "auth" ? <AuthenticationPage route={route} /> : route?.kind === "admin-auth" ? <AdminAuthenticationPage route={route} /> : ["admin", "admin-student-detail"].includes(route?.kind) ? (
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
                    ? <AdminCommunicationsPage />
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
