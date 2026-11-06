import {
  ArrowLeft, BookOpen, CircleHelp, FileText, Folder, GraduationCap,
  Mail, Settings, Shield, Upload, UserRound, Users,
} from "lucide-react";
import { adminNavigation } from "../routeConfig.js";

const icons = {
  student: FileText,
  deferred: CircleHelp,
  admin: Shield,
  notFound: CircleHelp,
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
        <h1 id="placeholder-title">{route?.title ?? "Page not found"}</h1>
        {isDeferred && <p className="placeholder-coming-soon">Coming soon</p>}

        {isAdmin && <section className="placeholder-link-group" aria-label="Admin routes">
          <h2>Admin area routes</h2>
          <div className="placeholder-link-grid">{adminNavigation.map((item) => <a key={item.path} href={item.path}><Users size={17} />{item.label}</a>)}</div>
        </section>}

        <div className="placeholder-actions">
          {isDeferred ? <a href="/" className="placeholder-back"><ArrowLeft size={16} />Back to Home</a> : <>
            {placeholderActions.slice(0, 5).map((item) => <a key={item.path} href={item.path}><item.icon size={16} />{item.label}</a>)}
            <a href="/" className="placeholder-back"><ArrowLeft size={16} />Back to dashboard</a>
          </>}
        </div>
      </section>
    </div>
  );
}
