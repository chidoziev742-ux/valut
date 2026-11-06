import { useRef, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, RotateCcw } from "lucide-react";
import "../../../profile-settings.css";

const passwordFields = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
];

export default function ChangePasswordPage({ onNavigate, onSubmit }) {
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [requestState, setRequestState] = useState({ status: "idle", message: "" });
  const submitting = useRef(false);
  const reset = (form) => {
    form.reset();
    setErrors({});
    setVisible({});
    setRequestState({ status: "idle", message: "" });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(passwordFields.map(({ name }) => [name, form.elements.namedItem(name).value]));
    const nextErrors = {};
    for (const field of passwordFields) {
      if (!fields[field.name]) nextErrors[field.name] = `${field.label} is required.`;
    }
    const newPasswordBytes = new TextEncoder().encode(fields.newPassword).length;
    if (fields.currentPassword && new TextEncoder().encode(fields.currentPassword).length > 1024) {
      nextErrors.currentPassword = "Your current password is too long.";
    }
    if (fields.newPassword && !fields.newPassword.trim()) {
      nextErrors.newPassword = "The new password cannot contain only whitespace.";
    } else if (fields.newPassword && (newPasswordBytes < 8 || newPasswordBytes > 1024)) {
      nextErrors.newPassword = "Use a password that is at least  8 character";
    }
    if (fields.newPassword && fields.currentPassword && fields.newPassword === fields.currentPassword) nextErrors.newPassword = "Choose a new password that differs from your current password.";
    if (fields.confirmPassword && fields.newPassword !== fields.confirmPassword) nextErrors.confirmPassword = "The new password and confirmation do not match.";
    setErrors(nextErrors);
    setRequestState({ status: "idle", message: "" });
    if (Object.keys(nextErrors).length) {
      form.elements.namedItem(Object.keys(nextErrors)[0]).focus();
      return;
    }

    submitting.current = true;
    setRequestState({ status: "loading", message: "" });
    try {
      await onSubmit(fields);
      form.reset();
      setErrors({});
      setVisible({});
      setRequestState({ status: "success", message: "Your password has been updated successfully." });
    } catch (error) {
      setRequestState({
        status: "error",
        message: error.message || "We couldn't update your password. Please try again.",
      });
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="content-wrap profile-settings-wrap change-password-page">
      <a className="settings-back-link" href="/settings#security" onClick={(event) => { event.preventDefault(); onNavigate("/settings#security"); }}><ArrowLeft size={16} /> Back to Settings</a>
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><LockKeyhole size={23} /></span>
        <div><p className="profile-kicker">ACCOUNT SECURITY</p><h1>Change password</h1><p>Update your account password.</p></div>
      </header>
      <section className="profile-settings-card password-flow-card" aria-labelledby="change-password-title">
        <form className="password-flow-form" onSubmit={submit} noValidate>
          <h2 id="change-password-title">Password details</h2>
          {requestState.status === "error" && <p className="profile-error-feedback" role="alert">{requestState.message}</p>}
          {requestState.status === "success" && <p className="profile-feedback" role="status"><Check size={17} />{requestState.message}</p>}
          {passwordFields.map((field) => {
            const errorId = `change-${field.name}-error`;
            return <label className="profile-field" key={field.name} htmlFor={`change-${field.name}`}>
              <span>{field.label}</span>
              <span className="settings-password-input"><input id={`change-${field.name}`} name={field.name} type={visible[field.name] ? "text" : "password"} autoComplete={field.autoComplete} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? errorId : undefined} disabled={requestState.status === "loading"} onChange={() => { setErrors((current) => ({ ...current, [field.name]: "" })); setRequestState({ status: "idle", message: "" }); }} /><button className="password-visibility-button" type="button" aria-label={`${visible[field.name] ? "Hide" : "Show"} ${field.label.toLowerCase()}`} aria-pressed={Boolean(visible[field.name])} disabled={requestState.status === "loading"} onClick={() => setVisible((current) => ({ ...current, [field.name]: !current[field.name] }))}>{visible[field.name] ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
              {errors[field.name] && <small className="profile-field-error" id={errorId} role="alert">{errors[field.name]}</small>}
            </label>;
          })}
          <div className="password-flow-actions"><button className="profile-secondary-button" type="reset" disabled={requestState.status === "loading"} onClick={(event) => reset(event.currentTarget.form)}><RotateCcw size={16} /> Reset fields</button><button className="profile-primary-button" type="submit" disabled={requestState.status === "loading"}>{requestState.status === "loading" ? "Updating password…" : "Update password"}</button></div>
        </form>
        <p className="forgot-password-link">Forgot your current password? <a href="/forgot-password">Use password recovery</a>.</p>
      </section>
    </div>
  );
}
