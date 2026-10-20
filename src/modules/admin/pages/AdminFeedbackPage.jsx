import { useMemo, useState } from "react";
import {
  ArrowLeft, Check, CheckCheck, ClipboardList, MessageSquareText,
  Search, SlidersHorizontal, Star,
} from "lucide-react";
import {
  adminFeedbackCategories,
  adminFeedbackStatuses,
  filterAdminFeedback,
  mockAdminFeedback,
  mockAdminSurveys,
} from "../data/mockAdminFeedback.js";
import "../styles/admin-feedback.css";

const numberFormat = new Intl.NumberFormat("en");

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function Rating({ rating }) {
  if (rating == null) return <span className="admin-feedback-rating is-unrated">Not rated</span>;
  return (
    <span className="admin-feedback-rating" aria-label={`${rating} out of 5 sample satisfaction rating`}>
      <Star size={14} aria-hidden="true" /> {rating}/5
    </span>
  );
}

function FeedbackStatus({ status }) {
  return <span className={`admin-feedback-status status-${status.toLowerCase()}`}><span aria-hidden="true" />{status}</span>;
}

function FeedbackMetrics({ items }) {
  const rated = items.filter((item) => Number.isFinite(item.rating));
  const average = rated.length ? (rated.reduce((sum, item) => sum + item.rating, 0) / rated.length).toFixed(1) : "—";
  const newCount = items.filter((item) => item.status === "New").length;
  const completedCount = items.filter((item) => item.status === "Resolved").length;
  const metrics = [
    { label: "Sample submissions", value: numberFormat.format(items.length), note: "Fictional records", icon: MessageSquareText, tone: "green" },
    { label: "Awaiting review", value: numberFormat.format(newCount), note: "Sample items marked New", icon: ClipboardList, tone: "gold" },
    { label: "Resolved", value: numberFormat.format(completedCount), note: "Prototype status only", icon: CheckCheck, tone: "coral" },
    { label: "Average rating", value: average, note: `${rated.length} rated sample items`, icon: Star, tone: "purple" },
  ];
  return (
    <section className="admin-feedback-metrics" aria-label="Illustrative feedback summary">
      {metrics.map(({ label, value, note, icon: Icon, tone }) => (
        <article className={`admin-feedback-metric tone-${tone}`} key={label}>
          <span className="admin-feedback-metric-icon" aria-hidden="true"><Icon size={19} /></span>
          <p>{label}</p><strong>{value}</strong><small>{note}</small>
        </article>
      ))}
    </section>
  );
}

