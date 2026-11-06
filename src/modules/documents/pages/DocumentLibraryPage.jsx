import { useMemo, useState } from "react";
import { File, FileImage, FileText, FileType2, FolderOpen, Search } from "lucide-react";
import { documentCategories, filterAndSortDocuments } from "../data/mockDocuments.js";
import "../styles/documents.css";

const categoryTone = {
  "Personal Documents": "green",
  "Academic Records": "gold",
  "Financial Documents": "coral",
  "Course Materials": "purple",
  Certificates: "mint",
  Other: "slate",
};

function DocumentIcon({ fileType }) {
  const type = String(fileType ?? "").toUpperCase();
  const Icon = ["JPG", "JPEG", "PNG"].includes(type)
    ? FileImage
    : ["DOC", "DOCX"].includes(type) ? FileType2 : type === "PDF" ? FileText : File;
  return <Icon size={21} aria-hidden="true" />;
}

function DocumentArtwork({ document, size = "card" }) {
  const [failed, setFailed] = useState(false);
  const imageType = ["JPG", "JPEG", "PNG"].includes(String(document.fileType ?? "").toUpperCase());
  const hasImage = imageType && Boolean(document.previewUrl);
  const previewAvailable = hasImage && !failed;
  const fallbackText = failed
    ? "Image preview could not be loaded"
    : imageType
      ? document.attachment || document.storageBacked ? "Open details to preview this image" : "No file attached"
      : document.attachment || document.storageBacked ? `${document.fileType} · open details to preview` : "No file attached";

  return (
    <div className={`document-artwork document-artwork-${size}`}>
      {previewAvailable ? (
        <img
          className="document-artwork-image"
          src={document.previewUrl}
          alt={`Preview of ${document.name}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="document-artwork-fallback" role="img" aria-label={`${document.fileType} file. ${fallbackText}`}>
          <span className={`document-artwork-icon type-${String(document.fileType ?? "file").toLowerCase()}`}><DocumentIcon fileType={document.fileType} /></span>
          <strong>{document.fileType || "File"}</strong>
          <span>{fallbackText}</span>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, children }) {
  return (
    <label className="library-filter" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function LibraryCard({ document }) {
  const tone = categoryTone[document.category] ?? "green";
  const href = `/documents/${encodeURIComponent(document.id)}?from=%2Fdocuments`;
  return (
    <a className="library-card library-card-link" href={href} aria-label={`Open document ${document.name}`}>
      <DocumentArtwork document={document} />
      <div className="library-card-top">
        <span className={"library-file-icon tone-" + tone}><DocumentIcon fileType={document.fileType} /></span>
        <span className="library-card-badges"><span className="library-file-type">{document.fileType}</span>{document.archived && <span className="library-archive-chip">Archived</span>}</span>
      </div>
      <h2>{document.name}</h2>
      <p className="library-card-category">{document.category}</p>
      <div className="library-card-meta"><span>{document.fileSize}</span><span aria-hidden="true">·</span><time dateTime={document.uploadedAt}>{formatDate(document.uploadedAt)}</time></div>
      <span className="library-details-button">View details</span>
    </a>
  );
}

export default function DocumentLibraryPage({ documents, onUpload, onScan, loading = false, error = "", onRetry }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [fileType, setFileType] = useState("all");
  const [academicSession, setAcademicSession] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("active");
  const filteredDocuments = useMemo(() => filterAndSortDocuments({
    documents, query, category, fileType, academicSession, sort, view,
  }), [documents, query, category, fileType, academicSession, sort, view]);
  const countInView = documents.filter((document) => view === "archived" ? document.archived : !document.archived).length;
  const activeCount = documents.filter((document) => !document.archived).length;
  const archivedCount = documents.length - activeCount;
  const hasFilters = Boolean(query || category !== "all" || fileType !== "all" || academicSession !== "all" || sort !== "newest");
  const clearFilters = () => {
    setQuery(""); setCategory("all"); setFileType("all"); setAcademicSession("all"); setSort("newest");
  };
  return (
    <div className="content-wrap library-content">
      <section className="library-heading" aria-labelledby="library-title">
        <div>
          <p className="library-eyebrow">YOUR DOCUMENTS</p>
          <h1 id="library-title">Document Library</h1>
          <p>Find and review your university documents in one place.</p>
        </div>
        <div className="library-heading-actions">
          {/* Scanning is deferred; keep the callback for future use without exposing the action. */}
          <button type="button" className="button-primary library-upload-button" onClick={onUpload}>Add document</button>
        </div>
      </section>

      <div className="library-view-switch" role="group" aria-label="Choose active or archived documents">
        <button type="button" aria-pressed={view === "active"} className={view === "active" ? "selected" : ""} onClick={() => setView("active")}>Active <span>{activeCount}</span></button>
        <button type="button" aria-pressed={view === "archived"} className={view === "archived" ? "selected" : ""} onClick={() => setView("archived")}>Archived <span>{archivedCount}</span></button>
      </div>

      <section className="library-controls panel" aria-label="Search and filter documents">
        <label className="library-search" htmlFor="document-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search documents and metadata</span>
          <input id="document-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, categories or details..." />
        </label>
        <div className="library-filter-grid">
          <FilterSelect id="filter-category" label="Category" value={category} onChange={setCategory}>
            <option value="all">All categories</option>{documentCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect id="filter-type" label="File type" value={fileType} onChange={setFileType}>
            <option value="all">All file types</option>{[...new Set(documents.map((item) => item.fileType))].sort().map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect id="filter-session" label="Academic session" value={academicSession} onChange={setAcademicSession}>
            <option value="all">All sessions</option>{[...new Set(documents.map((item) => item.academicSession))].sort().map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect id="sort-documents" label="Sort by" value={sort} onChange={setSort}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="alphabetical">Name A–Z</option>
          </FilterSelect>
        </div>
        <div className="library-results-line">
          <p role="status" aria-live="polite"><strong>{filteredDocuments.length}</strong> of {countInView} {view} documents</p>
          <button type="button" className="library-clear-button" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button>
        </div>
      </section>

      {loading && <section className="library-empty panel" role="status"><h2>Loading your documents…</h2></section>}
      {error && <section className="library-load-error" role="alert"><span>{error}</span><button type="button" className="button-secondary" onClick={onRetry}>Try again</button></section>}
      {!loading && !error && filteredDocuments.length ? (
        <section className="library-grid" aria-label="Document results">
          {filteredDocuments.map((document) => <LibraryCard key={document.id} document={document} />)}
        </section>
      ) : !loading && !error && (
        <section className="library-empty panel" aria-live="polite">
          <span className="library-empty-icon"><FolderOpen size={25} /></span>
          <h2>{countInView === 0 ? (view === "archived" ? "No archived documents" : "Your active library is empty") : "No documents match those filters"}</h2>
          <p>{countInView === 0 ? (view === "archived" ? "Documents you archive will stay here until you restore them." : "Add a document to begin. Your library is empty.") : "Try another search or clear the filters to see all documents in this view."}</p>
          {countInView > 0 && <button type="button" className="button-secondary" onClick={clearFilters}>Clear search and filters</button>}
        </section>
      )}

    </div>
  );
}
