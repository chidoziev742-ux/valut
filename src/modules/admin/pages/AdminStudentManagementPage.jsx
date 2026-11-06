import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, Users } from "lucide-react";
import { apiRequest } from "../../../api/apiClient.js";
import "../styles/admin-students.css";

const numberFormat = new Intl.NumberFormat("en");
const pageSize = 20;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function buildReturnUrl(search, status, verification) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (status) params.set("status", status);
  if (verification) params.set("verification", verification);
  const query = params.toString();
  return `/admin/students${query ? `?${query}` : ""}`;
}

function StudentStatus({ status, verified }) {
  return <span className={`admin-student-status status-${status}`}><span aria-hidden="true" />{status}{verified ? " · verified" : " · unverified"}</span>;
}

function StudentFilters({ search, status, verification, onSearch, onStatus, onVerification, onClear, hasFilters }) {
  return (
    <section className="admin-student-filters" aria-label="Search and filter student records">
      <label className="admin-student-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search students by name or email</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name or email" /></label>
      <label className="admin-student-select"><span>Status</span><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
      <label className="admin-student-select"><span>Email</span><select value={verification} onChange={(event) => onVerification(event.target.value)}><option value="">All verification</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></label>
      <button type="button" className="admin-student-clear" onClick={onClear} disabled={!hasFilters}><SlidersHorizontal size={16} aria-hidden="true" />Clear filters</button>
    </section>
  );
}

function StudentList({ students, returnUrl, loading }) {
  if (loading) return <div className="admin-students-empty" role="status"><span><Users size={22} /></span><h2>Loading students</h2><p>Fetching the latest student records.</p></div>;
  if (!students.length) return <div className="admin-students-empty" role="status"><span><Search size={22} /></span><h2>No matching students</h2><p>Try another name or email, or clear one or more filters.</p></div>;
  const row = (student) => (
    <tr key={student.id}>
      <th scope="row"><span className="admin-student-name">{student.name}</span><span className="admin-student-email">{student.email}</span></th>
      <td>{student.university || "Not provided"}</td><td>{student.programme || "Not provided"}</td><td>{student.academicLevel || "Not provided"}</td>
      <td><StudentStatus status={student.status} verified={student.emailVerified} /></td><td><time dateTime={student.joined}>{formatDate(student.joined)}</time></td>
      <td><a className="admin-student-view" href={`/admin/students/${encodeURIComponent(student.id)}?${returnUrl.split("?")[1] ?? ""}`}>View <ArrowRight size={15} aria-hidden="true" /></a></td>
    </tr>
  );
  return <div className="admin-student-table-wrap"><table className="admin-student-table"><caption className="sr-only">Student directory</caption><thead><tr><th>Student</th><th>University</th><th>Programme</th><th>Level</th><th>Status</th><th>Joined</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{students.map(row)}</tbody></table></div>;
}

export default function AdminStudentManagementPage() {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [verification, setVerification] = useState(params.get("verification") ?? "");
  const [page, setPage] = useState(Number(params.get("page")) || 1);
  const [data, setData] = useState({ students: [], total: 0 });
  const [request, setRequest] = useState({ status: "loading", error: "" });
  const returnUrl = buildReturnUrl(search, status, verification);

  useEffect(() => {
    let active = true;
    setRequest({ status: "loading", error: "" });
    const query = new URLSearchParams({ page, pageSize });
    if (search.trim()) query.set("q", search.trim());
    if (status) query.set("status", status);
    if (verification) query.set("verification", verification);
    apiRequest(`/api/admin/students?${query}`)
      .then((payload) => { if (active) { setData(payload); setRequest({ status: "loaded", error: "" }); } })
      .catch((error) => { if (active) setRequest({ status: "error", error: error.message || "We couldn't load student records." }); });
    return () => { active = false; };
  }, [page, search, status, verification]);

  const hasFilters = Boolean(search.trim() || status || verification);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  return (
    <div className="content-wrap admin-students-page">
      <header className="admin-students-heading"><div><p className="admin-kicker">ADMIN AREA · STUDENT MANAGEMENT</p><h1>Student directory</h1><p>Browse and manage provisioned student accounts.</p></div></header>
      <section className="admin-students-panel" aria-labelledby="admin-student-list-heading">
        <div className="admin-students-list-heading"><div><h2 id="admin-student-list-heading">Students</h2><p>{numberFormat.format(data.total)} student records</p></div><span className="admin-students-count" aria-live="polite">{request.status === "loading" ? "Loading…" : `${data.students.length} results`}</span></div>
        <StudentFilters search={search} status={status} verification={verification} onSearch={(value) => { setSearch(value); setPage(1); }} onStatus={(value) => { setStatus(value); setPage(1); }} onVerification={(value) => { setVerification(value); setPage(1); }} onClear={() => { setSearch(""); setStatus(""); setVerification(""); setPage(1); }} hasFilters={hasFilters} />
        {request.status === "error" ? <div className="admin-students-empty" role="alert"><h2>Unable to load students</h2><p>{request.error}</p></div> : <StudentList students={data.students} returnUrl={returnUrl} loading={request.status === "loading"} />}
        {data.total > pageSize && <nav className="admin-student-pagination" aria-label="Student directory pages"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}
      </section>
    </div>
  );
}

