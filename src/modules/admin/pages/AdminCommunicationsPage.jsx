import { useEffect, useState } from "react";
import { Archive, Bell, CalendarDays, Check, Eye, Mail, Megaphone, RotateCcw, Search, Send, UsersRound } from "lucide-react";
import { apiRequest } from "../../../api/apiClient.js";
import "../styles/admin-communications.css";

const emptyDraft = { subject: "", message: "", recipientMode: "all", recipientIds: [], channel: "in_app" };
const numberFormat = new Intl.NumberFormat("en");

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StatusBadge({ status }) {
  return <span className="admin-communications-status status-sent"><span aria-hidden="true" />{status}</span>;
}

export default function AdminCommunicationsPage({ csrfToken }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState({ communications: [], total: 0 });
  const [request, setRequest] = useState({ status: "loading", error: "" });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadData = () => {
    setRequest({ status: "loading", error: "" });
    Promise.all([
      apiRequest("/api/admin/students?pageSize=100&status=active"),
      apiRequest(`/api/admin/communications?pageSize=50&archive=${archiveFilter}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`),
    ])
      .then(([studentPayload, historyPayload]) => {
        setStudents(studentPayload.students ?? []);
        setHistory(historyPayload);
        setRequest({ status: "loaded", error: "" });
      })
      .catch((error) => setRequest({ status: "error", error: error.message || "We couldn't load communications." }));
  };

  useEffect(loadData, [query, archiveFilter]);

  const updateArchive = async (communication, archived) => {
    const action = archived ? "archive" : "restore";
    if (archived && !window.confirm(`Archive "${communication.subject}"? It will be hidden from active history but preserved.`)) return;
    setNotice("");
    try {
      await apiRequest(`/api/admin/communications/${encodeURIComponent(communication.id)}/${action}`, {
        method: "PATCH",
        csrfToken,
      });
      setNotice(archived ? "Communication archived." : "Communication restored.");
      loadData();
    } catch (error) {
      setNotice(error.message || `The communication could not be ${action}d.`);
    }
  };

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setNotice("");
  };

  const validate = () => {
    const nextErrors = {};
    if (!draft.subject.trim()) nextErrors.subject = "Enter an announcement subject.";
    if (draft.subject.trim().length > 120) nextErrors.subject = "Keep the subject to 120 characters or fewer.";
    if (!draft.message.trim()) nextErrors.message = "Enter an announcement message.";
    if (draft.message.trim().length > 2000) nextErrors.message = "Keep the message to 2,000 characters or fewer.";
    if (draft.recipientMode === "selected" && !draft.recipientIds.length) nextErrors.recipientIds = "Select at least one active student.";
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const sendAnnouncement = async () => {
    setPreviewOpen(false);
    setNotice("");
    try {
      const payload = await apiRequest("/api/admin/communications", {
        method: "POST",
        csrfToken,
        body: {
          subject: draft.subject.trim(),
          message: draft.message.trim(),
          recipientMode: draft.recipientMode,
          recipientIds: draft.recipientIds,
          channel: draft.channel,
        },
      });
      setDraft(emptyDraft);
      setNotice(`Announcement sent to ${numberFormat.format(payload.communication.recipientCount)} students.`);
      loadData();
    } catch (error) {
      setNotice(error.message || "The announcement could not be sent.");
    }
  };

  const toggleStudent = (id) => {
    setDraft((current) => ({
      ...current,
      recipientIds: current.recipientIds.includes(id)
        ? current.recipientIds.filter((value) => value !== id)
        : [...current.recipientIds, id],
    }));
    setErrors((current) => ({ ...current, recipientIds: "" }));
  };

  return (
    <div className="content-wrap admin-communications-page">
      <header className="admin-communications-heading">
        <div><p className="admin-communications-eyebrow">ADMIN AREA · COMMUNICATIONS</p><h1>Communications</h1><p>Send in-app announcements and email updates, with delivery tracking.</p></div>
        <span className="admin-communications-badge">In-app + email</span>
      </header>
      {notice && <p className="admin-communications-feedback" role="status"><Check size={16} />{notice}</p>}

      <section className="admin-communications-panel" aria-labelledby="communication-compose-title">
        <div className="admin-communications-panel-heading">
          <span className="admin-communications-section-icon" aria-hidden="true"><Megaphone size={19} /></span>
          <div><p className="admin-communications-eyebrow">COMPOSE</p><h2 id="communication-compose-title">New announcement</h2><p>Send a message to all active students or selected students.</p></div>
        </div>
        <form className="admin-communications-form" onSubmit={(event) => { event.preventDefault(); if (validate()) setPreviewOpen(true); }} noValidate>
          <label className="admin-communications-field" htmlFor="communication-subject">Subject or title
            <input id="communication-subject" value={draft.subject} maxLength={120} onChange={(event) => updateDraft("subject", event.target.value)} />
            {errors.subject && <small role="alert">{errors.subject}</small>}
          </label>
          <label className="admin-communications-field" htmlFor="communication-channel">Delivery channel
            <select id="communication-channel" value={draft.channel} onChange={(event) => updateDraft("channel", event.target.value)}>
              <option value="in_app">In-app notification</option>
              <option value="email">Email</option>
              <option value="both">In-app notification and email</option>
            </select>
          </label>
          <label className="admin-communications-field" htmlFor="communication-message">Message
            <textarea id="communication-message" rows="5" maxLength={2000} value={draft.message} onChange={(event) => updateDraft("message", event.target.value)} />
            {errors.message ? <small role="alert">{errors.message}</small> : <small>Up to 2,000 characters.</small>}
          </label>
          <label className="admin-communications-field" htmlFor="communication-recipient">Recipients
            <select id="communication-recipient" value={draft.recipientMode} onChange={(event) => updateDraft("recipientMode", event.target.value)}>
              <option value="all">All active students</option><option value="selected">Selected active students</option>
            </select>
          </label>
          {draft.recipientMode === "selected" && <fieldset className="admin-communications-recipient-list">
            <legend>Select students</legend>
            {students.length ? students.map((student) => <label key={student.id}><input type="checkbox" checked={draft.recipientIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span>{student.name}</span><small>{student.email}</small></label>) : <p>No active students are available.</p>}
            {errors.recipientIds && <small role="alert">{errors.recipientIds}</small>}
          </fieldset>}
          <div className="admin-communications-form-footer"><p>{draft.channel === "in_app" ? <Bell size={15} aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />} {draft.channel === "in_app" ? "Delivered in the student notification centre." : "Email delivery is queued and tracked per recipient."}</p><button className="admin-communications-button primary" type="submit"><Eye size={16} /> Preview announcement</button></div>
        </form>
      </section>

      <section className="admin-communications-panel history-panel" aria-labelledby="communication-history-title">
        <div className="admin-communications-panel-heading history-heading">
          <span className="admin-communications-section-icon" aria-hidden="true"><CalendarDays size={19} /></span>
          <div><p className="admin-communications-eyebrow">HISTORY</p><h2 id="communication-history-title">Communication history</h2><p>Previously sent in-app announcements.</p></div>
        </div>
        <div className="admin-communications-filters">
          <label className="admin-communications-search" htmlFor="communication-search"><span className="sr-only">Search communications</span><Search size={17} aria-hidden="true" /><input id="communication-search" type="search" placeholder="Search subject or message…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="admin-communications-filter" htmlFor="communication-archive-filter">History
            <select id="communication-archive-filter" value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)}>
              <option value="active">Active</option><option value="archived">Archived</option><option value="all">All history</option>
            </select>
          </label>
        </div>
        {request.status === "error" ? <p className="admin-communications-empty" role="alert">{request.error}</p> : history.communications.length ? <ul className="admin-communications-history-list">{history.communications.map((item) => <li className="admin-communications-history-item" key={item.id}><div className="admin-communications-history-main"><div className="admin-communications-history-title"><h3>{item.subject}</h3><StatusBadge status={item.status} />{item.archivedAt && <span className="admin-communications-archived-label">Archived</span>}</div><p>{item.message}</p><div className="admin-communications-history-meta"><span>{item.recipients}</span><span>{item.channels.join(" + ")}</span>{item.emailDelivery && <span>{item.emailDelivery.sent} sent · {item.emailDelivery.failed} failed · {item.emailDelivery.pending} pending</span>}<time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div></div><div className="admin-communications-history-actions">{item.archivedAt ? <button className="admin-communications-button secondary" type="button" onClick={() => updateArchive(item, false)}><RotateCcw size={14} /> Restore</button> : <button className="admin-communications-button secondary" type="button" onClick={() => updateArchive(item, true)}><Archive size={14} /> Archive</button>}</div></li>)}</ul> : <div className="admin-communications-empty"><span aria-hidden="true"><Search size={20} /></span><h3>No communication history</h3><p>Sent announcements will appear here.</p></div>}
      </section>

      {previewOpen && <div className="admin-communications-backdrop"><section className="admin-communications-preview" role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title"><span className="admin-communications-preview-icon" aria-hidden="true"><Send size={21} /></span><p className="admin-communications-eyebrow">CONFIRM SEND</p><h2 id="announcement-preview-title">{draft.subject}</h2><p>{draft.message}</p><p>Recipients: <strong>{draft.recipientMode === "all" ? "All active students" : `${draft.recipientIds.length} selected students`}</strong></p><p>Delivery: <strong>{draft.channel === "both" ? "In-app notification and email" : draft.channel === "email" ? "Email" : "In-app notification"}</strong></p><div className="admin-communications-preview-actions"><button className="admin-communications-button secondary" type="button" onClick={() => setPreviewOpen(false)}>Edit announcement</button><button className="admin-communications-button primary" type="button" onClick={sendAnnouncement}><Send size={15} /> Send announcement</button></div></section></div>}
    </div>
  );
}
