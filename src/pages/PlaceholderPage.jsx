import {
  ArrowLeft, BookOpen, CircleHelp, FileText, Folder, GraduationCap,
  Mail, Settings, Shield, Sparkles, Upload, UserRound, Users,
} from "lucide-react";
import { adminNavigation } from "../routeConfig.js";

const icons = {
  auth: Sparkles,
  student: FileText,
  deferred: CircleHelp,
  admin: Shield,
  notFound: CircleHelp,
};

const phaseDescriptions = {
  "/welcome": "Welcome and onboarding screens are scheduled for Phase 2.",
  "/onboarding": "The onboarding flow is scheduled for Phase 2. No account or profile data is saved here.",
  "/sign-up": "Account creation UI is scheduled for Phase 2. No account is created here.",
  "/login": "Login UI is scheduled for Phase 2. No credentials are checked here.",
  "/forgot-password": "Password recovery UI is scheduled for Phase 2. No email is sent here.",
  "/reset-password": "Password reset UI is scheduled for Phase 2. No password is changed here.",
  "/verify": "Verification UI is scheduled for Phase 2. No verification code is issued or checked here.",
  "/profile/setup": "Student profile setup is scheduled for Phase 2. This placeholder does not save profile data.",
  "/documents": "The document library and its search, filters, sorting, and detail views are scheduled for later frontend phases.",
  "/academic-records": "Academic record screens are scheduled for Phase 6 and will use labeled sample data.",
  "/upload": "The upload workflow is scheduled for Phase 5. Files are not uploaded or stored in this placeholder.",
  "/folders": "Folder and category management is scheduled for Phase 6.",
  "/goals": "Goals are deferred from the approved MVP.",
  "/reminders": "Reminders are deferred from the approved MVP.",
  "/profile": "Student profile screens are scheduled for Phase 7. The displayed profile is sample content.",
  "/settings": "Settings and notification preferences are scheduled for Phase 7. Changes are not saved here.",
  "/admin": "The admin interface is scheduled for Phase 8. This placeholder grants no administrative access.",
  "/admin/students": "Student management is scheduled for Phase 8. No student data is available here.",
  "/admin/usage": "Usage overview is scheduled for Phase 8. No real usage is measured here.",
  "/admin/feedback": "Feedback and survey screens are scheduled for Phase 8. No feedback is submitted here.",
};

const placeholderActions = [
  { label: "Dashboard", path: "/", icon: BookOpen },
  { label: "Sign up", path: "/sign-up", icon: UserRound },
  { label: "Login", path: "/login", icon: Mail },
  { label: "Documents", path: "/documents", icon: Folder },
  { label: "Upload", path: "/upload", icon: Upload },
  { label: "Academic records", path: "/academic-records", icon: GraduationCap },
  { label: "Profile", path: "/profile", icon: Settings },
];

export default function PlaceholderPage({ route }) {
  const Icon = route ? icons[route.kind] ?? FileText : icons.notFound;
  const isDeferred = route?.kind === "deferred";
  const isAdmin = route?.kind === "admin";

  return (
    <div className="content-wrap">
      <section className="route-placeholder panel" aria-labelledby="placeholder-title">
        <span className="placeholder-icon"><Icon size={24} /></span>
        <p className="placeholder-eyebrow">{isDeferred ? "DEFERRED FROM MVP" : isAdmin ? "PHASE 8 PLACEHOLDER" : route?.kind === "auth" ? "PHASE 2 PLACEHOLDER" : "FRONTEND PHASE PLACEHOLDER"}</p>
        <h1 id="placeholder-title">{route?.title ?? "Page not found"}</h1>
        <p className="placeholder-description">{route ? phaseDescriptions[route.path] : "This route is not part of the current frontend plan."}</p>
        <p className="placeholder-boundary">Prototype boundary: this page is a labeled placeholder. It does not authenticate users, read or save records, send messages, or connect to a backend.</p>

        {isAdmin && <section className="placeholder-link-group" aria-label="Admin routes">
          <h2>Admin area routes</h2>
          <div className="placeholder-link-grid">{adminNavigation.map((item) => <a key={item.path} href={item.path}><Users size={17} />{item.label}</a>)}</div>
        </section>}

        {route?.kind === "auth" && <section className="placeholder-link-group" aria-label="Authentication routes">
          <h2>Authentication entry points</h2>
          <div className="placeholder-link-grid">
            {[["Welcome", "/welcome"], ["Onboarding", "/onboarding"], ["Sign up", "/sign-up"], ["Login", "/login"], ["Forgot password", "/forgot-password"], ["Reset password", "/reset-password"], ["Verification", "/verify"], ["Profile setup", "/profile/setup"]].map(([label, path]) => <a key={path} href={path}>{label}</a>)}
          </div>
        </section>}

        <div className="placeholder-actions">
          {placeholderActions.slice(0, 5).map((item) => <a key={item.path} href={item.path}><item.icon size={16} />{item.label}</a>)}
          <a href="/" className="placeholder-back"><ArrowLeft size={16} />Back to dashboard</a>
        </div>
      </section>
    </div>
  );
}
