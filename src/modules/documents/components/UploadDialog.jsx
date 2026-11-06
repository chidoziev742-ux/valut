import { useState } from "react";
import { Upload, X } from "lucide-react";
import {
  defaultDocumentName,
  MAX_UPLOAD_BYTES,
  documentCategories,
  fileExtension,
  validateDocumentName,
  validateSelectedFile,
} from "../data/mockDocuments.js";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import "../styles/documents.css";

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadLimit() {
  const megabytes = MAX_UPLOAD_BYTES / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

export default function UploadDialog({ onClose, onAdd }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [category, setCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [session, setSession] = useState("");
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const dialogRef = useDialogFocus(onClose);

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] ?? null;
    const error = validateSelectedFile(selected);
    if (error) {
      setFile(null); setName(""); setFileError(error); setNameError("");
      return;
    }
    setFile(selected); setName(defaultDocumentName(selected.name)); setFileError(""); setNameError(""); setFormError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (uploading) return;
    if (!file) { setFormError(fileError || "Choose a supported file before adding it."); return; }
    if (!category) { setCategoryError("Choose a category for this document."); window.document.getElementById("upload-category")?.focus(); return; }
    const checkedName = validateDocumentName(name, fileExtension(file.name));
    if (checkedName.error) { setNameError(checkedName.error); window.document.getElementById("upload-document-name")?.focus(); return; }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", checkedName.name);
    formData.set("category", category);
    if (session.trim()) formData.set("academicSession", session.trim());
    setUploading(true);
    setProgress(0);
    setFormError("");
    try {
      await onAdd(formData, setProgress);
    } catch (error) {
      setFormError(error.message || "The document could not be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="upload-dialog operation-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close upload dialog"><X size={19} /></button>
        <span className="dialog-icon"><Upload size={23} /></span><h2 id="upload-title">Add a document</h2>
        <form onSubmit={submit} noValidate>
          <label className="operation-field upload-file-field" htmlFor="upload-file">
            <span>Choose a file</span>
            <input id="upload-file" data-dialog-initial-focus type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFile} aria-invalid={Boolean(fileError)} aria-describedby={fileError ? "upload-file-error" : "upload-file-help"} disabled={uploading} />
            <small id={fileError ? "upload-file-error" : "upload-file-help"} className={fileError ? "operation-error" : "operation-help"}>{fileError || `PDF, JPG, JPEG or PNG · maximum ${formatUploadLimit()}`}</small>
          </label>
          {file && <p className="selected-file-summary"><strong>{file.name}</strong><span>{formatFileSize(file.size)} · selected</span></p>}
          <label className="operation-field" htmlFor="upload-document-name"><span>Document name</span><input id="upload-document-name" maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setNameError(""); setFormError(""); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "upload-name-error" : undefined} disabled={uploading} />{nameError && <small id="upload-name-error" className="operation-error">{nameError}</small>}</label>
          <label className="operation-field" htmlFor="upload-category"><span>Category</span><select id="upload-category" value={category} onChange={(event) => { setCategory(event.target.value); setCategoryError(""); setFormError(""); }} required aria-invalid={Boolean(categoryError)} aria-describedby={categoryError ? "upload-category-error" : undefined} disabled={uploading}><option value="">Choose a category</option>{documentCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>{categoryError && <small id="upload-category-error" className="operation-error" role="alert">{categoryError}</small>}</label>
          <label className="operation-field" htmlFor="upload-session"><span>Academic session (optional)</span><input id="upload-session" value={session} maxLength={40} onChange={(event) => setSession(event.target.value)} placeholder="e.g. 2026/2027" disabled={uploading} /></label>
          {uploading && <div className="upload-progress" role="status"><span>Uploading… {progress}%</span><progress max="100" value={progress} /></div>}
          {formError && <p className="operation-error operation-form-error" role="alert">{formError}</p>}
          <div className="dialog-actions"><button className="button-secondary" type="button" onClick={onClose} disabled={uploading}>Cancel</button><button className="button-primary" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload document"}</button></div>
        </form>
      </section>
    </div>
  );
}
