import { useState } from "react";
import { BookOpenText, CalendarDays, GraduationCap, Pencil, Plus, Trash2, X } from "lucide-react";
import { academicRecordTypes, validateAcademicRecord } from "../data/mockAcademicRecords.js";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import "../../../organization.css";

const emptyRecord = {
  recordType: academicRecordTypes[0], institution: "", programme: "", academicSession: "",
  semester: "", level: "", title: "", details: "",
};

function AcademicRecordForm({ record, onClose, onSave }) {
  const [values, setValues] = useState(record ? { ...record } : { ...emptyRecord });
  const [error, setError] = useState("");
  const ref = useDialogFocus(onClose);
  const set = (key, value) => { setValues((previous) => ({ ...previous, [key]: value })); setError(""); };
  const showSemester = values.recordType === "Semester result" || values.recordType === "Course record";
  const submit = (event) => {
    event.preventDefault();
    const checked = validateAcademicRecord(values);
    if (checked.error) { setError(checked.error); return; }
    onSave(checked.record);
  };
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog academic-form-dialog" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Close academic record form"><X size={19} /></button>
        <span className="organization-dialog-icon"><GraduationCap size={23} /></span>
        <p className="organization-eyebrow">ACADEMIC RECORD · PROTOTYPE</p>
        <h2 id="record-form-title">{record ? "Edit academic record" : "Add academic record"}</h2>
        <p>Sample information is kept in this browser session only. No record is verified by a university.</p>
        <form className="academic-record-form" onSubmit={submit} noValidate>
          <label className="organization-field" htmlFor="record-type">Record type<select data-dialog-initial-focus id="record-type" value={values.recordType} onChange={(event) => set("recordType", event.target.value)}>{academicRecordTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="organization-field" htmlFor="record-title">Title<input id="record-title" value={values.title} maxLength={100} onChange={(event) => set("title", event.target.value)} /></label>
          <label className="organization-field" htmlFor="record-institution">Institution<input id="record-institution" value={values.institution} maxLength={100} onChange={(event) => set("institution", event.target.value)} /></label>
          <label className="organization-field" htmlFor="record-programme">Programme<input id="record-programme" value={values.programme} maxLength={100} onChange={(event) => set("programme", event.target.value)} /></label>
          <label className="organization-field" htmlFor="record-session">Academic session<input id="record-session" value={values.academicSession} maxLength={100} placeholder="e.g. 2025/2026" onChange={(event) => set("academicSession", event.target.value)} /></label>
          {showSemester && <label className="organization-field" htmlFor="record-semester">Semester<input id="record-semester" value={values.semester} maxLength={60} placeholder="e.g. First semester" onChange={(event) => set("semester", event.target.value)} /></label>}
          <label className="organization-field" htmlFor="record-level">Level <span className="organization-optional">Optional</span><input id="record-level" value={values.level} maxLength={60} placeholder="e.g. 300 level" onChange={(event) => set("level", event.target.value)} /></label>
          <label className="organization-field academic-details-field" htmlFor="record-details">Details <span className="organization-optional">Optional · max 1,000 characters</span><textarea id="record-details" rows="3" maxLength={1000} value={values.details} onChange={(event) => set("details", event.target.value)} /></label>
          {error && <p className="organization-error academic-form-error" role="alert">{error}</p>}
          <div className="organization-dialog-actions"><button className="organization-button secondary" type="button" onClick={onClose}>Cancel</button><button className="organization-button primary" type="submit">{record ? "Save changes" : "Add record"}</button></div>
        </form>
      </section>
    </div>
  );
}

function RecordDetails({ record, onClose, onEdit, onDelete }) {
  const ref = useDialogFocus(onClose);
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog record-details-dialog" role="dialog" aria-modal="true" aria-labelledby="record-detail-title">
        <button data-dialog-initial-focus className="organization-close" type="button" onClick={onClose} aria-label="Close record details"><X size={19} /></button>
        <span className="organization-dialog-icon"><BookOpenText size={22} /></span><p className="organization-eyebrow">SAMPLE ACADEMIC RECORD</p>
        <h2 id="record-detail-title">{record.title}</h2><p className="record-type-label">{record.recordType}</p>
        <dl className="record-detail-list">
          <div><dt>Institution</dt><dd>{record.institution}</dd></div><div><dt>Programme</dt><dd>{record.programme}</dd></div>
          <div><dt>Academic session</dt><dd>{record.academicSession}</dd></div>{record.semester && <div><dt>Semester</dt><dd>{record.semester}</dd></div>}
          {record.level && <div><dt>Level</dt><dd>{record.level}</dd></div>}{record.details && <div className="record-detail-long"><dt>Details</dt><dd>{record.details}</dd></div>}
          <div><dt>Updated</dt><dd>{formatDate(record.updatedAt)}</dd></div>
        </dl>
        <p className="organization-inline-note">Prototype information only. This record has not been verified by the institution.</p>
        <div className="organization-dialog-actions"><button className="organization-button secondary" type="button" onClick={() => onEdit(record)}><Pencil size={15} /> Edit</button><button className="organization-button destructive-outline" type="button" onClick={() => onDelete(record)}><Trash2 size={15} /> Delete…</button></div>
      </section>
    </div>
  );
}

