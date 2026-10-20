import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, RotateCcw } from "lucide-react";
import "../profile-settings.css";

const passwordFields = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
];

export default function ChangePasswordPage({ onNavigate }) {
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");

  const reset = (form) => {
    form.reset();
    setErrors({});
    setNotice("");
    setVisible({});
  };

  const submit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(passwordFields.map(({ name }) => [name, form.elements.namedItem(name).value]));
    const nextErrors = {};
    for (const field of passwordFields) if (!fields[field.name]) nextErrors[field.name] = `${field.label} is required.`;
    if (fields.newPassword && fields.newPassword.length < 8) nextErrors.newPassword = "Use at least 8 characters.";
    if (fields.newPassword && fields.currentPassword && fields.newPassword === fields.currentPassword) nextErrors.newPassword = "Choose a new password that differs from your current password.";
    if (fields.confirmPassword && fields.newPassword !== fields.confirmPassword) nextErrors.confirmPassword = "The new password and confirmation do not match.";
    setErrors(nextErrors);
    setNotice("");
    if (Object.keys(nextErrors).length) {
      form.elements.namedItem(Object.keys(nextErrors)[0]).focus();
      return;
    }

    reset(form);
    setNotice("Password changes will be available when account security is connected to the backend. No password was changed.");
  };

  return (
    <div className="content-wrap profile-settings-wrap change-password-page">
      <a className="settings-back-link" href="/settings#security" onClick={(event) => { event.preventDefault(); onNavigate("/settings#security"); }}><ArrowLeft size={16} /> Back to Settings</a>
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><LockKeyhole size={23} /></span>
        <div><p className="profile-kicker">ACCOUNT SECURITY</p><h1>Change password</h1><p>Preview the fields needed for a future password update.</p></div>
      </header>
      <section className="profile-settings-card password-flow-card" aria-labelledby="change-password-title">
        <div className="security-unavailable" role="note"><LockKeyhole size={18} /><p>Password changes are not available yet. They will be enabled when account security is connected to the backend. This prototype does not change or verify passwords.</p></div>
        <form className="password-flow-form" onSubmit={submit} noValidate aria-describedby="password-flow-boundary">
          <h2 id="change-password-title">Password details</h2>
          {passwordFields.map((field) => {
            const errorId = `change-${field.name}-error`;
            return <label className="profile-field" key={field.name} htmlFor={`change-${field.name}`}>
              <span>{field.label}</span>
              <span className="settings-password-input"><input id={`change-${field.name}`} name={field.name} type={visible[field.name] ? "text" : "password"} autoComplete={field.autoComplete} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? errorId : undefined} onChange={() => { setErrors((current) => ({ ...current, [field.name]: "" })); setNotice(""); }} /><button className="password-visibility-button" type="button" aria-label={`${visible[field.name] ? "Hide" : "Show"} ${field.label.toLowerCase()}`} aria-pressed={Boolean(visible[field.name])} onClick={() => setVisible((current) => ({ ...current, [field.name]: !current[field.name] }))}>{visible[field.name] ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
              {errors[field.name] && <small className="profile-field-error" id={errorId} role="alert">{errors[field.name]}</small>}
            </label>;
          })}
          <p className="password-flow-boundary" id="password-flow-boundary">This form is a future-flow preview only. Values are not sent, saved, or retained when you leave or reset this screen.</p>
          {notice && <p className="security-unavailable security-form-notice" role="status">{notice}</p>}
          <div className="password-flow-actions"><button className="profile-secondary-button" type="reset" onClick={(event) => reset(event.currentTarget.form)}><RotateCcw size={16} /> Reset fields</button><button className="profile-primary-button" type="submit">Check form</button></div>
        </form>
        <p className="forgot-password-link">Forgot your current password? <a href="/forgot-password">Use password recovery</a>.</p>
      </section>
    </div>
  );
}