export function AdminStudentDetailPage({ studentId, csrfToken }) {
  const params = new URLSearchParams(window.location.search);
  const returnHref = buildReturnUrl(params.get("q") ?? "", params.get("status") ?? "", params.get("verification") ?? "");
  const [student, setStudent] = useState(null);
  const [request, setRequest] = useState({ status: "loading", error: "" });
  const [busy, setBusy] = useState(false);

  const loadStudent = useCallback(() => {
    setRequest({ status: "loading", error: "" });
    apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}`)
      .then((payload) => { setStudent(payload.student); setRequest({ status: "loaded", error: "" }); })
      .catch((error) => setRequest({ status: "error", error: error.message || "We couldn't load this student." }));
  }, [studentId]);
  useEffect(loadStudent, [loadStudent]);

  const changeStatus = async () => {
    const nextStatus = student.status === "active" ? "disabled" : "active";
    if (!window.confirm(`Are you sure you want to ${nextStatus === "disabled" ? "disable" : "reactivate"} this student account?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/api/admin/students/${encodeURIComponent(student.id)}/status`, { method: "PATCH", body: { status: nextStatus }, csrfToken });
      loadStudent();
    } catch (error) {
      setRequest({ status: "error", error: error.message || "The account status could not be changed." });
    } finally { setBusy(false); }
  };

  if (request.status === "loading") return <div className="content-wrap admin-students-page"><p role="status">Loading student details…</p></div>;
  if (!student) return <div className="content-wrap admin-students-page"><div className="admin-students-empty" role="alert"><h1>Student unavailable</h1><p>{request.error}</p><a className="admin-back-link" href={returnHref}><ArrowLeft size={16} />Return to student directory</a></div></div>;
  return (
    <div className="content-wrap admin-students-page">
      <a className="admin-back-link" href={returnHref}><ArrowLeft size={16} />Back to student directory</a>
      <header className="admin-students-heading admin-student-detail-heading"><div><p className="admin-kicker">STUDENT PROFILE</p><h1>{student.name}</h1><p>{student.email}</p></div><StudentStatus status={student.status} verified={student.emailVerified} /></header>
      <section className="admin-student-detail-panel" aria-labelledby="admin-student-detail-title"><div className="admin-students-list-heading"><div><h2 id="admin-student-detail-title">Student information</h2><p>Account and usage details</p></div><button type="button" className="admin-student-action" disabled={busy} onClick={changeStatus}>{student.status === "active" ? "Disable account" : "Reactivate account"}</button></div>
        <dl className="admin-student-details"><div><dt>Email address</dt><dd>{student.email}</dd></div><div><dt>University</dt><dd>{student.university || "Not provided"}</dd></div><div><dt>Faculty</dt><dd>{student.faculty || "Not provided"}</dd></div><div><dt>Department</dt><dd>{student.department || "Not provided"}</dd></div><div><dt>Programme</dt><dd>{student.programme || "Not provided"}</dd></div><div><dt>Academic level</dt><dd>{student.academicLevel || "Not provided"}</dd></div><div><dt>Account status</dt><dd><StudentStatus status={student.status} verified={student.emailVerified} /></dd></div><div><dt>Email verification</dt><dd>{student.emailVerified ? "Verified" : "Not verified"}</dd></div><div><dt>Joined</dt><dd><time dateTime={student.joined}>{formatDate(student.joined)}</time></dd></div><div><dt>Documents</dt><dd>{numberFormat.format(student.documentCount)}</dd></div><div><dt>Storage used</dt><dd>{formatStorage(student.storageBytes)}</dd></div><div><dt>Academic records</dt><dd>{numberFormat.format(student.academicRecordCount)}</dd></div></dl>
      </section>
      {request.status === "error" && <p role="alert">{request.error}</p>}
    </div>
  );
}

function formatStorage(value) {
  const bytes = Number(value);
  if (!bytes) return "0 B";
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][index]}`;
}
