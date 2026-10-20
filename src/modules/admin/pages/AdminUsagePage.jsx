import { Database, FileStack, HardDrive, TrendingUp } from "lucide-react";
import { mockAdminUsage } from "../data/mockAdminUsage.js";
import "../styles/admin-usage.css";

const numberFormat = new Intl.NumberFormat("en");

function formatStorage(value) {
  return `${value.toFixed(1)} GB`;
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
        <div><p className="admin-kicker">ILLUSTRATIVE DISTRIBUTION</p><h2 id="usage-types-title">Documents by file type</h2></div>
        <span className="admin-usage-label">{numberFormat.format(total)} sample docs</span>
      </header>
      {types.length ? (
        <ul className="admin-type-list">
          {types.map((type) => (
            <li className="admin-type-item" key={type.id}>
              <div className="admin-type-row"><strong>{type.label}</strong><span>{numberFormat.format(type.count)} <small>· {type.share}% of documents</small></span></div>
              <div className={`admin-type-track type-${type.color}`} role="progressbar" aria-label={`${type.label}: ${numberFormat.format(type.count)} documents, ${type.share}% of illustrative document count`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={type.share}>
                <span style={{ width: `${type.share}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="admin-usage-empty" role="status">No illustrative file-type data is available.</p>}
      {types.length > 0 && <div className="admin-type-axis" aria-hidden="true"><span>0%</span><span>Share of documents</span><span>100%</span></div>}
      <p className="admin-usage-footnote">Percentages describe the sample document count only, not storage capacity.</p>
    </section>
  );
}

function StorageTrend({ entries }) {
  const max = Math.max(...entries.map((entry) => entry.storageGb), 1);
  return (
    <section className="admin-usage-panel" aria-labelledby="usage-trend-title">
      <header className="admin-usage-panel-heading">
        <div><p className="admin-kicker">SAMPLE HISTORY</p><h2 id="usage-trend-title">Storage trend</h2></div>
        <span className="admin-usage-label">GB · illustrative</span>
      </header>
      {entries.length ? (
        <>
          <figure className="admin-usage-chart" aria-labelledby="usage-trend-title" aria-describedby="usage-trend-caption">
            <div className="admin-usage-chart-plot">
              <div className="admin-usage-y-axis" aria-hidden="true"><span>{Math.ceil(max)} GB</span><span>{Math.round(max / 2)} GB</span><span>0 GB</span></div>
              <div className="admin-usage-plot-main">
                <div className="admin-usage-plot-area">
                  <div className="admin-usage-chart-grid" aria-hidden="true"><i /><i /><i /></div>
                  <div className="admin-usage-chart-bars" role="img" aria-label={`Illustrative platform-wide storage trend: ${entries.map(({ period, storageGb }) => `${period}, ${storageGb} gigabytes`).join("; ")}`}>
                    {entries.map(({ period, storageGb }) => {
                      const barHeight = Math.max(10, storageGb / max * 100);
                      return (
                        <div className="admin-usage-chart-column" key={period} style={{ "--usage-height": `${barHeight}%` }}>
                          <span className="admin-usage-chart-value">{storageGb.toFixed(0)}</span>
                          <span className="admin-usage-chart-bar" />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="admin-usage-chart-axis" aria-hidden="true">{entries.map(({ month, period }) => <span key={period}>{month}</span>)}</div>
              </div>
            </div>
            <figcaption id="usage-trend-caption">Platform-wide sample storage in GB. Month labels are abbreviated for space; full month and year appear in the accessible chart description and data table. No storage capacity is configured.</figcaption>
          </figure>
          <details className="admin-usage-data-table">
            <summary>View trend data table</summary>
            <table><caption className="sr-only">Illustrative platform-wide storage trend in gigabytes</caption><thead><tr><th scope="col">Month</th><th scope="col">Storage consumed</th></tr></thead><tbody>{entries.map(({ period, storageGb }) => <tr key={period}><th scope="row">{period}</th><td>{formatStorage(storageGb)}</td></tr>)}</tbody></table>
          </details>
        </>
      ) : <p className="admin-usage-empty" role="status">No illustrative storage trend is available.</p>}
    </section>
  );
}

export default function AdminUsagePage() {
  const { storageConsumedGb, documentCount, documentTypes, monthlyStorageTrend } = mockAdminUsage;
  return (
    <div className="content-wrap admin-usage-page">
      <header className="admin-usage-heading">
        <div><p className="admin-kicker">ADMIN AREA · USAGE OVERVIEW</p><h1>Platform usage</h1><p>Illustrative aggregate summaries for the Student Vault prototype.</p></div>
        <span className="admin-sample-badge">Fictional sample data</span>
      </header>

      <aside className="admin-usage-notice" aria-label="Prototype limitation">
        <span aria-hidden="true">i</span>
        <p><strong>Prototype only.</strong> These fictional platform-wide figures are not live measurements. No cloud storage is connected, and no storage quota or capacity limit is configured.</p>
      </aside>

      <section className="admin-usage-metrics" aria-label="Illustrative platform totals">
        <UsageMetric icon={HardDrive} label="Storage consumed" value={formatStorage(storageConsumedGb)} description="Illustrative aggregate · no quota configured" />
        <UsageMetric icon={FileStack} label="Document records" value={numberFormat.format(documentCount)} description="Illustrative total across the sample dataset" />
        <UsageMetric icon={Database} label="Measurement source" value="Sample data" description="No live storage or database connection" />
      </section>

      <div className="admin-usage-grid">
        <DocumentTypeBreakdown types={documentTypes} total={documentCount} />
        <StorageTrend entries={monthlyStorageTrend} />
      </div>
      <p className="admin-usage-endnote"><TrendingUp size={15} aria-hidden="true" /> No individual student activity or document contents are shown on this page.</p>
    </div>
  );
}
