import { useState } from "react";
import { Upload, X } from "lucide-react";
import {
  defaultDocumentName,
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

export default function UploadDialog({ onClose, onAdd }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [category, setCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [session, setSession] = useState("Not session-specific");
  const [formError, setFormError] = useState("");
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

  const submit = (event) => {
    event.preventDefault();
    if (!file) { setFormError(fileError || "Choose a supported file before adding it."); return; }
    if (!category) { setCategoryError("Choose a category for this document."); window.document.getElementById("upload-category")?.focus(); return; }
    const checkedName = validateDocumentName(name, fileExtension(file.name));
    if (checkedName.error) { setNameError(checkedName.error); window.document.getElementById("upload-document-name")?.focus(); return; }
    const extension = fileExtension(file.name);
    const id = globalThis.crypto?.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    onAdd({
      id, name: checkedName.name, category, fileType: extension === ".jpeg" ? "JPG" : extension.slice(1).toUpperCase(),
      fileSize: formatFileSize(file.size), uploadedAt: new Date().toISOString().slice(0, 10),
      academicSession: session, description: "Selected locally for this browser session. Not uploaded or saved to cloud storage.",
      fileExtension: extension, attachment: file, archived: false,
    });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="upload-dialog operation-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title" aria-describedby="upload-boundary">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close upload dialog"><X size={19} /></button>
        <span className="dialog-icon"><Upload size={23} /></span><h2 id="upload-title">Add a document</h2>
        <p id="upload-boundary">Prototype only. The file stays in this tab's memory and is not uploaded or saved to storage.</p>
        <form onSubmit={submit} noValidate>
          <label className="operation-field upload-file-field" htmlFor="upload-file">
            <span>Choose a file</span>
            <input id="upload-file" data-dialog-initial-focus type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseFile} aria-invalid={Boolean(fileError)} aria-describedby={fileError ? "upload-file-error" : "upload-file-help"} />
            <small id={fileError ? "upload-file-error" : "upload-file-help"} className={fileError ? "operation-error" : "operation-help"}>{fileError || "PDF, JPG, PNG, DOC or DOCX · maximum 10 MB"}</small>
          </label>
          {file && <p className="selected-file-summary"><strong>{file.name}</strong><span>{formatFileSize(file.size)} · selected for this session</span></p>}
          <label className="operation-field" htmlFor="upload-document-name"><span>Document name</span><input id="upload-document-name" maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setNameError(""); setFormError(""); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "upload-name-error" : undefined} />{nameError && <small id="upload-name-error" className="operation-error">{nameError}</small>}</label>
          <label className="operation-field" htmlFor="upload-category"><span>Category</span><select id="upload-category" value={category} onChange={(event) => { setCategory(event.target.value); setCategoryError(""); setFormError(""); }} required aria-invalid={Boolean(categoryError)} aria-describedby={categoryError ? "upload-category-error" : undefined}><option value="">Choose a category</option>{documentCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select>{categoryError && <small id="upload-category-error" className="operation-error" role="alert">{categoryError}</small>}</label>
          <label className="operation-field" htmlFor="upload-session"><span>Academic session</span><select id="upload-session" value={session} onChange={(event) => setSession(event.target.value)}><option>Not session-specific</option><option>2025/2026</option><option>2024/2025</option></select></label>
          {formError && <p className="operation-error operation-form-error" role="alert">{formError}</p>}
          <div className="dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit">Add to this session</button></div>
        </form>
      </section>
    </div>
  );
}
