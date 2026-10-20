import { ArrowUpRight, BarChart3, FileText, MessageSquare, Users } from "lucide-react";
import { adminDashboardSample } from "../data/mockAdminDashboard.js";
import "../styles/admin.css";

const icons = {
  students: Users,
  documents: FileText,
  activity: BarChart3,
  feedback: MessageSquare,
};

const destinations = [
  { href: "/admin/students", title: "Student management", description: "Review the planned student directory and management tools.", icon: Users },
  { href: "/admin/usage", title: "Usage overview", description: "Explore the planned platform usage overview.", icon: BarChart3 },
  { href: "/admin/feedback", title: "Feedback and surveys", description: "Review the planned feedback and survey workspace.", icon: MessageSquare },
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

function ActivityChart({ entries }) {
  const highest = Math.max(...entries.map(({ value }) => value), 1);
  return (
    <section className="admin-panel admin-activity" aria-labelledby="admin-activity-title">
      <div className="admin-panel-heading">
        <div><p className="admin-kicker">ILLUSTRATIVE SAMPLE</p><h2 id="admin-activity-title">Platform activity</h2></div>
        <span className="admin-period">Last 6 months · sample</span>
      </div>
      {entries.length ? (
        <div className="admin-chart" role="img" aria-label={`Illustrative platform activity sample: ${entries.map(({ label, value }) => `${label} ${value}`).join(", ")}`}>
          <div className="admin-chart-grid" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="admin-chart-bars" aria-hidden="true">
            {entries.map(({ label, value }) => (
              <div className="admin-chart-column" key={label}>
                <span className="admin-chart-value">{value}</span>
                <span className="admin-chart-bar" style={{ height: `${Math.max(8, (value / highest) * 100)}%` }} />
                <span className="admin-chart-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="admin-chart-empty">No illustrative activity samples are available.</p>}
      <p className="admin-chart-note">Example activity counts only. No live usage is measured.</p>
    </section>
  );
}

export default function AdminDashboardPage() {
  const { metrics, activity } = adminDashboardSample;
  return (
    <div className="content-wrap admin-dashboard" aria-labelledby="admin-dashboard-title">
      <header className="admin-page-heading">
        <div>
          <p className="admin-kicker">ADMIN AREA · FRONTEND PROTOTYPE</p>
          <h1 id="admin-dashboard-title">Admin overview</h1>
          <p className="admin-page-description">A starting point for the tools that support the Student Vault community.</p>
        </div>
        <span className="admin-sample-badge">Illustrative data</span>
      </header>

      <aside className="admin-prototype-notice" aria-label="Prototype limitation">
        <span className="admin-notice-mark" aria-hidden="true">i</span>
        <p><strong>Prototype preview.</strong> Every figure below is fictional sample data. This interface does not access live student records or provide administrative authorization.</p>
      </aside>

      <section className="admin-metrics" aria-label="Illustrative overview figures">
        {metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
      </section>

      <div className="admin-dashboard-grid">
        <ActivityChart entries={activity} />
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
          <p className="admin-coming-note"><FileText size={15} aria-hidden="true" /> These destinations are separate prototype screens.</p>
        </section>
      </div>
    </div>
  );
}
