import {
  Archive, ArrowRight, Camera,
  CloudUpload, FileBadge, FileText, Folder, GraduationCap, Sprout, Upload,
} from "lucide-react";

const actions = [
  { title: "Upload Document", note: "Add and organize your files", icon: Upload, color: "green", id: "upload" },
  { title: "Create Folder", note: "Keep your documents organized", icon: Folder, color: "gold", id: "folder" },
  { title: "Add Academic Record", note: "Save your results, transcripts and more", icon: GraduationCap, color: "purple", id: "record" },
  { title: "Scan Document", note: "Camera scanning is disabled for now", icon: Camera, color: "green", id: "scanner", disabled: true },
];

function MetricCard({ icon: Icon, number = "—", label, caption, color }) {
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

function RecentDocuments({ items, query, onNavigate }) {
  return (
    <section className="panel recent-panel">
      <SectionTitle title="Recent Documents" action="See all" onAction={() => onNavigate("/documents")} />
      {items.length > 0 ? (
        <ul className="document-list">
          {items.map((document) => (
            <li className="document-row" key={document.id}>
              <span className="file-icon tone-green"><FileText size={19} /></span>
              <span className="document-main"><strong>{document.name}</strong><small>{document.fileType} · {document.fileSize}</small></span>
              <time dateTime={document.uploadedAt}>{document.uploadedAt}</time>
              <button className="icon-button" aria-label={`Open ${document.name}`} onClick={() => onNavigate(`/documents/${encodeURIComponent(document.id)}`)}><ArrowRight size={17} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <FileText size={27} />
          <strong>{query.trim() ? "No saved documents match your search" : "No saved documents yet"}</strong>
          <span>Recent documents will appear here when they are stored in your account.</span>
        </div>
      )}
    </section>
  );
}

function QuickActions({ onAction, onSeeAll }) {
  return (
    <section className="panel actions-panel">
      <SectionTitle title="Quick Actions" action="See all" onAction={onSeeAll} />
      <div className="action-grid">
        {actions.map(({ title, note, icon: Icon, color, id, disabled = false }) => (
          <button className={`action-card tone-${color}${disabled ? " action-card-disabled" : ""}`} key={id} onClick={() => onAction(id)} disabled={disabled} aria-label={disabled ? `${title}, disabled. ${note}` : undefined}>
            <span className="action-icon"><Icon size={21} /></span><strong>{title}{disabled && <span className="action-disabled-badge">Disabled</span>}</strong><small>{note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataAvailabilityPanel({ title, children }) {
  return (
    <section className="panel dashboard-data-panel">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

export default function DashboardPage({
  query,
  onNotice,
  onUpload,
  onNavigate,
  onRetryProfile,
  profile,
  profileLoading = false,
  profileError = "",
  profileMissing = false,
  documents = [],
  documentSummary = null,
  documentsLoading = false,
  documentsError = "",
  onRetryDocuments,
}) {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
  const profileSummary = "Your university life, organized in one place.";
  const activeDocuments = documents.filter((document) => !document.archived);
  const recentDocuments = [...activeDocuments]
    .filter((document) => document.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
    .slice(0, 5);
  const totalStorageBytes = documentSummary?.activeStorageBytes ?? 0;
  const storageValue = totalStorageBytes < 1024 * 1024
    ? `${totalStorageBytes === 0 ? 0 : Math.max(1, Math.round(totalStorageBytes / 1024))} KB`
    : `${(totalStorageBytes / (1024 * 1024)).toFixed(1)} MB`;

  const handleAction = (id) => {
    if (id === "upload") return onUpload();
    if (id === "folder") return onNavigate("/folders");
    if (id === "record") return onNavigate("/academic-records");
  };

  return (
    <div className="content-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>Welcome back, {profile.fullName || "Student"} <span aria-hidden="true">👋</span></h1>
          <p className="welcome-subtitle">{profileSummary}</p>
        </div>
        <aside className="welcome-note"><span className="sprout" aria-hidden="true"><Sprout size={27} strokeWidth={1.8} /></span><p><strong>Small steps today</strong><br />build your bigger tomorrow.</p></aside>
      </section>

      {profileLoading && <p className="dashboard-data-status" role="status">Refreshing your profile…</p>}
      {profileError && (
        <div className="dashboard-data-error" role="alert">
          <span>{profileError}</span>
          <button type="button" onClick={onRetryProfile}>Try again</button>
        </div>
      )}
      {profileMissing && (
        <div className="dashboard-data-status">
          Your student profile has not been set up. <button type="button" onClick={() => onNavigate("/profile/setup")}>Set it up</button>
        </div>
      )}
      {documentsLoading && <p className="dashboard-data-status" role="status">Loading your documents…</p>}
      {documentsError && (
        <div className="dashboard-data-error" role="alert">
          <span>{documentsError}</span>
          <button type="button" onClick={onRetryDocuments}>Try again</button>
        </div>
      )}

      <section aria-label="Overview" className="metrics-grid">
        <MetricCard icon={FileText} number={documentsLoading || documentsError || !documentSummary ? "—" : documentSummary.activeCount} label="Documents" caption={documentsError ? "Unavailable" : "active"} color="green" />
        <MetricCard icon={GraduationCap} number={documentsLoading || documentsError || !documentSummary ? "—" : documentSummary.academicDocumentsCount} label="Academic Records" caption="documents in this category" color="gold" />
        <MetricCard icon={CloudUpload} label="Pending Uploads" caption="Not available yet" color="coral" />
        <MetricCard icon={Archive} label="Shared Files" caption="Not available yet" color="purple" />
      </section>
      <div className="dashboard-grid">
        <RecentDocuments items={documentsError ? [] : recentDocuments} query={query} onNavigate={onNavigate} />
        <div className="right-column">
          <QuickActions onAction={handleAction} onSeeAll={() => onNotice("Quick actions are available below")} />
          <DataAvailabilityPanel title="Storage Usage">{documentsError ? "Storage information is unavailable." : `${storageValue} stored in active documents. Total available quota is not configured.`}</DataAvailabilityPanel>
        </div>
      </div>
      <DataAvailabilityPanel title="Document Categories">
        {documentsError
          ? "Category counts are unavailable."
          : (documentSummary?.categoryCounts ?? [])
            .map(({ category, count }) => `${category}: ${count}`)
            .join(" · ") || "No saved document categories yet."}
      </DataAvailabilityPanel>
      <DataAvailabilityPanel title="Academic Overview">Academic statistics will appear when academic records are stored in your account.</DataAvailabilityPanel>
    </div>
  );
}
