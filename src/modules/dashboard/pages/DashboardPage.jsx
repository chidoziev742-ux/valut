import { useMemo } from "react";
import {
  Archive, ArrowRight, BookOpen, BriefcaseBusiness, CircleHelp,
  CloudUpload, FileBadge, FileImage, FileText, Folder, FolderOpen,
  GraduationCap, MoreVertical, Sprout, Upload,
} from "lucide-react";
import { documentCategories } from "../../documents/data/mockDocuments.js";

const categoryIcons = [FileBadge, GraduationCap, FileText, Folder, BookOpen, BriefcaseBusiness];
const categoryColors = ["green", "gold", "coral", "purple", "mint", "slate"];
const documentIcons = { PDF: FileText, JPG: FileImage };
const tintByCategory = { "Personal Documents": "green", "Academic Records": "blue", "Financial Documents": "coral", "Course Materials": "purple", Certificates: "green", Other: "slate" };

function toDashboardDocument(document) {
  return {
    name: document.name.replace("Student ID Card", "ID Card").replace("Tuition Payment Receipt", "Tuition Receipt").replace("Semester Result", "Result Slip"),
    type: document.fileType,
    size: document.fileSize,
    date: relativeDate(document.uploadedAt),
    icon: documentIcons[document.fileType] ?? FileText,
    tint: tintByCategory[document.category] ?? "green",
  };
}

function relativeDate(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(`${value}T12:00:00`).getTime()) / 86400000));
  if (days < 1) return "Today";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

const actions = [
  { title: "Upload Document", note: "Add and organize your files", icon: Upload, color: "green", id: "upload" },
  { title: "Create Folder", note: "Keep your documents organized", icon: Folder, color: "gold", id: "folder" },
  { title: "Add Academic Record", note: "Save your results, transcripts and more", icon: GraduationCap, color: "purple", id: "record" },
  { title: "Scan Document", note: "Use your camera to upload", icon: FileBadge, color: "coral", id: "scan" },
];

function MetricCard({ icon: Icon, number, label, caption, color }) {
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

function RecentDocuments({ items, onNotice, onNavigate }) {
  return (
    <section className="panel recent-panel">
      <SectionTitle title="Recent Documents" action="See all" onAction={() => onNavigate("/documents")} />
      <ul className="document-list">
        {items.map(({ name, type, size, date, icon: Icon, tint }) => (
          <li className="document-row" key={name}>
            <span className={"file-icon tone-" + tint}><Icon size={19} /></span>
            <span className="document-main"><strong>{name}</strong><small>{type} · {size}</small></span>
            <time>{date}</time>
            <button className="icon-button" aria-label={"More options for " + name} onClick={() => onNotice(name + " is sample content")}><MoreVertical size={17} /></button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <div className="empty-state"><FolderOpen size={27} /><strong>No matching sample documents</strong><span>Try a different search.</span></div>}
    </section>
  );
}

function QuickActions({ onAction, onSeeAll }) {
  return (
    <section className="panel actions-panel">
      <SectionTitle title="Quick Actions" action="See all" onAction={onSeeAll} />
      <div className="action-grid">
        {actions.map(({ title, note, icon: Icon, color, id }) => (
          <button className={"action-card tone-" + color} key={id} onClick={() => onAction(id)}>
            <span className="action-icon"><Icon size={21} /></span><strong>{title}</strong><small>{note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function StoragePanel({ onNotice }) {
  return (
    <section className="panel storage-panel">
      <div className="storage-head"><h2>Storage Usage</h2><button className="upgrade-button" onClick={() => onNotice("Storage figures are illustrative sample data")}>Learn more</button></div>
      <div className="storage-bar" role="img" aria-label="Illustrative storage usage: 1.8 gigabytes of 5 gigabytes, or 36 percent"><span /></div>
      <div className="storage-meta"><span><strong>1.8 GB</strong> of 5 GB used <em>· sample</em></span><span>36%</span></div>
    </section>
  );
}

function CategorySection({ onNotice, documents, onNavigate }) {
  const categories = documentCategories.map((name, index) => {
    const count = documents.filter((document) => document.category === name && !document.archived).length;
    return { name, count: `${count} ${count === 1 ? "file" : "files"}`, icon: categoryIcons[index], color: categoryColors[index] };
  });
  return (
    <section className="panel category-panel">
      <SectionTitle title="Document Categories" action="Manage categories" onAction={() => onNavigate("/folders")} />
      <div className="category-grid">
        {categories.map(({ name, count, icon: Icon, color }) => (
          <button key={name} className={"category-card tone-" + color} onClick={() => onNotice(name + " · " + count + " (sample data)")}>
            <Icon size={20} /><strong>{name}</strong><span>{count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage({ query, onNotice, onUpload, documents, onNavigate, profile }) {
  const activeDocuments = documents.filter((document) => !document.archived);
  const visibleDocs = useMemo(() => activeDocuments
    .filter((document) => document.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 5)
    .map(toDashboardDocument), [documents, query]);
  const handleAction = (id) => {
    if (id === "upload" || id === "scan") return onUpload();
    if (id === "folder") return onNavigate("/folders");
    if (id === "record") return onNavigate("/academic-records");
  };

  return (
    <div className="content-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">MONDAY, OCTOBER 19</p>
          <h1>Welcome back, {profile.fullName || "Student"} <span aria-hidden="true">👋</span></h1>
          <p className="welcome-subtitle">Your university life, organized in one place.</p>
          <span className="sample-badge">Sample dashboard · illustrative data</span>
        </div>
        <aside className="welcome-note"><span className="sprout" aria-hidden="true"><Sprout size={27} strokeWidth={1.8} /></span><p><strong>Small steps today</strong><br />build your bigger tomorrow.</p></aside>
      </section>
      <section aria-label="Overview" className="metrics-grid">
        <MetricCard icon={FileText} number={activeDocuments.length} label="Documents" caption="active · prototype" color="green" />
        <MetricCard icon={GraduationCap} number={activeDocuments.filter((document) => document.category === "Academic Records").length} label="Academic Records" caption="saved · sample" color="gold" />
        <MetricCard icon={CloudUpload} number="3" label="Pending Uploads" caption="complete to stay up to date" color="coral" />
        <MetricCard icon={Archive} number="—" label="Shared Files" caption="Deferred from MVP" color="purple" />
      </section>
      <div className="dashboard-grid">
        <RecentDocuments items={visibleDocs} onNotice={onNotice} onNavigate={onNavigate} />
        <div className="right-column">
          <QuickActions onAction={handleAction} onSeeAll={() => onNotice("Quick actions are available below")} />
          <StoragePanel onNotice={onNotice} />
        </div>
      </div>
      <CategorySection onNotice={onNotice} documents={documents} onNavigate={onNavigate} />
      <footer className="prototype-footer">Student Vault · Prototype with sample data <CircleHelp size={14} /></footer>
    </div>
  );
}
