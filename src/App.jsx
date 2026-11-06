import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { apiRequest, apiUpload } from "./api/apiClient.js";
import AppShell from "./components/AppShell.jsx";
import AdminAppShell from "./modules/admin/components/AdminAppShell.jsx";
import AuthenticationPage from "./modules/auth/pages/AuthenticationPage.jsx";
import AdminAuthenticationPage from "./modules/admin/pages/AdminAuthenticationPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import DocumentLibraryPage from "./modules/documents/pages/DocumentLibraryPage.jsx";
import DocumentDetailPage from "./modules/documents/pages/DocumentDetailPage.jsx";
import FoldersPage from "./modules/documents/pages/FoldersPage.jsx";
import UploadDialog from "./modules/documents/components/UploadDialog.jsx";
import DocumentScannerPage from "./modules/documents/scanner/DocumentScannerPage.jsx";
import { normalizeDocumentPreviewUrl } from "./modules/documents/previewUrl.js";
import AcademicRecordsPage from "./modules/academic-records/pages/AcademicRecordsPage.jsx";
import DashboardPage from "./modules/dashboard/pages/DashboardPage.jsx";
import ProfilePage from "./modules/profile/pages/ProfilePage.jsx";
import EditProfilePage from "./modules/profile/pages/EditProfilePage.jsx";
import { getProfileResponse, getStudentProfile } from "./modules/profile/profileData.js";
import SettingsPage from "./modules/settings/pages/SettingsPage.jsx";
import ChangePasswordPage from "./modules/settings/pages/ChangePasswordPage.jsx";
import AdminDashboardPage from "./modules/admin/pages/AdminDashboardPage.jsx";
import AdminStudentManagementPage, { AdminStudentDetailPage } from "./modules/admin/pages/AdminStudentManagementPage.jsx";
import AdminUsagePage from "./modules/admin/pages/AdminUsagePage.jsx";
import AdminCommunicationsPage from "./modules/admin/pages/AdminCommunicationsPage.jsx";
import { documentCategories } from "./modules/documents/data/mockDocuments.js";
import { getRoute } from "./routeConfig.js";
import {
  createAcademicRecord,
  deleteAcademicRecord,
  listAcademicRecords,
  updateAcademicRecord,
} from "./modules/academic-records/data/academicRecordsApi.js";
import { initialNotificationPreferences } from "./data/mockProfile.js";
import {
  getUnreadNotificationCount,
  listNotifications,
  deleteNotification,
  markAllNotificationsRead as markAllNotificationsReadApi,
  markNotificationRead,
} from "./modules/notifications/notificationApi.js";

function Notice({ message, onClose }) {
  if (!message) return null;
  return <div role="status" className="notice"><Check size={17} /><span>{message}</span><button aria-label="Dismiss message" onClick={onClose}><X size={16} /></button></div>;
}

function getSafeAuthentication(payload) {
  if (
    !payload?.user ||
    typeof payload.user.id !== "string" ||
    typeof payload.user.email !== "string" ||
    typeof payload.user.role !== "string" ||
    !payload?.session ||
    typeof payload.session.id !== "string" ||
    typeof payload.session.expiresAt !== "string" ||
    typeof payload.csrfToken !== "string" ||
    !payload.csrfToken
  ) {
    throw new Error("The server returned an invalid session. Please try signing in again.");
  }

  const profile = payload.profile && typeof payload.profile === "object"
    ? {
      fullName: typeof payload.profile.fullName === "string" ? payload.profile.fullName : null,
      university: typeof payload.profile.university === "string" ? payload.profile.university : null,
      faculty: typeof payload.profile.faculty === "string" ? payload.profile.faculty : null,
      department: typeof payload.profile.department === "string" ? payload.profile.department : null,
      programme: typeof payload.profile.programme === "string" ? payload.profile.programme : null,
      studyYear: typeof payload.profile.studyYear === "string" ? payload.profile.studyYear : null,
      academicSession: typeof payload.profile.academicSession === "string" ? payload.profile.academicSession : null,
    }
    : {};

  return {
    status: "authenticated",
    user: {
      id: payload.user.id,
      email: payload.user.email,
      role: payload.user.role,
    },
    profile,
    session: {
      id: payload.session.id,
      expiresAt: payload.session.expiresAt,
    },
    csrfToken: payload.csrfToken,
  };
}

function isStudentRoute(route) {
  return route?.kind === "dashboard"
    || route?.kind === "student"
    || route?.kind === "deferred"
    || route?.kind === "document-detail";
}

