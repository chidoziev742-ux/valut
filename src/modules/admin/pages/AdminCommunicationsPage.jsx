import { useMemo, useState } from "react";
import {
  Bell, CalendarDays, Check, Eye, Mail, Megaphone, Search, Send,
  UsersRound, X,
} from "lucide-react";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import { adminStudentLevels } from "../data/mockAdminStudents.js";
import {
  communicationStatuses,
  mockAdminCommunications,
} from "../data/mockAdminCommunications.js";
import "../styles/admin-communications.css";

const emptyDraft = { subject: "", message: "", recipientMode: "all", recipientGroup: adminStudentLevels[0], channels: ["Email"] };

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function recipientLabel(draft) {
  return draft.recipientMode === "all" ? "All students" : draft.recipientGroup;
}

function AnnouncementPreview({ draft, onClose, onSaveDraft, onMarkSent }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="admin-communications-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="admin-communications-preview" role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title">
        <button className="admin-communications-close" type="button" onClick={onClose} aria-label="Close announcement preview"><X size={19} /></button>
        <span className="admin-communications-preview-icon" aria-hidden="true"><Eye size={21} /></span>
        <p className="admin-communications-eyebrow">PROTOTYPE PREVIEW</p>
        <h2 id="announcement-preview-title">{draft.subject}</h2>
        <dl className="admin-communications-preview-meta">
          <div><dt>Recipients</dt><dd>{recipientLabel(draft)}</dd></div>
          <div><dt>Channels</dt><dd>{draft.channels.join(" and ")}</dd></div>
        </dl>
        <div className="admin-communications-preview-body"><p>{draft.message}</p></div>
        <p className="admin-communications-boundary">Preview only. Confirming a prototype action will not deliver email or in-app notifications.</p>
        <div className="admin-communications-preview-actions">
          <button className="admin-communications-button secondary" type="button" onClick={onClose}>Edit announcement</button>
          <button className="admin-communications-button secondary" type="button" onClick={onSaveDraft}>Save as draft</button>
          <button className="admin-communications-button primary" type="button" onClick={onMarkSent}><Send size={15} /> Mark as sent · prototype</button>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`admin-communications-status status-${status.toLowerCase()}`}><span aria-hidden="true" />{status}<small>sample</small></span>;
}

