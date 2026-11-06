import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, LoaderCircle, RotateCcw, Save, UserRoundPen } from "lucide-react";
import { studentProfileFields, validateStudentProfile } from "../../../data/mockProfile.js";
import "../../../profile-settings.css";

function Field({ field, value, error, onChange }) {
  const id = `profile-${field.name}`;
  const errorId = `${id}-error`;
  return (
    <div className="profile-field">
      <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
      <input
        id={id}
        name={field.name}
        type={field.type ?? "text"}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        maxLength={field.maxLength ?? 120}
        value={value ?? ""}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
      />
      {error && <small id={errorId} className="profile-field-error" role="alert">{error}</small>}
    </div>
  );
}

const emptyProfile = {
  fullName: "",
  university: "",
  faculty: "",
  department: "",
  program: "",
  studyYear: "",
  academicSession: "",
};

export default function EditProfilePage({
  profile,
  onSave,
  onNavigate,
  mode = "edit",
  loading = false,
  loadError = "",
  missing = false,
  onRetry,
}) {
  const [draft, setDraft] = useState(profile ?? emptyProfile);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const isSetup = mode === "setup";
  const editableFields = studentProfileFields.filter((field) => field.name !== "email");

  useEffect(() => {
    setDraft(profile ?? emptyProfile);
  }, [profile]);

  const changeField = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFeedback("");
  };

  const save = async (event) => {
    event.preventDefault();
    const nextErrors = validateStudentProfile(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback("Review the highlighted fields before saving.");
      document.getElementById(`profile-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    const nextProfile = {
      fullName: String(draft.fullName ?? "").trim(),
      university: String(draft.university ?? "").trim(),
      faculty: String(draft.faculty ?? "").trim(),
      department: String(draft.department ?? "").trim(),
      programme: String(draft.program ?? "").trim(),
      studyYear: String(draft.studyYear ?? "").trim(),
      academicSession: String(draft.academicSession ?? "").trim(),
    };
    setSaving(true);
    setFeedback("");
    try {
      await onSave(nextProfile);
      onNavigate(isSetup ? "/" : "/profile");
    } catch (error) {
      setFeedback(error.message || "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="content-wrap profile-settings-wrap" role="status"><p className="profile-feedback"><LoaderCircle size={17} /> Loading your profile…</p></div>;
  }

  if (loadError || missing) {
    return (
      <div className="content-wrap profile-settings-wrap">
        <div className="profile-empty-state" role={missing ? "status" : "alert"}><AlertCircle size={18} /><p>{loadError || "Your profile has not been set up yet."}</p></div>
        {missing
          ? <button className="profile-secondary-button" type="button" onClick={() => onNavigate("/profile/setup")}>Set up your profile</button>
          : <button className="profile-secondary-button" type="button" onClick={onRetry}>Try again</button>}
      </div>
    );
  }

  return (
    <div className="content-wrap profile-settings-wrap edit-profile-page">
      <button className="settings-back-link" type="button" onClick={() => onNavigate(isSetup ? "/" : "/profile")}><ArrowLeft size={16} /> {isSetup ? "Back to Home" : "Back to Profile"}</button>
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><UserRoundPen size={23} /></span>
        <div><p className="profile-kicker">YOUR ACCOUNT</p><h1>{isSetup ? "Set up your profile" : "Edit profile"}</h1><p>{isSetup ? "Add your personal and academic details to get started." : "Update your personal and academic details."}</p></div>
      </header>
      <section className="profile-settings-card" aria-labelledby="edit-profile-title">
        <div className="profile-card-heading"><div><h2 id="edit-profile-title">Personal and academic details</h2><p>Your profile is saved to your Vaultori account.</p></div></div>
        <form className="profile-form" onSubmit={save} noValidate>
          <div className="profile-fields-grid">{editableFields.map((field) => <Field key={field.name} field={field} value={draft[field.name]} error={errors[field.name]} onChange={changeField} />)}</div>
          {feedback && <p className="profile-feedback profile-error-feedback" role="alert"><AlertCircle size={16} />{feedback}</p>}
          <div className="profile-form-actions"><button className="profile-secondary-button" type="button" onClick={() => onNavigate(isSetup ? "/" : "/profile")} disabled={saving}><RotateCcw size={16} /> Cancel</button><button className="profile-primary-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={16} /> Saving…</> : <><Save size={16} /> {isSetup ? "Save profile" : "Save changes"}</>}</button></div>
        </form>
      </section>
    </div>
  );
}
