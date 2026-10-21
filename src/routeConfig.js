export const studentNavigation = [
  { label: "Home", path: "/", group: "student" },
  { label: "My Documents", path: "/documents", group: "student" },
  { label: "Academic Records", path: "/academic-records", group: "student" },
  { label: "Upload", path: "/upload", group: "student" },
  { label: "Folders", path: "/folders", group: "student" },
  { label: "Goals", path: "/goals", group: "student", deferred: true },
  { label: "Reminders", path: "/reminders", group: "student", deferred: true },
  { label: "Profile", path: "/profile", group: "account" },
  { label: "Settings", path: "/settings", group: "account" },
];

export const adminNavigation = [
  { label: "Admin dashboard", path: "/admin" },
  { label: "Student management", path: "/admin/students" },
  { label: "Usage overview", path: "/admin/usage" },
  { label: "Communications", path: "/admin/feedback" },
];

export const routeTable = [
  { path: "/", title: "Home", kind: "dashboard" },
  { path: "/welcome", title: "Welcome", kind: "auth" },
  { path: "/onboarding", title: "Onboarding", kind: "auth" },
  { path: "/sign-up", title: "Sign up", kind: "auth" },
  { path: "/login", title: "Login", kind: "auth" },
  { path: "/forgot-password", title: "Forgot password", kind: "auth" },
  { path: "/reset-password", title: "Reset password", kind: "auth" },
  { path: "/verify", title: "Verification", kind: "auth" },
  { path: "/profile/setup", title: "Student profile setup", kind: "auth" },
  { path: "/admin/login", title: "Admin sign in", kind: "admin-auth" },
  { path: "/admin/signup", title: "Admin registration", kind: "admin-auth" },
  { path: "/admin/forgot-password", title: "Admin password recovery", kind: "admin-auth" },
  { path: "/admin/reset-password", title: "Admin password reset", kind: "admin-auth" },
  { path: "/documents", title: "My Documents", kind: "student" },
  { path: "/academic-records", title: "Academic Records", kind: "student" },
  { path: "/upload", title: "Upload", kind: "student" },
  { path: "/folders", title: "Folders", kind: "student" },
  { path: "/goals", title: "Goals", kind: "deferred" },
  { path: "/reminders", title: "Reminders", kind: "deferred" },
  { path: "/profile", title: "Profile", kind: "student" },
  { path: "/profile/edit", title: "Edit profile", kind: "student" },
  { path: "/settings", title: "Settings", kind: "student" },
  { path: "/change-password", title: "Change password", kind: "student" },
  { path: "/admin", title: "Admin dashboard", kind: "admin" },
  { path: "/admin/students", title: "Student management", kind: "admin" },
  { path: "/admin/usage", title: "Usage overview", kind: "admin" },
  { path: "/admin/feedback", title: "Communications", kind: "admin" },
];

export function getRoute(pathname) {
  const exactRoute = routeTable.find((route) => route.path === pathname);
  if (exactRoute) return exactRoute;

  const documentMatch = pathname.match(/^\/documents\/([^/]+)$/);
  if (documentMatch) {
    try {
      return {
        path: pathname,
        title: "Document details",
        kind: "document-detail",
        documentId: decodeURIComponent(documentMatch[1]),
      };
    } catch {
      return { path: pathname, title: "Document details", kind: "document-detail", documentId: null };
    }
  }

  const adminStudentMatch = pathname.match(/^\/admin\/students\/([^/]+)$/);
  if (adminStudentMatch) {
    try {
      return {
        path: pathname,
        title: "Sample student details",
        kind: "admin-student-detail",
        studentId: decodeURIComponent(adminStudentMatch[1]),
      };
    } catch {
      return { path: pathname, title: "Sample student details", kind: "admin-student-detail", studentId: null };
    }
  }
  return null;
}
