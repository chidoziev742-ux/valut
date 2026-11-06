import { Database, FileStack, HardDrive, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/apiClient.js";
import "../styles/admin-usage.css";

const numberFormat = new Intl.NumberFormat("en");

function formatStorage(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unitIndex)).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function UsageMetric({ icon: Icon, label, value, description }) {
  return (
    <article className="admin-usage-metric">
      <span className="admin-usage-metric-icon" aria-hidden="true"><Icon size={20} /></span>
      <div><p>{label}</p><strong>{value}</strong><small>{description}</small></div>
    </article>
  );
}

function DocumentTypeBreakdown({ types, total }) {
  return (
    <section className="admin-usage-panel" aria-labelledby="usage-types-title">
      <header className="admin-usage-panel-heading">
        <div><p className="admin-kicker">DOCUMENTS</p><h2 id="usage-types-title">Documents by file type</h2></div>
        <span className="admin-usage-label">{numberFormat.format(total)} documents</span>
      </header>
      {types.length ? (
        <ul className="admin-type-list">
          {types.map((type) => (
            <li className="admin-type-item" key={type.id}>
              <div className="admin-type-row"><strong>{type.label}</strong><span>{numberFormat.format(type.count)} <small>· {type.share}% of documents</small></span></div>
              <div className={`admin-type-track type-${type.color}`} role="progressbar" aria-label={`${type.label}: ${numberFormat.format(type.count)} documents, ${type.share}% of total documents`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={type.share}>
                <span style={{ width: `${type.share}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="admin-usage-empty" role="status">No file-type data is available.</p>}
      {types.length > 0 && <div className="admin-type-axis" aria-hidden="true"><span>0%</span><span>Share of documents</span><span>100%</span></div>}
      <p className="admin-usage-footnote">Percentages show the distribution of document file types.</p>
    </section>
  );
}

function RegistrationTrend({ entries }) {
  const max = Math.max(...entries.map((entry) => entry.count), 1);
  return (
    <section className="admin-usage-panel" aria-labelledby="usage-trend-title">
      <header className="admin-usage-panel-heading">
        <div><p className="admin-kicker">REGISTRATIONS</p><h2 id="usage-trend-title">Student registration trend</h2></div>
        <span className="admin-usage-label">Students</span>
      </header>
      {entries.length ? (
        <>
          <figure className="admin-usage-chart" aria-labelledby="usage-trend-title" aria-describedby="usage-trend-caption">
            <div className="admin-usage-chart-plot">
              <div className="admin-usage-y-axis" aria-hidden="true"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
              <div className="admin-usage-plot-main">
                <div className="admin-usage-plot-area">
                  <div className="admin-usage-chart-grid" aria-hidden="true"><i /><i /><i /></div>
                  <div className="admin-usage-chart-bars" role="img" aria-label={`Student registrations: ${entries.map(({ period, count }) => `${period}, ${count} students`).join("; ")}`}>
                    {entries.map(({ period, month, count }) => {
                      const barHeight = Math.max(10, count / max * 100);
                      return (
                        <div className="admin-usage-chart-column" key={period} style={{ "--usage-height": `${barHeight}%` }}>
                          <span className="admin-usage-chart-value">{count}</span>
                          <span className="admin-usage-chart-bar" />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="admin-usage-chart-axis" aria-hidden="true">{entries.map(({ month, period }) => <span key={period}>{month}</span>)}</div>
              </div>
            </div>
            <figcaption id="usage-trend-caption">New student accounts by month. Full month and year appear in the accessible chart description and data table.</figcaption>
          </figure>
          <details className="admin-usage-data-table">
            <summary>View trend data table</summary>
            <table><caption className="sr-only">Student registration trend</caption><thead><tr><th scope="col">Month</th><th scope="col">Registrations</th></tr></thead><tbody>{entries.map(({ period, count }) => <tr key={period}><th scope="row">{period}</th><td>{numberFormat.format(count)}</td></tr>)}</tbody></table>
          </details>
        </>
      ) : <p className="admin-usage-empty" role="status">No registration data is available.</p>}
    </section>
  );
}

function LargestStudents({ entries }) {
  return (
    <section className="admin-usage-panel" aria-labelledby="usage-largest-title">
      <header className="admin-usage-panel-heading">
        <div><p className="admin-kicker">STORAGE</p><h2 id="usage-largest-title">Largest student storage users</h2></div>
        <span className="admin-usage-label">Top {entries.length}</span>
      </header>
      {entries.length ? <ul className="admin-usage-simple-list">
        {entries.map((entry) => <li key={entry.id}><span><strong>{entry.fullName}</strong><small>{numberFormat.format(entry.documentCount)} documents</small></span><b>{formatStorage(entry.storageBytes)}</b></li>)}
      </ul> : <p className="admin-usage-empty" role="status">No student storage data is available.</p>}
    </section>
  );
}

function RecentUploads({ entries }) {
  return (
    <section className="admin-usage-panel" aria-labelledby="usage-uploads-title">
      <header className="admin-usage-panel-heading">
        <div><p className="admin-kicker">ACTIVITY</p><h2 id="usage-uploads-title">Recent uploads</h2></div>
        <span className="admin-usage-label">Latest documents</span>
      </header>
      {entries.length ? <ul className="admin-usage-simple-list">
        {entries.map((entry) => <li key={entry.id}><span><strong>{entry.fileType} document</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></span><b>{formatStorage(entry.fileSize)}</b></li>)}
      </ul> : <p className="admin-usage-empty" role="status">No document uploads yet.</p>}
    </section>
  );
}

export default function AdminUsagePage() {
  const [usage, setUsage] = useState(null);
  const [request, setRequest] = useState({ status: "loading", error: "" });

  useEffect(() => {
    let active = true;
    apiRequest("/api/admin/usage")
      .then((payload) => {
        if (active) {
          setUsage(payload);
          setRequest({ status: "loaded", error: "" });
        }
      })
      .catch((error) => {
        if (active) setRequest({ status: "error", error: error.message || "We couldn't load usage data. Please try again." });
      });
    return () => { active = false; };
  }, []);

  const totals = usage?.totals;
  const documentCount = totals?.documentCount ?? 0;
  const documentTypes = (usage?.documentTypes ?? []).map((type) => ({
    ...type,
    label: `${type.fileType} documents`,
    share: documentCount ? Math.round((type.count / documentCount) * 100) : 0,
    color: type.fileType === "PDF" ? "forest" : type.fileType === "PNG" ? "gold" : "coral",
  }));
  const errorState = request.status === "error";
  return (
    <div className="content-wrap admin-usage-page">
      <header className="admin-usage-heading">
        <div><p className="admin-kicker">ADMIN AREA · USAGE OVERVIEW</p><h1>Platform usage</h1><p>Aggregate summaries for Vaultori.</p></div>
      </header>

      <section className="admin-usage-metrics" aria-label="Platform totals">
        <UsageMetric icon={HardDrive} label="Storage consumed" value={totals ? formatStorage(totals.storageBytes) : "—"} description="Total student document storage" />
        <UsageMetric icon={FileStack} label="Document records" value={totals ? numberFormat.format(documentCount) : "—"} description="Total student documents" />
        <UsageMetric icon={Database} label="Upload totals" value={totals ? numberFormat.format(documentCount) : "—"} description="Documents uploaded" />
      </section>

      {errorState
        ? <p className="admin-usage-empty" role="alert">{request.error}</p>
        : <div className="admin-usage-grid">
          <DocumentTypeBreakdown types={documentTypes} total={documentCount} />
          <RegistrationTrend entries={usage?.registrationTrend ?? []} />
          <LargestStudents entries={usage?.largestStudents ?? []} />
          <RecentUploads entries={usage?.recentUploads ?? []} />
        </div>}
      <p className="admin-usage-endnote"><TrendingUp size={15} aria-hidden="true" /> Aggregate usage only. No passwords, tokens, document contents or email addresses are shown.</p>
    </div>
  );
}
