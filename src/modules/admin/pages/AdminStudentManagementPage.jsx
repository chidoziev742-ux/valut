import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, Users } from "lucide-react";
import { adminStudentLevels, adminStudentStatuses, mockAdminStudents } from "../data/mockAdminStudents.js";
import "../styles/admin-students.css";

function formatJoinDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function buildReturnUrl(search, status, level) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (status) params.set("status", status);
  if (level) params.set("level", level);
  const query = params.toString();
  return `/admin/students${query ? `?${query}` : ""}`;
}

function studentDetailUrl(studentId, search, status, level) {
  const params = new URLSearchParams(new URLSearchParams(buildReturnUrl(search, status, level).split("?")[1] ?? ""));
  const query = params.toString();
  return `/admin/students/${encodeURIComponent(studentId)}${query ? `?${query}` : ""}`;
}

function PrototypeLabel() {
  return <p className="admin-students-prototype"><strong>Fictional prototype records.</strong> This directory is illustrative only and is not connected to real student accounts or administrative permissions.</p>;
}

function StudentStatus({ status }) {
  return <span className={`admin-student-status status-${status.toLowerCase()}`}><span aria-hidden="true" />{status} · sample</span>;
}

function StudentRow({ student, returnHref }) {
  const href = studentDetailUrl(student.id, ...returnHref);
  return (
    <tr>
      <th scope="row"><span className="admin-student-name">{student.name}</span><span className="admin-student-email">{student.email}</span></th>
      <td>{student.university}</td>
      <td>{student.programme}</td>
      <td>{student.academicLevel}</td>
      <td><StudentStatus status={student.status} /></td>
      <td><time dateTime={student.joined}>{formatJoinDate(student.joined)}</time></td>
      <td><a className="admin-student-view" href={href} aria-label={`View fictional profile for ${student.name}`}>View <ArrowRight size={15} aria-hidden="true" /></a></td>
    </tr>
  );
}

function StudentCard({ student, returnHref }) {
  const href = studentDetailUrl(student.id, ...returnHref);
  return (
    <article className="admin-student-card">
      <div className="admin-student-card-heading"><div><h2>{student.name}</h2><a href={`mailto:${student.email}`} className="admin-student-card-email">{student.email}</a></div><StudentStatus status={student.status} /></div>
      <dl>
        <div><dt>University</dt><dd>{student.university}</dd></div>
        <div><dt>Programme</dt><dd>{student.programme}</dd></div>
        <div><dt>Academic level</dt><dd>{student.academicLevel}</dd></div>
        <div><dt>Joined</dt><dd><time dateTime={student.joined}>{formatJoinDate(student.joined)}</time></dd></div>
      </dl>
      <a className="admin-student-card-link" href={href}>View student details <ArrowRight size={16} aria-hidden="true" /></a>
    </article>
  );
}

function StudentFilters({ search, status, level, onSearch, onStatus, onLevel, onClear, hasFilters }) {
  return (
    <section className="admin-student-filters" aria-label="Search and filter student records">
      <label className="admin-student-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search students by name or email</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name or email" />
      </label>
      <label className="admin-student-select"><span>Status</span><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">All statuses</option>{adminStudentStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label className="admin-student-select"><span>Academic level</span><select value={level} onChange={(event) => onLevel(event.target.value)}><option value="">All levels</option>{adminStudentLevels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button type="button" className="admin-student-clear" onClick={onClear} disabled={!hasFilters}><SlidersHorizontal size={16} aria-hidden="true" />Clear filters</button>
    </section>
  );
}

function StudentList({ students, returnHref, isEmptyData }) {
  if (isEmptyData) return <div className="admin-students-empty" role="status"><span><Users size={22} /></span><h2>No sample student records</h2><p>There are no illustrative records to display in this prototype.</p></div>;
  if (!students.length) return <div className="admin-students-empty" role="status"><span><Search size={22} /></span><h2>No matching students</h2><p>Try another name or email, or clear one or more filters.</p></div>;
  return (
    <>
      <div className="admin-student-table-wrap">
        <table className="admin-student-table">
          <caption className="sr-only">Fictional sample student directory</caption>
          <thead><tr><th scope="col">Student</th><th scope="col">University</th><th scope="col">Programme</th><th scope="col">Level</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>{students.map((student) => <StudentRow key={student.id} student={student} returnHref={returnHref} />)}</tbody>
        </table>
      </div>
      <div className="admin-student-cards">{students.map((student) => <StudentCard key={student.id} student={student} returnHref={returnHref} />)}</div>
    </>
  );
}

