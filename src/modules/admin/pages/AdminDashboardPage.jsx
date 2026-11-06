import { ArrowUpRight, BarChart3, FileText, MessageSquare, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/apiClient.js";
import "../styles/admin.css";

const icons = {
  students: Users,
  documents: FileText,
  activity: BarChart3,
  communications: MessageSquare,
};

const destinations = [
  { href: "/admin/students", title: "Student management", description: "Manage student records.", icon: Users },
  { href: "/admin/usage", title: "Usage overview", description: "Review platform usage.", icon: BarChart3 },
  { href: "/admin/feedback", title: "Communications", description: "Compose and review announcements.", icon: MessageSquare },
];

function MetricCard({ metric }) {
  const Icon = icons[metric.icon];
  return (
    <article className="admin-metric">
      <span className="admin-metric-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9} /></span>
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** unitIndex)).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function RecentRegistrations({ entries }) {
  return (
    <section className="admin-panel admin-activity" aria-labelledby="admin-registrations-title">
      <div className="admin-panel-heading">
        <div><p className="admin-kicker">RECENT REGISTRATIONS</p><h2 id="admin-registrations-title">Recent registrations</h2></div>
        <span className="admin-period">Latest student accounts</span>
      </div>
      {entries.length ? (
        <div className="admin-registration-list">
          {entries.map((entry) => (
            <div className="admin-registration" key={entry.id}>
              <span className="admin-registration-icon" aria-hidden="true"><Users size={16} /></span>
              <span className="admin-registration-copy">
                <strong>{entry.fullName || entry.email}</strong>
                <small>{entry.fullName ? entry.email : "Student account"}</small>
              </span>
              <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
            </div>
          ))}
        </div>
      ) : <p className="admin-chart-empty">No student registrations yet.</p>}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [request, setRequest] = useState({ status: "loading", error: "" });

  useEffect(() => {
    let active = true;
    setRequest({ status: "loading", error: "" });
    apiRequest("/api/admin/dashboard")
      .then((payload) => {
        if (!active) return;
        setDashboard(payload);
        setRequest({ status: "loaded", error: "" });
      })
      .catch((error) => {
        if (active) setRequest({
          status: "error",
          error: error.message || "We couldn't load the admin dashboard. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = dashboard?.metrics;
  const metricCards = [
    { id: "students", label: "Total students", value: metrics?.totalStudents ?? "—", detail: "Registered student accounts", icon: "students" },
    { id: "verified", label: "Verified students", value: metrics?.verifiedStudents ?? "—", detail: "Email-verified accounts", icon: "students" },
    { id: "active", label: "Active students", value: metrics?.activeStudents ?? "—", detail: `${metrics?.disabledStudents ?? "—"} disabled`, icon: "activity" },
    { id: "documents", label: "Documents", value: metrics?.totalDocuments ?? "—", detail: `${formatBytes(metrics?.totalStorageBytes)} stored`, icon: "documents" },
  ];
  return (
    <div className="content-wrap admin-dashboard" aria-labelledby="admin-dashboard-title">
      <header className="admin-page-heading">
        <div>
          <p className="admin-kicker">ADMIN AREA</p>
          <h1 id="admin-dashboard-title">Admin overview</h1>
          <p className="admin-page-description">Tools that support the Vaultori community.</p>
        </div>
      </header>

      <section className="admin-metrics" aria-label="Overview figures">
        {metricCards.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
      </section>

      <div className="admin-dashboard-grid">
        {request.status === "error"
          ? <section className="admin-panel admin-data-state" role="alert"><p>{request.error}</p></section>
          : <RecentRegistrations entries={dashboard?.recentRegistrations ?? []} />}
        <section className="admin-panel admin-next-steps" aria-labelledby="admin-workspace-title">
          <div className="admin-panel-heading">
            <div><p className="admin-kicker">ADMIN WORKSPACE</p><h2 id="admin-workspace-title">Explore an area</h2></div>
          </div>
          <nav className="admin-destination-list" aria-label="Admin destinations">
            {destinations.map(({ href, title, description, icon: Icon }) => (
              <a className="admin-destination" href={href} key={href}>
                <span className="admin-destination-icon" aria-hidden="true"><Icon size={19} /></span>
                <span className="admin-destination-copy"><strong>{title}</strong><small>{description}</small></span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            ))}
          </nav>
        </section>
      </div>
    </div>
  );
}