function isAdminRoute(route) {
  return route?.kind === "admin" || route?.kind === "admin-student-detail";
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, "") || "/");
  const [navigationVersion, setNavigationVersion] = useState(0);
  const route = getRoute(currentPath);
  const [authentication, setAuthentication] = useState({ status: "checking", user: null, profile: null, session: null, csrfToken: null });
  const authenticationOperation = useRef(0);
  const [documents, setDocuments] = useState([]);
  const [documentSummary, setDocumentSummary] = useState(null);
  const [documentRequest, setDocumentRequest] = useState({ status: "idle", error: "" });
  const [documentDetailRequest, setDocumentDetailRequest] = useState({ status: "idle", document: null, error: "" });
  const [documentReloadKey, setDocumentReloadKey] = useState(0);
  const [folders, setFolders] = useState([]);
  const [folderRequest, setFolderRequest] = useState({ status: "idle", error: "" });
  const [folderReloadKey, setFolderReloadKey] = useState(0);
  const [academicRecords, setAcademicRecords] = useState([]);
  const [academicRecordRequest, setAcademicRecordRequest] = useState({ status: "idle", error: "" });
  const [academicRecordReloadKey, setAcademicRecordReloadKey] = useState(0);
  const [notificationState, setNotificationState] = useState({
    ownerId: null,
    notifications: [],
    unreadCount: 0,
    status: "idle",
    error: "",
    busyNotificationId: null,
    markingAll: false,
  });
  const [notificationReloadKey, setNotificationReloadKey] = useState(0);
  const [studentProfileRequest, setStudentProfileRequest] = useState({ status: "idle", profile: null, error: "" });
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState(initialNotificationPreferences);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(route?.path === "/upload");
  const announce = (message) => {
    setNotice(message);
    window.clearTimeout(window.noticeTimeout);
    window.noticeTimeout = window.setTimeout(() => setNotice(""), 3600);
  };

  const navigateTo = useCallback((destination) => {
    const target = new URL(destination, window.location.href);
    if (target.origin !== window.location.origin) return;
    window.history.pushState({}, "", target.pathname + target.search + target.hash);
    setCurrentPath(target.pathname.replace(/\/$/, "") || "/");
    setNavigationVersion((version) => version + 1);
    window.scrollTo(0, 0);
  }, []);

  const establishAuthentication = useCallback(async () => {
    const operation = ++authenticationOperation.current;
    try {
      const payload = await apiRequest("/api/auth/session");
      const nextAuthentication = getSafeAuthentication(payload);
      if (authenticationOperation.current === operation) setAuthentication(nextAuthentication);
    } catch (error) {
      if (authenticationOperation.current === operation) {
        setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
      }
      throw error;
    }
  }, []);

  const establishAdminAuthentication = useCallback(async () => {
    const operation = ++authenticationOperation.current;
    try {
      const payload = await apiRequest("/api/auth/session");
      const nextAuthentication = getSafeAuthentication(payload);
      if (nextAuthentication.user.role !== "admin") {
        throw new Error("This account is not authorized for Vaultori Admin.");
      }

      const adminSession = await apiRequest("/api/admin/session");
      if (
        !adminSession?.user
        || adminSession.user.role !== "admin"
        || adminSession.user.id !== nextAuthentication.user.id
      ) {
        throw new Error("The administrator session could not be verified. Please sign in again.");
      }

      if (authenticationOperation.current === operation) {
        setAuthentication(nextAuthentication);
        navigateTo("/admin");
      }
    } catch (error) {
      if (authenticationOperation.current === operation) {
        setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
      }
      if (error instanceof Error && error.message) throw error;
      throw new Error("The administrator session could not be verified. Please sign in again.");
    }
  }, [navigateTo]);

  const handleLogout = async (destination = "/welcome") => {
    setNotificationState({
      ownerId: null,
      notifications: [],
      unreadCount: 0,
      status: "idle",
      error: "",
      busyNotificationId: null,
      markingAll: false,
    });
    if (!authentication.csrfToken) {
      setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
      navigateTo(destination === "/admin/login" ? "/admin/login" : "/login");
      return;
    }

    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        csrfToken: authentication.csrfToken,
      });
      ++authenticationOperation.current;
      setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
      navigateTo(destination);
    } catch (error) {
      if (error.status === 401) {
        ++authenticationOperation.current;
        setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
        navigateTo(destination === "/admin/login" ? "/admin/login" : "/login");
        return;
      }
      announce(error.message || "We couldn't sign you out. Please try again.");
      retryNotificationLoad();
    }
  };

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(window.location.pathname.replace(/\/$/, "") || "/");
      setNavigationVersion((version) => version + 1);
    };
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
    if (!window.location.hash) return undefined;
    let targetId;
    try {
      targetId = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentPath, navigationVersion]);

  useEffect(() => {
    let active = true;
    const operation = ++authenticationOperation.current;
    apiRequest("/api/auth/session")
      .then((payload) => {
        const nextAuthentication = getSafeAuthentication(payload);
        if (active && authenticationOperation.current === operation) setAuthentication(nextAuthentication);
      })
      .catch(() => {
        if (active && authenticationOperation.current === operation) {
          setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authentication.status === "authenticated") return;
    setNotificationState({
      ownerId: null,
      notifications: [],
      unreadCount: 0,
      status: "idle",
      error: "",
      busyNotificationId: null,
      markingAll: false,
    });
    setFolders([]);
    setFolderRequest({ status: "idle", error: "" });
    setDocuments([]);
    setDocumentSummary(null);
    setDocumentRequest({ status: "idle", error: "" });
    setDocumentDetailRequest({ status: "idle", document: null, error: "" });
    setAcademicRecords([]);
    setAcademicRecordRequest({ status: "idle", error: "" });
  }, [authentication.status]);

  useEffect(() => {
    if (authentication.status === "checking") return;
    if (isStudentRoute(route) && authentication.status !== "authenticated") {
      if (currentPath !== "/login") navigateTo("/login");
    } else if (
      route?.path === "/admin/login"
      && authentication.status === "authenticated"
      && authentication.user?.role === "admin"
    ) {
      navigateTo("/admin");
    } else if (route?.path === "/login" && authentication.status === "authenticated") {
      navigateTo("/");
    }
  }, [authentication.status, currentPath, navigateTo, route?.kind, route?.path]);

  useEffect(() => {
    const profilePaths = ["/", "/profile/setup", "/profile", "/profile/edit"];
    if (authentication.status !== "authenticated" || !profilePaths.includes(route?.path)) return undefined;

    let active = true;
    setStudentProfileRequest({ status: "loading", profile: null, error: "" });
    apiRequest("/api/student/profile")
      .then((payload) => {
        const savedProfile = getProfileResponse(payload, authentication.user.email);
        if (active) setStudentProfileRequest({ status: "loaded", profile: savedProfile, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 404 && error.code === "PROFILE_NOT_FOUND") {
          setStudentProfileRequest({ status: "missing", profile: null, error: "" });
          return;
        }
        if (error.status === 401) {
          ++authenticationOperation.current;
          setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
          navigateTo("/login");
          return;
        }
        setStudentProfileRequest({
          status: "error",
          profile: null,
          error: error.message || "We couldn't load your profile. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [authentication.status, navigateTo, profileReloadKey, route?.path]);

  const retryStudentProfileLoad = () => setProfileReloadKey((current) => current + 1);
  const retryDocumentsLoad = () => setDocumentReloadKey((current) => current + 1);
  const retryFoldersLoad = () => setFolderReloadKey((current) => current + 1);
  const retryNotificationLoad = () => setNotificationReloadKey((current) => current + 1);
  const handleExpiredDocumentSession = useCallback((error) => {
    if (error.status !== 401) return;
    ++authenticationOperation.current;
    setNotificationState({
      ownerId: null,
      notifications: [],
      unreadCount: 0,
      status: "idle",
      error: "",
      busyNotificationId: null,
      markingAll: false,
    });
    setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
    navigateTo("/login");
  }, [navigateTo]);

  useEffect(() => {
    const ownerId = authentication.status === "authenticated"
      && authentication.user?.role === "student"
      ? authentication.user.id
      : null;
    if (!ownerId) return undefined;

    let active = true;
    setNotificationState({
      ownerId,
      notifications: [],
      unreadCount: 0,
      status: "loading",
      error: "",
      busyNotificationId: null,
      markingAll: false,
    });
    Promise.all([listNotifications(), getUnreadNotificationCount()])
      .then(([notifications, unreadCount]) => {
        if (active) {
          setNotificationState({
            ownerId,
            notifications,
            unreadCount,
            status: "loaded",
            error: "",
            busyNotificationId: null,
            markingAll: false,
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          handleExpiredDocumentSession(error);
          return;
        }
        setNotificationState({
          ownerId,
          notifications: [],
          unreadCount: 0,
          status: "error",
          error: error.message || "We couldn't load your notifications. Please try again.",
          busyNotificationId: null,
          markingAll: false,
        });
      });

    return () => {
      active = false;
    };
  }, [
    authentication.status,
    authentication.user?.id,
    authentication.user?.role,
    handleExpiredDocumentSession,
    notificationReloadKey,
  ]);

  const markOneNotificationRead = async (notificationId) => {
    if (notificationState.ownerId !== authentication.user?.id) return;
    setNotificationState((current) => ({ ...current, busyNotificationId: notificationId }));
    let notification;
    try {
      notification = await markNotificationRead(notificationId, authentication.csrfToken);
    } catch (error) {
      handleExpiredDocumentSession(error);
      setNotificationState((current) => ({ ...current, busyNotificationId: null }));
      throw error;
    }

    setNotificationState((current) => {
      if (current.ownerId !== authentication.user?.id) return current;
      const previous = current.notifications.find((item) => item.id === notification.id);
      return {
        ...current,
        notifications: current.notifications.map((item) => item.id === notification.id ? notification : item),
        unreadCount: previous && !previous.isRead && notification.isRead
          ? Math.max(0, current.unreadCount - 1)
          : current.unreadCount,
        busyNotificationId: null,
        error: "",
      };
    });

    try {
      const unreadCount = await getUnreadNotificationCount();
      setNotificationState((current) => current.ownerId === authentication.user?.id
        ? { ...current, unreadCount }
        : current);
    } catch (error) {
      if (error.status === 401) {
        handleExpiredDocumentSession(error);
        return;
      }
      setNotificationState((current) => current.ownerId === authentication.user?.id
        ? {
          ...current,
          status: "error",
          error: error.message || "Your notification was marked read, but the unread count could not be refreshed.",
        }
        : current);
    }
  };

  const markAllNotificationsRead = async () => {
    if (notificationState.ownerId !== authentication.user?.id) return;
    setNotificationState((current) => ({ ...current, markingAll: true }));
    let updatedCount;
    try {
      updatedCount = await markAllNotificationsReadApi(authentication.csrfToken);
    } catch (error) {
      handleExpiredDocumentSession(error);
      setNotificationState((current) => ({ ...current, markingAll: false }));
      throw error;
    }

    const readAt = new Date().toISOString();
    setNotificationState((current) => current.ownerId === authentication.user?.id
      ? {
        ...current,
        notifications: current.notifications.map((item) => item.isRead
          ? item
          : { ...item, isRead: true, readAt }),
        unreadCount: Math.max(0, current.unreadCount - updatedCount),
        markingAll: false,
        error: "",
      }
      : current);

    const [notificationsResult, unreadCountResult] = await Promise.allSettled([
      listNotifications(),
      getUnreadNotificationCount(),
    ]);
    const refreshError = [notificationsResult, unreadCountResult]
      .find((result) => result.status === "rejected")?.reason;
    if (refreshError?.status === 401) {
      handleExpiredDocumentSession(refreshError);
      return;
    }
    if (notificationsResult.status === "fulfilled" && unreadCountResult.status === "fulfilled") {
      setNotificationState((current) => current.ownerId === authentication.user?.id
        ? { ...current, notifications: notificationsResult.value, unreadCount: unreadCountResult.value }
        : current);
    } else if (refreshError) {
      setNotificationState((current) => current.ownerId === authentication.user?.id
        ? {
          ...current,
          status: "error",
          error: refreshError.message || "Notifications were marked read, but the latest status could not be refreshed.",
        }
        : current);
    }
  };

  const deleteOneNotification = async (notification) => {
    if (notificationState.ownerId !== authentication.user?.id) return;
    setNotificationState((current) => ({ ...current, busyNotificationId: notification.id }));
    try {
      const result = await deleteNotification(notification.id, authentication.csrfToken);
      setNotificationState((current) => current.ownerId === authentication.user?.id
        ? {
          ...current,
          notifications: current.notifications.filter((item) => item.id !== result.deletedId),
          unreadCount: result.wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
          busyNotificationId: null,
          error: "",
        }
        : current);
    } catch (error) {
      handleExpiredDocumentSession(error);
      setNotificationState((current) => ({ ...current, busyNotificationId: null }));
      throw error;
    }
  };

  const selectNotification = async (notification) => {
    if (!notification.isRead) await markOneNotificationRead(notification.id);
    if (notification.actionDestination) navigateTo(notification.actionDestination);
  };

  useEffect(() => {
    if (authentication.status !== "authenticated" || route?.path !== "/academic-records") return undefined;

    let active = true;
    setAcademicRecordRequest({ status: "loading", error: "" });
    listAcademicRecords()
      .then((records) => {
        if (active) {
          setAcademicRecords(records);
          setAcademicRecordRequest({ status: "loaded", error: "" });
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          handleExpiredDocumentSession(error);
          return;
        }
        setAcademicRecordRequest({
          status: "error",
          error: error.message || "We couldn't load your academic records. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [academicRecordReloadKey, authentication.status, handleExpiredDocumentSession, route?.path]);

  const retryAcademicRecordsLoad = () => setAcademicRecordReloadKey((current) => current + 1);
  const addAcademicRecord = async (values) => {
    try {
      const record = await createAcademicRecord(values, authentication.csrfToken);
      setAcademicRecords((current) => [record, ...current.filter(({ id }) => id !== record.id)]);
      retryAcademicRecordsLoad();
      return record;
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const editAcademicRecord = async (recordId, values) => {
    try {
      const record = await updateAcademicRecord(recordId, values, authentication.csrfToken);
      setAcademicRecords((current) => current.map((item) => item.id === recordId ? record : item));
      retryAcademicRecordsLoad();
      return record;
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const removeAcademicRecord = async (recordId) => {
    try {
      await deleteAcademicRecord(recordId, authentication.csrfToken);
      setAcademicRecords((current) => current.filter((record) => record.id !== recordId));
      retryAcademicRecordsLoad();
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const submitPasswordChange = async (values) => {
    try {
      return await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: values,
        csrfToken: authentication.csrfToken,
      });
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  useEffect(() => {
    const folderRoutes = route?.kind === "document-detail" || route?.path === "/folders";
    if (authentication.status !== "authenticated" || !folderRoutes) return undefined;

    let active = true;
    setFolderRequest({ status: "loading", error: "" });
    apiRequest("/api/student/folders")
      .then((payload) => {
        if (!Array.isArray(payload?.folders) || payload.folders.some((folder) => (
          !folder || typeof folder.id !== "string" || typeof folder.name !== "string"
        ))) {
          throw new Error("The server returned invalid folder data.");
        }
        if (active) {
          setFolders(payload.folders);
          setFolderRequest({ status: "loaded", error: "" });
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          handleExpiredDocumentSession(error);
          return;
        }
        setFolderRequest({
          status: "error",
          error: error.message || "We couldn't load your folders. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [authentication.status, folderReloadKey, handleExpiredDocumentSession, route?.kind, route?.path]);

  useEffect(() => {
    const documentRoutes = route?.kind === "dashboard"
      || route?.kind === "document-detail"
      || ["/documents", "/upload", "/folders", "/settings"].includes(route?.path);
    if (authentication.status !== "authenticated" || !documentRoutes) return undefined;

    let active = true;
    setDocumentRequest({ status: "loading", error: "" });
    setDocumentSummary(null);
    Promise.all([
      apiRequest("/api/student/documents?archived=false"),
      apiRequest("/api/student/documents?archived=true"),
      apiRequest("/api/student/documents/summary"),
    ])
      .then(([activeResponse, archivedResponse, summaryResponse]) => {
        if (!Array.isArray(activeResponse?.documents) || !Array.isArray(archivedResponse?.documents)) {
          throw new Error("The server returned invalid document data.");
        }
        const summary = summaryResponse?.summary;
        if (
          !summary
          || !Number.isSafeInteger(summary.activeCount)
          || !Number.isSafeInteger(summary.archivedCount)
          || !Number.isSafeInteger(summary.academicDocumentsCount)
          || !Number.isFinite(summary.activeStorageBytes)
          || !Number.isSafeInteger(summary.storedDocumentCount)
          || !Number.isFinite(summary.totalStorageBytes)
          || !Array.isArray(summary.categoryCounts)
          || !Array.isArray(summary.storageByCategory)
        ) {
          throw new Error("The server returned invalid document summary data.");
        }
        if (!active) return;
        setDocuments([...activeResponse.documents, ...archivedResponse.documents]);
        setDocumentSummary(summary);
        setDocumentRequest({ status: "loaded", error: "" });
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          ++authenticationOperation.current;
          setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
          navigateTo("/login");
          return;
        }
        setDocumentRequest({
          status: "error",
          error: error.message || "We couldn't load your documents. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [authentication.status, documentReloadKey, navigateTo, route?.kind, route?.path]);

  useEffect(() => {
    if (
      authentication.status !== "authenticated"
      || route?.kind !== "document-detail"
      || documentRequest.status !== "loaded"
    ) {
      return undefined;
    }

    const listedDocument = documents.find((document) => document.id === route.documentId);
    if (listedDocument) {
      setDocumentDetailRequest({ status: "loaded", document: listedDocument, error: "" });
      return undefined;
    }

    let active = true;
    setDocumentDetailRequest({ status: "loading", document: null, error: "" });
    apiRequest(`/api/student/documents/${encodeURIComponent(route.documentId)}`)
      .then((payload) => {
        if (!payload?.document?.id) throw new Error("The server returned invalid document data.");
        if (active) setDocumentDetailRequest({ status: "loaded", document: payload.document, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          handleExpiredDocumentSession(error);
          return;
        }
        setDocumentDetailRequest({
          status: "error",
          document: null,
          error: error.message || "We couldn't load this document. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [authentication.status, documentRequest.status, documents, route?.documentId, route?.kind]);

  const uploadDocument = async (formData, onProgress, { quiet = false } = {}) => {
    try {
      const payload = await apiUpload("/api/student/documents", {
        body: formData,
        csrfToken: authentication.csrfToken,
        onProgress,
      });
      if (!payload?.document?.id) throw new Error("The server returned an invalid document response.");
      setDocuments((current) => [payload.document, ...current.filter(({ id }) => id !== payload.document.id)]);
      setDocumentRequest({ status: "loaded", error: "" });
      if (!quiet) {
        setDialog(false);
        announce("Document uploaded to your library.");
        retryDocumentsLoad();
      }
      return payload.document;
    } catch (error) {
      if (error.status === 401) {
        ++authenticationOperation.current;
        setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
        navigateTo("/login");
      }
      throw error;
    }
  };

  const updateDocument = async (documentId, changes) => {
    try {
      const payload = await apiRequest(`/api/student/documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        body: changes,
        csrfToken: authentication.csrfToken,
      });
      if (!payload?.document?.id) throw new Error("The server returned an invalid document response.");
      setDocuments((current) => current.map((document) => document.id === documentId ? payload.document : document));
      setDocumentDetailRequest((current) => current.document?.id === documentId
        ? { ...current, document: payload.document }
        : current);
      retryDocumentsLoad();
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const createFolder = async (name) => {
    try {
      const payload = await apiRequest("/api/student/folders", {
        method: "POST",
        body: { name },
        csrfToken: authentication.csrfToken,
      });
      if (!payload?.folder?.id || typeof payload.folder.name !== "string") {
        throw new Error("The server returned an invalid folder response.");
      }
      setFolders((current) => [...current.filter(({ id }) => id !== payload.folder.id), payload.folder]);
      return payload.folder;
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const renameFolder = async (folderId, name) => {
    try {
      const payload = await apiRequest(`/api/student/folders/${encodeURIComponent(folderId)}`, {
        method: "PATCH",
        body: { name },
        csrfToken: authentication.csrfToken,
      });
      if (!payload?.folder?.id || typeof payload.folder.name !== "string") {
        throw new Error("The server returned an invalid folder response.");
      }
      setFolders((current) => current.map((folder) => folder.id === folderId ? payload.folder : folder));
      return payload.folder;
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      await apiRequest(`/api/student/folders/${encodeURIComponent(folderId)}`, {
        method: "DELETE",
        csrfToken: authentication.csrfToken,
      });
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      setDocuments((current) => current.map((document) => document.folderId === folderId
        ? { ...document, folderId: null }
        : document));
      setDocumentDetailRequest((current) => current.document?.folderId === folderId
        ? { ...current, document: { ...current.document, folderId: null } }
        : current);
      retryDocumentsLoad();
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await apiRequest(`/api/student/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
        csrfToken: authentication.csrfToken,
      });
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setDocumentDetailRequest((current) => current.document?.id === documentId
        ? { status: "idle", document: null, error: "" }
        : current);
      retryDocumentsLoad();
      announce("Document and stored file deleted.");
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  };

  const getDocumentDownloadUrl = useCallback(async (documentId) => {
    try {
      const payload = await apiRequest(`/api/student/documents/${encodeURIComponent(documentId)}/download`);
      if (typeof payload?.downloadUrl !== "string") throw new Error("A secure download link is unavailable.");
      return normalizeDocumentPreviewUrl(payload.downloadUrl);
    } catch (error) {
      handleExpiredDocumentSession(error);
      throw error;
    }
  }, []);

  const saveStudentProfile = async (profileUpdate) => {
    let payload;
    try {
      payload = await apiRequest("/api/student/profile", {
        method: "PUT",
        body: profileUpdate,
        csrfToken: authentication.csrfToken,
      });
    } catch (error) {
      if (error.status === 401) {
        ++authenticationOperation.current;
        setAuthentication({ status: "ready", user: null, profile: null, session: null, csrfToken: null });
        navigateTo("/login");
      }
      throw error;
    }

    const savedProfile = getProfileResponse(payload, authentication.user.email);
    setStudentProfileRequest({ status: "loaded", profile: savedProfile, error: "" });
    setAuthentication((current) => ({
      ...current,
      profile: {
        ...current.profile,
        fullName: savedProfile.fullName,
        university: savedProfile.university,
        faculty: savedProfile.faculty,
        department: savedProfile.department,
        programme: savedProfile.program,
        studyYear: savedProfile.studyYear,
        academicSession: savedProfile.academicSession,
      },
    }));
    return savedProfile;
  };

  useEffect(() => {
    if (route?.path === "/upload" && authentication.status === "authenticated") setDialog(true);
  }, [authentication.status, route?.path]);

  useEffect(() => {
    document.title = (route?.title ?? "Not found") + " | Vaultori";
  }, [route?.title]);

  const authenticationPage = (authRoute) => (
    <AuthenticationPage
      route={authRoute}
      onNavigate={navigateTo}
      verificationEmail={verificationEmail}
      onVerificationEmailChange={setVerificationEmail}
      onLoginSuccess={establishAuthentication}
    />
  );
  const requiresStudentAuthentication = isStudentRoute(route);
  if (requiresStudentAuthentication && authentication.status === "checking") {
    return (
      <main className="auth-page auth-session-check" aria-live="polite">
        <div className="auth-verification-state" role="status">
          <span className="auth-verification-icon"><span className="auth-spinner" aria-hidden="true" /></span>
          <p className="auth-intro">Restoring your session…</p>
        </div>
      </main>
    );
  }
  if (requiresStudentAuthentication && authentication.status !== "authenticated") {
    return authenticationPage(getRoute("/login"));
  }
  if (isAdminRoute(route) && authentication.status === "checking") {
    return (
      <main className="auth-page auth-session-check" aria-live="polite">
        <div className="auth-verification-state" role="status">
          <span className="auth-verification-icon"><span className="auth-spinner" aria-hidden="true" /></span>
          <p className="auth-intro">Restoring your admin session…</p>
        </div>
      </main>
    );
  }
  if (isAdminRoute(route)
    && (authentication.status !== "authenticated" || authentication.user?.role !== "admin")) {
  return <AdminAuthenticationPage onLoginSuccess={establishAdminAuthentication} />;
  }
  if (route?.path === "/login" && authentication.status === "authenticated") {
    return (
      <main className="auth-page auth-session-check" aria-live="polite">
        <div className="auth-verification-state" role="status">
          <span className="auth-verification-icon"><span className="auth-spinner" aria-hidden="true" /></span>
          <p className="auth-intro">Opening your vault…</p>
        </div>
      </main>
    );
  }

  const authenticatedProfile = authentication.status === "authenticated"
    ? getStudentProfile(
      studentProfileRequest.profile ?? authentication.profile,
      authentication.user.email,
    )
    : getStudentProfile(null);
  const notificationStateForUser = authentication.status === "authenticated"
    && authentication.user?.role === "student"
    && notificationState.ownerId === authentication.user.id
    ? notificationState
    : {
      notifications: [],
      unreadCount: 0,
      status: authentication.status === "authenticated"
        && authentication.user?.role === "student"
        ? "loading"
        : "idle",
      error: "",
      busyNotificationId: null,
      markingAll: false,
    };

  return (
    <>
      {route?.kind === "auth" ? authenticationPage(route) : route?.kind === "admin-auth" ? <AdminAuthenticationPage onLoginSuccess={establishAdminAuthentication} /> : ["admin", "admin-student-detail"].includes(route?.kind) ? (
        <AdminAppShell currentPath={currentPath} onLogout={handleLogout}>
          {route.kind === "admin-student-detail"
            ? <AdminStudentDetailPage studentId={route.studentId} csrfToken={authentication.csrfToken} />
            : route.path === "/admin"
              ? <AdminDashboardPage />
              : route.path === "/admin/students"
                ? <AdminStudentManagementPage csrfToken={authentication.csrfToken} />
                : route.path === "/admin/usage"
                  ? <AdminUsagePage />
                  : route.path === "/admin/feedback"
                    ? <AdminCommunicationsPage csrfToken={authentication.csrfToken} />
                : <PlaceholderPage route={route} />}
        </AdminAppShell>
      ) : (
        <AppShell
          currentPath={currentPath}
          query={query}
          setQuery={setQuery}
          searchEnabled={route?.kind === "dashboard"}
          profile={authenticatedProfile}
          onLogout={handleLogout}
          notifications={notificationStateForUser.notifications}
          unreadNotificationCount={notificationStateForUser.unreadCount}
          notificationRequest={{ status: notificationStateForUser.status, error: notificationStateForUser.error }}
          busyNotificationId={notificationStateForUser.busyNotificationId}
          markingAllNotificationsRead={notificationStateForUser.markingAll}
          onNotificationRetry={retryNotificationLoad}
          onMarkNotificationRead={markOneNotificationRead}
          onDeleteNotification={deleteOneNotification}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onSelectNotification={selectNotification}
        >
          {route?.kind === "dashboard"
            ? <DashboardPage
              query={query}
              onNotice={announce}
              onUpload={() => setDialog(true)}
              onNavigate={navigateTo}
              onRetryProfile={retryStudentProfileLoad}
              onRetryDocuments={retryDocumentsLoad}
              profile={authenticatedProfile}
              profileLoading={studentProfileRequest.status === "loading" || studentProfileRequest.status === "idle"}
              profileError={studentProfileRequest.error}
              profileMissing={studentProfileRequest.status === "missing"}
              documents={documents}
              documentSummary={documentSummary}
              documentsLoading={documentRequest.status === "loading" || documentRequest.status === "idle"}
              documentsError={documentRequest.error}
            />
            : route?.path === "/profile/setup"
              ? <EditProfilePage
                profile={studentProfileRequest.profile ?? getStudentProfile(authentication.profile)}
                mode="setup"
                loading={studentProfileRequest.status === "loading" || studentProfileRequest.status === "idle"}
                loadError={studentProfileRequest.error}
                onSave={saveStudentProfile}
                onRetry={retryStudentProfileLoad}
                onNavigate={navigateTo}
              />
            : route?.path === "/profile/edit"
              ? <EditProfilePage
                profile={studentProfileRequest.profile ?? authenticatedProfile}
                loading={studentProfileRequest.status === "loading" || studentProfileRequest.status === "idle"}
                missing={studentProfileRequest.status === "missing"}
                loadError={studentProfileRequest.error}
                onSave={saveStudentProfile}
                onRetry={retryStudentProfileLoad}
                onNavigate={navigateTo}
              />
              : route?.path === "/profile"
                ? <ProfilePage
                  profile={studentProfileRequest.profile ?? authenticatedProfile}
                  loading={studentProfileRequest.status === "loading" || studentProfileRequest.status === "idle"}
                  loadError={studentProfileRequest.error}
                  missing={studentProfileRequest.status === "missing"}
                  onRetry={retryStudentProfileLoad}
                  onNavigate={navigateTo}
                />
              : route?.path === "/settings"
                ? <SettingsPage
                  profile={authenticatedProfile}
                  preferences={notificationPreferences}
                  onPreferencesChange={setNotificationPreferences}
                  documents={documents}
                  storageSummary={documentSummary}
                  storageLoading={documentRequest.status === "loading" || documentRequest.status === "idle"}
                  storageError={documentRequest.error}
                  onRetryStorage={retryDocumentsLoad}
                  onNavigate={navigateTo}
                />
                : route?.path === "/change-password"
                  ? <ChangePasswordPage onNavigate={navigateTo} onSubmit={submitPasswordChange} />
            : route?.kind === "document-detail"
              ? <DocumentDetailPage
                document={documents.find((item) => item.id === route.documentId)
                  ?? (documentDetailRequest.document?.id === route.documentId ? documentDetailRequest.document : null)}
                documentId={route.documentId}
                folders={folders}
                foldersLoading={folderRequest.status === "loading" || folderRequest.status === "idle"}
                foldersError={folderRequest.error}
                onRetryFolders={retryFoldersLoad}
                onNavigate={navigateTo}
                onRename={(id, name) => updateDocument(id, { name })}
                onCategory={(id, category) => updateDocument(id, { category })}
                onMove={(id, folderId) => updateDocument(id, { folderId })}
                onArchive={(id) => updateDocument(id, { archived: true })}
                onRestore={(id) => updateDocument(id, { archived: false })}
                onDelete={deleteDocument}
                onGetDownloadUrl={getDocumentDownloadUrl}
                onNotice={announce}
                loading={documentRequest.status === "loading" || documentRequest.status === "idle" || documentDetailRequest.status === "loading"}
                loadError={documentDetailRequest.error || documentRequest.error}
                onRetry={retryDocumentsLoad}
              />
            : route?.path === "/folders"
              ? <FoldersPage
                folders={folders}
                documents={documents}
                loading={folderRequest.status === "loading" || folderRequest.status === "idle"
                  || documentRequest.status === "loading" || documentRequest.status === "idle"}
                error={folderRequest.error || documentRequest.error}
                onRetry={() => { retryFoldersLoad(); retryDocumentsLoad(); }}
                onCreate={createFolder}
                onRename={renameFolder}
                onDelete={deleteFolder}
                onMove={(id, folderId) => updateDocument(id, { folderId })}
                onNotice={announce}
                onNavigate={navigateTo}
              />
              : route?.path === "/academic-records"
                ? <AcademicRecordsPage
                  records={academicRecords}
                  loading={academicRecordRequest.status === "loading" || academicRecordRequest.status === "idle"}
                  error={academicRecordRequest.error}
                  onRetry={retryAcademicRecordsLoad}
                  onCreate={addAcademicRecord}
                  onUpdate={editAcademicRecord}
                  onDelete={removeAcademicRecord}
                  onNotice={announce}
                  onNavigate={navigateTo}
                />
              : route?.path === "/documents" || route?.path === "/upload"
              ? <DocumentLibraryPage
                documents={documents}
                onUpload={() => setDialog(true)}
                onScan={() => navigateTo("/scanner")}
                loading={documentRequest.status === "loading" || documentRequest.status === "idle"}
                error={documentRequest.error}
                onRetry={retryDocumentsLoad}
              />
              : route?.path === "/scanner"
                ? <DocumentScannerPage
                  onBack={() => navigateTo("/documents")}
                  onUpload={(formData, onProgress) => uploadDocument(formData, onProgress, { quiet: true })}
                />
            : <PlaceholderPage route={route} />}
        </AppShell>
      )}
      <Notice message={notice} onClose={() => setNotice("")} />
      {dialog && <UploadDialog onClose={() => setDialog(false)} onAdd={uploadDocument} />}
    </>
  );
}