function FeedbackFilters({ search, category, status, hasFilters, onSearch, onCategory, onStatus, onClear }) {
  return (
    <section className="admin-feedback-filters" aria-label="Search and filter sample feedback">
      <label className="admin-feedback-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search feedback subject, message or context</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search feedback" />
      </label>
      <label className="admin-feedback-select"><span>Category</span><select value={category} onChange={(event) => onCategory(event.target.value)}><option value="">All categories</option>{adminFeedbackCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="admin-feedback-select"><span>Review status</span><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">All statuses</option>{adminFeedbackStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button className="admin-feedback-clear" type="button" onClick={onClear} disabled={!hasFilters}><SlidersHorizontal size={16} aria-hidden="true" />Clear filters</button>
    </section>
  );
}

function FeedbackList({ items, onOpen, hasAnyRecords }) {
  if (!hasAnyRecords) return <div className="admin-feedback-empty" role="status"><span><MessageSquareText size={22} aria-hidden="true" /></span><h3>No sample feedback records</h3><p>This prototype has no illustrative submissions to display.</p></div>;
  if (!items.length) return <div className="admin-feedback-empty" role="status"><span><Search size={22} aria-hidden="true" /></span><h3>No matching feedback</h3><p>Try a different search or filter, or clear the current filters.</p></div>;
  return (
    <ul className="admin-feedback-list">
      {items.map((item) => (
        <li className="admin-feedback-list-item" key={item.id}>
          <article className="admin-feedback-card">
            <div className="admin-feedback-card-main">
              <div className="admin-feedback-card-title"><h3>{item.subject}</h3><FeedbackStatus status={item.status} /></div>
              <p className="admin-feedback-excerpt">{item.message}</p>
              <div className="admin-feedback-meta"><span>{item.category}</span><span>{item.context}</span><span>{item.submittedBy}</span><time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time></div>
            </div>
            <div className="admin-feedback-card-side"><Rating rating={item.rating} /><button type="button" className="admin-feedback-view" onClick={() => onOpen(item.id)}>View details<span className="sr-only"> for {item.subject}</span></button></div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function FeedbackDetail({ item, onBack, onStatusChange, announcement }) {
  if (!item) return null;
  const canReview = item.status === "New";
  const canResolve = item.status !== "Resolved";
  return (
    <section className="admin-feedback-detail" aria-labelledby="admin-feedback-detail-title">
      <button type="button" className="admin-feedback-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to feedback list</button>
      <article className="admin-feedback-detail-card">
        <header className="admin-feedback-detail-heading">
          <div><p className="admin-kicker">SAMPLE FEEDBACK · {item.id}</p><h2 id="admin-feedback-detail-title">{item.subject}</h2></div>
          <FeedbackStatus status={item.status} />
        </header>
        <dl className="admin-feedback-detail-meta">
          <div><dt>Category</dt><dd>{item.category}</dd></div>
          <div><dt>Context</dt><dd>{item.context}</dd></div>
          <div><dt>Submitted by</dt><dd>{item.submittedBy} · fictional</dd></div>
          <div><dt>Submitted</dt><dd><time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time></dd></div>
          <div><dt>Satisfaction</dt><dd><Rating rating={item.rating} /></dd></div>
        </dl>
        <div className="admin-feedback-message"><h3>Feedback message</h3><p>{item.message}</p></div>
        <div className="admin-feedback-prototype-actions">
          <p>Status changes affect this page session only. No real account, submission, or service is updated.</p>
          <div>
            <button type="button" className="admin-feedback-action-secondary" disabled={!canReview} onClick={() => { onStatusChange(item.id, "Reviewed"); announcement("Sample feedback marked reviewed for this session only."); }}><Check size={16} aria-hidden="true" />Mark as reviewed</button>
            <button type="button" className="admin-feedback-action-primary" disabled={!canResolve} onClick={() => { onStatusChange(item.id, "Resolved"); announcement("Sample feedback marked resolved for this session only."); }}><CheckCheck size={16} aria-hidden="true" />Mark as resolved</button>
          </div>
        </div>
      </article>
    </section>
  );
}

function SurveySection({ surveys }) {
  return (
    <section className="admin-feedback-panel admin-surveys" aria-labelledby="admin-surveys-title">
      <header className="admin-feedback-panel-heading">
        <div><p className="admin-kicker">SEPARATE PROTOTYPE AREA</p><h2 id="admin-surveys-title">Surveys</h2><p>Fictional survey records and illustrative response totals.</p></div>
      </header>
      <p className="admin-survey-boundary">Survey creation, publishing, distribution, email delivery, and response collection are not available in this frontend prototype.</p>
      {surveys.length ? (
        <ul className="admin-survey-list">
          {surveys.map((survey) => (
            <li className="admin-survey-item" key={survey.id}>
              <div className="admin-survey-title"><h3>{survey.title}</h3><span className={`admin-survey-status survey-${survey.status.toLowerCase()}`}>{survey.status} · sample</span></div>
              <div className="admin-survey-meta"><span>{survey.responseCount == null ? "No response count · draft sample" : `${numberFormat.format(survey.responseCount)} illustrative responses`}</span><time dateTime={survey.updatedAt}>Updated {formatDate(survey.updatedAt)}</time></div>
            </li>
          ))}
        </ul>
      ) : <div className="admin-feedback-empty admin-survey-empty" role="status"><span><ClipboardList size={22} aria-hidden="true" /></span><h3>No sample surveys</h3><p>There are no illustrative survey records to display.</p></div>}
    </section>
  );
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState(mockAdminFeedback);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const hasFilters = Boolean(search.trim() || category || status);
  const visibleFeedback = useMemo(() => filterAdminFeedback(feedback, { query: search, category, status }), [feedback, search, category, status]);
  const selected = feedback.find((item) => item.id === selectedId) ?? null;

  const updateStatus = (id, nextStatus) => setFeedback((items) => items.map((item) => item.id === id ? { ...item, status: nextStatus } : item));
  const clearFilters = () => { setSearch(""); setCategory(""); setStatus(""); };
  const openFeedback = (id) => { setSelectedId(id); setAnnouncement(""); window.scrollTo(0, 0); };
  const backToList = () => { setSelectedId(null); setAnnouncement(""); };

  return (
    <div className="content-wrap admin-feedback-page" aria-labelledby="admin-feedback-page-title">
      <header className="admin-feedback-heading">
        <div><p className="admin-kicker">ADMIN AREA · FEEDBACK &amp; SURVEYS</p><h1 id="admin-feedback-page-title">Feedback &amp; surveys</h1><p>Review fictional feedback examples and survey records in this frontend prototype.</p></div>
        <span className="admin-feedback-sample-badge">Illustrative prototype data</span>
      </header>
      <aside className="admin-feedback-notice" aria-label="Prototype limitation"><span aria-hidden="true">i</span><p><strong>Prototype only.</strong> These fictional records do not represent real student submissions. No administrative authorization or backend updates are active.</p></aside>

      {!selected ? (
        <>
          <FeedbackMetrics items={feedback} />
          <section className="admin-feedback-panel" aria-labelledby="admin-feedback-list-title">
            <header className="admin-feedback-panel-heading">
              <div><p className="admin-kicker">ILLUSTRATIVE SUBMISSIONS</p><h2 id="admin-feedback-list-title">Recent feedback</h2><p>Search and filter the fictional sample records.</p></div>
              <span className="admin-feedback-panel-count">{numberFormat.format(visibleFeedback.length)} shown</span>
            </header>
            <FeedbackFilters search={search} category={category} status={status} hasFilters={hasFilters} onSearch={setSearch} onCategory={setCategory} onStatus={setStatus} onClear={clearFilters} />
            <p className="admin-feedback-result-count" aria-live="polite" aria-atomic="true">{visibleFeedback.length} of {feedback.length} sample feedback items shown</p>
            <FeedbackList items={visibleFeedback} onOpen={openFeedback} hasAnyRecords={feedback.length > 0} />
          </section>
        </>
      ) : (
        <>
          <p className="admin-feedback-announcement" role="status" aria-live="polite">{announcement}</p>
          <FeedbackDetail item={selected} onBack={backToList} onStatusChange={updateStatus} announcement={setAnnouncement} />
        </>
      )}
      <SurveySection surveys={mockAdminSurveys} />
    </div>
  );
}