export default function AdminCommunicationsPage() {
  const [history, setHistory] = useState(mockAdminCommunications);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const visibleHistory = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return history.filter((item) => {
      const searchable = [item.subject, item.message, item.recipients, ...item.channels].join(" ").toLocaleLowerCase();
      return (!term || searchable.includes(term)) && (!statusFilter || item.status === statusFilter);
    });
  }, [history, query, statusFilter]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setNotice("");
  };

  const toggleChannel = (channel) => {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((value) => value !== channel)
        : [...current.channels, channel],
    }));
    setErrors((current) => ({ ...current, channels: "" }));
    setNotice("");
  };

  const openPreview = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!draft.subject.trim()) nextErrors.subject = "Enter an announcement subject.";
    else if (draft.subject.trim().length > 120) nextErrors.subject = "Keep the subject to 120 characters or fewer.";
    if (!draft.message.trim()) nextErrors.message = "Enter an announcement message.";
    else if (draft.message.trim().length > 3000) nextErrors.message = "Keep the message to 3,000 characters or fewer.";
    if (!draft.channels.length) nextErrors.channels = "Choose at least one delivery channel.";
    setErrors(nextErrors);
    setNotice("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(`communication-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setPreviewOpen(true);
  };

  const recordAction = (status) => {
    const now = new Date().toISOString().slice(0, 10);
    const record = {
      id: globalThis.crypto?.randomUUID?.() ?? `communication-${Date.now()}`,
      subject: draft.subject.trim(),
      message: draft.message.trim(),
      recipients: recipientLabel(draft),
      channels: [...draft.channels],
      status,
      createdAt: now,
    };
    setHistory((current) => [record, ...current]);
    setDraft(emptyDraft);
    setErrors({});
    setPreviewOpen(false);
    setNotice(status === "Draft"
      ? "Draft added to this prototype session. It was not delivered."
      : "Marked Sent in prototype history only. No email or in-app notification was delivered.");
  };

  const openDraft = (item) => {
    const isGroup = item.recipients !== "All students";
    setDraft({
      subject: item.subject,
      message: item.message,
      recipientMode: isGroup ? "group" : "all",
      recipientGroup: isGroup ? item.recipients : adminStudentLevels[0],
      channels: [...item.channels],
    });
    setErrors({});
    setNotice("Sample draft loaded into the composer. Changes remain in this session.");
    document.getElementById("communication-compose-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("communication-subject")?.focus({ preventScroll: true });
  };

  const clearHistoryFilters = () => { setQuery(""); setStatusFilter(""); };

  return (
    <div className="content-wrap admin-communications-page">
      <header className="admin-communications-heading">
        <div><p className="admin-communications-eyebrow">ADMIN AREA · COMMUNICATIONS</p><h1>Communications</h1><p>Prepare announcements and review fictional communication history.</p></div>
        <span className="admin-communications-badge">Frontend prototype</span>
      </header>

      <aside className="admin-communications-notice" aria-label="Prototype limitation">
        <span aria-hidden="true">i</span><p><strong>Illustrative only.</strong> This workspace uses fictional sample data. It cannot deliver email, send in-app notifications, or access live student accounts.</p>
      </aside>

      {notice && <p className="admin-communications-feedback" role="status"><Check size={16} />{notice}</p>}

      <section className="admin-communications-panel" aria-labelledby="communication-compose-title">
        <div className="admin-communications-panel-heading">
          <span className="admin-communications-section-icon" aria-hidden="true"><Megaphone size={19} /></span>
          <div><p className="admin-communications-eyebrow">COMPOSE</p><h2 id="communication-compose-title">New announcement</h2><p>Draft and preview a message for the selected audience.</p></div>
        </div>
        <form className="admin-communications-form" onSubmit={openPreview} noValidate>
          <label className="admin-communications-field" htmlFor="communication-subject">Subject or title
            <input id="communication-subject" value={draft.subject} maxLength={120} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "communication-subject-error" : undefined} onChange={(event) => updateDraft("subject", event.target.value)} />
            {errors.subject && <small id="communication-subject-error" role="alert">{errors.subject}</small>}
          </label>
          <label className="admin-communications-field" htmlFor="communication-message">Message
            <textarea id="communication-message" rows="5" maxLength={3000} value={draft.message} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "communication-message-error" : "communication-message-hint"} onChange={(event) => updateDraft("message", event.target.value)} />
            {errors.message ? <small id="communication-message-error" role="alert">{errors.message}</small> : <small id="communication-message-hint">Up to 3,000 characters.</small>}
          </label>
          <div className="admin-communications-options">
            <label className="admin-communications-field" htmlFor="communication-recipient">Recipients
              <select id="communication-recipient" value={draft.recipientMode} onChange={(event) => updateDraft("recipientMode", event.target.value)}>
                <option value="all">All students</option><option value="group">Selected academic level</option>
              </select>
            </label>
            {draft.recipientMode === "group" && <label className="admin-communications-field" htmlFor="communication-group">Academic level
              <select id="communication-group" value={draft.recipientGroup} onChange={(event) => updateDraft("recipientGroup", event.target.value)}>
                {adminStudentLevels.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>}
          </div>
          <fieldset className="admin-communications-channels" aria-describedby={errors.channels ? "communication-channels-error" : "communication-channels-hint"}>
            <legend>Delivery channels</legend>
            <label><input type="checkbox" checked={draft.channels.includes("Email")} onChange={() => toggleChannel("Email")} /><Mail size={17} aria-hidden="true" /><span>Email</span></label>
            <label><input type="checkbox" checked={draft.channels.includes("In-app notification")} onChange={() => toggleChannel("In-app notification")} /><Bell size={17} aria-hidden="true" /><span>In-app notification</span></label>
            {errors.channels ? <small id="communication-channels-error" role="alert">{errors.channels}</small> : <small id="communication-channels-hint">Select one or both. Delivery is not connected.</small>}
          </fieldset>
          <div className="admin-communications-form-footer"><p><UsersRound size={15} aria-hidden="true" /> Audience groups are fictional academic-level examples.</p><button className="admin-communications-button primary" type="submit"><Eye size={16} /> Preview announcement</button></div>
        </form>
      </section>

      <section className="admin-communications-panel history-panel" aria-labelledby="communication-history-title">
        <div className="admin-communications-panel-heading history-heading">
          <span className="admin-communications-section-icon" aria-hidden="true"><CalendarDays size={19} /></span>
          <div><p className="admin-communications-eyebrow">HISTORY</p><h2 id="communication-history-title">Communication history</h2><p>Sample statuses do not represent real delivery.</p></div>
        </div>
        <div className="admin-communications-filters">
          <label className="admin-communications-search" htmlFor="communication-search"><span className="sr-only">Search communications</span><Search size={17} aria-hidden="true" /><input id="communication-search" type="search" placeholder="Search subject, message, recipient…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="admin-communications-filter" htmlFor="communication-status">Status
            <select id="communication-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{communicationStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          </label>
          <button className="admin-communications-clear" type="button" onClick={clearHistoryFilters} disabled={!query && !statusFilter}>Clear filters</button>
        </div>
        <p className="admin-communications-count" role="status" aria-live="polite">Showing {visibleHistory.length} of {history.length} illustrative communications</p>
        {visibleHistory.length ? <ul className="admin-communications-history-list">
          {visibleHistory.map((item) => <li className="admin-communications-history-item" key={item.id}>
            <div className="admin-communications-history-main"><div className="admin-communications-history-title"><h3>{item.subject}</h3><StatusBadge status={item.status} /></div><p>{item.message}</p><div className="admin-communications-history-meta"><span>{item.recipients}</span><span>{item.channels.join(" · ")}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div></div>
            {item.status === "Draft" && <button className="admin-communications-open-draft" type="button" onClick={() => openDraft(item)}>Open draft</button>}
          </li>)}
        </ul> : <div className="admin-communications-empty"><span aria-hidden="true"><Search size={20} /></span><h3>{history.length ? "No matching communications" : "No communication history"}</h3><p>{history.length ? "Try changing the search or status filter." : "Draft announcements and prototype actions will appear here."}</p></div>}
      </section>

      {previewOpen && <AnnouncementPreview draft={draft} onClose={() => setPreviewOpen(false)} onSaveDraft={() => recordAction("Draft")} onMarkSent={() => recordAction("Sent")} />}
    </div>
  );
}