function DeleteRecordDialog({ record, onClose, onConfirm }) {
  const ref = useDialogFocus(onClose);
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog" role="alertdialog" aria-modal="true" aria-labelledby="record-delete-title" aria-describedby="record-delete-copy">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Cancel record deletion"><X size={19} /></button>
        <span className="organization-dialog-icon danger-icon"><Trash2 size={21} /></span><p className="organization-eyebrow">CONFIRM REMOVAL</p>
        <h2 id="record-delete-title">Delete this sample record?</h2><p id="record-delete-copy">Remove “{record.title}” from this browser session? This does not remove any official university record.</p>
        <div className="organization-dialog-actions"><button data-dialog-initial-focus className="organization-button secondary" type="button" onClick={onClose}>Keep record</button><button className="organization-button destructive" type="button" onClick={onConfirm}>Delete record</button></div>
      </section>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export default function AcademicRecordsPage({ records, onCreate, onUpdate, onDelete, onNotice, onNavigate }) {
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  const save = (data) => {
    const now = new Date().toISOString().slice(0, 10);
    if (dialog.mode === "edit") {
      onUpdate(dialog.record.id, { ...data, updatedAt: now });
      onNotice("Academic record updated for this session.");
    } else {
      const id = globalThis.crypto?.randomUUID?.() ?? `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onCreate({ id, ...data, createdAt: now, updatedAt: now });
      onNotice("Sample academic record added for this session.");
    }
    close();
  };

  return (
    <div className="content-wrap organization-content academic-content">
      <header className="organization-heading">
        <div><p className="organization-eyebrow">YOUR UNIVERSITY JOURNEY</p><h1>Academic Records</h1><p>Keep programme and course information together.</p></div>
        <button className="organization-button primary" type="button" onClick={() => setDialog({ mode: "create" })}><Plus size={17} /> Add record</button>
      </header>
      <p className="organization-sample-note">Fictional sample records · not verified by any university · changes are session-only.</p>
      <div className="academic-record-list" aria-label="Academic records">
        {records.map((record) => (
          <article className="academic-record-card panel" key={record.id}>
            <span className="academic-record-icon"><GraduationCap size={21} aria-hidden="true" /></span>
            <div className="academic-record-main"><span className="academic-record-type">{record.recordType}</span><h2>{record.title}</h2><p>{record.institution} · {record.programme}</p><small><CalendarDays size={14} /> {record.academicSession}{record.semester ? ` · ${record.semester}` : ""}</small></div>
            <div className="academic-record-actions"><button className="organization-button secondary" type="button" onClick={() => setDialog({ mode: "details", record })}>View details</button><button className="organization-icon-action" type="button" aria-label={`Edit ${record.title}`} onClick={() => setDialog({ mode: "edit", record })}><Pencil size={16} /></button></div>
          </article>
        ))}
      </div>
      {!records.length && <section className="organization-empty panel"><span className="organization-empty-icon"><GraduationCap size={23} /></span><h2>No academic records yet</h2><p>Add programme information, a semester result, or a course record to start organizing your academic history.</p><button className="organization-button primary" type="button" onClick={() => setDialog({ mode: "create" })}><Plus size={16} /> Add your first record</button></section>}
      <footer className="organization-related-links"><button className="organization-text-link" type="button" onClick={() => onNavigate("/documents")}>Go to document library</button><button className="organization-text-link" type="button" onClick={() => onNavigate("/folders")}>Organize folders</button></footer>
      {dialog?.mode === "create" && <AcademicRecordForm key="create" onClose={close} onSave={save} />}
      {dialog?.mode === "edit" && <AcademicRecordForm key={dialog.record.id} record={dialog.record} onClose={close} onSave={save} />}
      {dialog?.mode === "details" && <RecordDetails record={dialog.record} onClose={close} onEdit={(record) => setDialog({ mode: "edit", record })} onDelete={(record) => setDialog({ mode: "delete", record })} />}
      {dialog?.mode === "delete" && <DeleteRecordDialog record={dialog.record} onClose={close} onConfirm={() => { onDelete(dialog.record.id); close(); onNotice("Sample academic record removed from this session."); }} />}
    </div>
  );
}