export default function AdminStudentManagementPage() {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(adminStudentStatuses.includes(params.get("status")) ? params.get("status") : "");
  const [level, setLevel] = useState(adminStudentLevels.includes(params.get("level")) ? params.get("level") : "");
  const hasFilters = Boolean(search.trim() || status || level);

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return mockAdminStudents.filter((student) => {
      const matchesSearch = !term || student.name.toLocaleLowerCase().includes(term) || student.email.toLocaleLowerCase().includes(term);
      return matchesSearch && (!status || student.status === status) && (!level || student.academicLevel === level);
    });
  }, [search, status, level]);

  return (
    <div className="content-wrap admin-students-page">
      <header className="admin-students-heading">
        <div><p className="admin-kicker">ADMIN AREA · STUDENT MANAGEMENT</p><h1>Student directory</h1><p>Browse a sample directory and explore fictional student profiles.</p></div>
        <span className="admin-sample-badge">Prototype data</span>
      </header>
      <PrototypeLabel />

      <section className="admin-students-panel" aria-labelledby="admin-student-list-heading">
        <div className="admin-students-list-heading">
          <div><h2 id="admin-student-list-heading">Students</h2><p>{visibleStudents.length} of {mockAdminStudents.length} sample records</p></div>
          <span className="admin-students-count" aria-label={`${visibleStudents.length} results`} aria-live="polite">{visibleStudents.length} results</span>
        </div>
        <StudentFilters search={search} status={status} level={level} onSearch={setSearch} onStatus={setStatus} onLevel={setLevel} onClear={() => { setSearch(""); setStatus(""); setLevel(""); }} hasFilters={hasFilters} />
        <StudentList students={visibleStudents} returnHref={[search, status, level]} isEmptyData={mockAdminStudents.length === 0} />
      </section>
      <p className="admin-students-footnote">Status labels are examples only. No account status can be changed from this prototype.</p>
    </div>
  );
}

export function AdminStudentDetailPage({ studentId }) {
  const student = mockAdminStudents.find((item) => item.id === studentId);
  const params = new URLSearchParams(window.location.search);
  const returnHref = buildReturnUrl(params.get("q") ?? "", params.get("status") ?? "", params.get("level") ?? "");

  if (!student) {
    return <div className="content-wrap admin-students-page"><div className="admin-students-empty" role="status"><span><Users size={22} /></span><h1>Sample profile unavailable</h1><p>This identifier does not match a fictional record in the prototype.</p><a className="admin-back-link" href={returnHref}><ArrowLeft size={16} />Return to student directory</a></div></div>;
  }

  return (
    <div className="content-wrap admin-students-page">
      <a className="admin-back-link" href={returnHref}><ArrowLeft size={16} aria-hidden="true" />Back to student directory</a>
      <header className="admin-students-heading admin-student-detail-heading"><div><p className="admin-kicker">FICTIONAL SAMPLE PROFILE</p><h1>{student.name}</h1><p>{student.email}</p></div><StudentStatus status={student.status} /></header>
      <PrototypeLabel />
      <section className="admin-student-detail-panel" aria-labelledby="admin-student-detail-title">
        <div className="admin-students-list-heading"><div><h2 id="admin-student-detail-title">Student information</h2><p>Illustrative details only · no account controls</p></div></div>
        <dl className="admin-student-details">
          <div><dt>Email address</dt><dd>{student.email}</dd></div>
          <div><dt>University</dt><dd>{student.university}</dd></div>
          <div><dt>Programme</dt><dd>{student.programme}</dd></div>
          <div><dt>Academic level</dt><dd>{student.academicLevel}</dd></div>
          <div><dt>Account status</dt><dd><StudentStatus status={student.status} /></dd></div>
          <div><dt>Joined</dt><dd><time dateTime={student.joined}>{formatJoinDate(student.joined)}</time></dd></div>
        </dl>
      </section>
      <p className="admin-students-footnote">This frontend-only sample does not access, modify, suspend, or delete any real account.</p>
    </div>
  );
}
