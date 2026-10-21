import { useState } from "react";
import { AlertCircle, ArrowLeft, RotateCcw, Save, UserRoundPen } from "lucide-react";
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
        maxLength={120}
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

export default function EditProfilePage({ profile, onSave, onNavigate, onNotice }) {
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");

  const changeField = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFeedback("");
  };

  const save = (event) => {
    event.preventDefault();
    const nextErrors = validateStudentProfile(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback("Review the highlighted fields before saving.");
      document.getElementById(`profile-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    const nextProfile = Object.fromEntries(studentProfileFields.map(({ name }) => [name, String(draft[name] ?? "").trim()]));
    onSave(nextProfile);
    onNotice("Profile updated for this browser session only.");
    onNavigate("/profile");
  };

  return (
    <div className="content-wrap profile-settings-wrap edit-profile-page">
      <button className="settings-back-link" type="button" onClick={() => onNavigate("/profile")}><ArrowLeft size={16} /> Back to Profile</button>
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><UserRoundPen size={23} /></span>
        <div><p className="profile-kicker">YOUR ACCOUNT</p><h1>Edit profile</h1><p>Update your personal and academic details.</p></div>
      </header>
      <section className="profile-settings-card" aria-labelledby="edit-profile-title">
        <div className="profile-card-heading"><div><h2 id="edit-profile-title">Personal and academic details</h2><p>Changes are held in shared app memory for this session only.</p></div></div>
        <form className="profile-form" onSubmit={save} noValidate>
          <div className="profile-fields-grid">{studentProfileFields.map((field) => <Field key={field.name} field={field} value={draft[field.name]} error={errors[field.name]} onChange={changeField} />)}</div>
          {feedback && <p className="profile-feedback profile-error-feedback" role="alert"><AlertCircle size={16} />{feedback}</p>}
          <div className="profile-form-actions"><button className="profile-secondary-button" type="button" onClick={() => onNavigate("/profile")}><RotateCcw size={16} /> Cancel</button><button className="profile-primary-button" type="submit"><Save size={16} /> Save changes</button></div>
        </form>
      </section>
    </div>
  );
}
