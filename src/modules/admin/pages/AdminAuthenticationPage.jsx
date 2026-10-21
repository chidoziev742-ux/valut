import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, ShieldCheck } from "lucide-react";
import "../../auth/styles/auth.css";
import "../styles/admin-auth.css";

const pageCopy = {
  "/admin/login": { eyebrow: "ADMIN ACCESS", title: "Admin sign in", intro: "Sign-in UI preview for designated Student Vault administrators.", submit: "Preview sign in" },
  "/admin/signup": { eyebrow: "ADMIN ACCOUNT SETUP", title: "Admin registration", intro: "Registration form preview. No account will be created in this prototype.", submit: "Preview registration" },
  "/admin/forgot-password": { eyebrow: "ADMIN ACCOUNT ACCESS", title: "Recover admin access", intro: "Enter the email address associated with your designated Admin account.", submit: "Preview recovery" },
  "/admin/reset-password": { eyebrow: "ADMIN ACCOUNT ACCESS", title: "Reset admin password", intro: "This screen previews a future reset flow and does not change a password.", submit: "Preview password reset" },
};

const formFields = {
  "/admin/login": [
    { name: "email", label: "Admin email", type: "email", autoComplete: "username" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
  "/admin/signup": [
    { name: "fullName", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Admin email", type: "email", autoComplete: "email" },
    { name: "password", label: "Create password", type: "password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ],
  "/admin/forgot-password": [
    { name: "email", label: "Admin email", type: "email", autoComplete: "email" },
  ],
  "/admin/reset-password": [
    { name: "password", label: "New password", type: "password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" },
  ],
};

function validate(path, values) {
  const errors = {};
  const required = (name, label) => { if (!String(values[name] ?? "").trim()) errors[name] = `${label} is required.`; };
  const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

  if (["/admin/login", "/admin/signup", "/admin/forgot-password"].includes(path)) {
    if (path === "/admin/signup") required("fullName", "Full name");
    required("email", "Admin email");
    if (values.email && !emailValid(values.email)) errors.email = "Enter a valid email address.";
  }
  if (path === "/admin/login") required("password", "Password");
  if (path === "/admin/signup") {
    required("password", "Password");
    if (values.password && values.password.length < 8) errors.password = "Use at least 8 characters.";
    required("confirmPassword", "Password confirmation");
    if (values.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  }
  if (path === "/admin/reset-password") {
    required("password", "New password");
    if (values.password && values.password.length < 8) errors.password = "Use at least 8 characters.";
    required("confirmPassword", "Password confirmation");
    if (values.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

function nextLinks(path) {
  if (path === "/admin/login") return <><a href="/admin/forgot-password">Forgot password?</a><span>Need an Admin account? <a href="/admin/signup">Register</a></span></>;
  if (path === "/admin/signup") return <span>Already registered? <a href="/admin/login">Admin sign in</a></span>;
  if (path === "/admin/forgot-password") return <><a href="/admin/reset-password">Open the reset screen preview</a><a href="/admin/login">Return to Admin sign in</a></>;
  return <a href="/admin/login">Return to Admin sign in</a>;
}

function resultCopy(path) {
  if (path === "/admin/login") return "Local form checks passed. No sign-in occurred and no Admin access was granted.";
  if (path === "/admin/signup") return "Local form checks passed. No Admin account was created.";
  if (path === "/admin/forgot-password") return "Form checks passed. No recovery email was sent.";
  return "Form checks passed. No password was reset or changed.";
}

export default function AdminAuthenticationPage({ route }) {
  const path = route.path;
  const copy = pageCopy[path] ?? pageCopy["/admin/login"];
  const fields = formFields[path] ?? formFields["/admin/login"];
  const [values, setValues] = useState({});
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate(path, values);
    setErrors(nextErrors);
    setFeedback("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(`admin-auth-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setValues({});
    setVisible({});
    setFeedback(resultCopy(path));
  };

  return (
    <main className="auth-page admin-auth-page">
      <header className="auth-topbar">
        <a className="auth-brand" href="/admin" aria-label="Student Vault Admin preview"><span className="auth-brand-icon"><GraduationCap size={25} /></span><strong>Student Vault</strong><span className="admin-auth-brand-label">Admin</span></a>
        <a href="/admin" className="auth-dashboard-link">Admin preview</a>
      </header>
      <div className="auth-page-grid">
        <aside className="auth-aside">
          <div className="auth-aside-orb" />
          <span className="auth-aside-icon"><ShieldCheck size={23} /></span>
          <p className="auth-aside-kicker">ADMIN ACCOUNT SECURITY</p>
          <h2>Administrative access is controlled.</h2>
          <p>Future Admin access will depend on server-verified identity and role authorization.</p>
          <div className="auth-aside-bottom"><LockKeyhole size={15} /> Prototype only · no authorization is active</div>
        </aside>
        <section className="auth-card" aria-labelledby="admin-auth-title">
          <a className="auth-back-link" href="/admin"><ArrowLeft size={15} /> Back to Admin preview</a>
          <p className="auth-eyebrow">{copy.eyebrow}</p>
          <h1 id="admin-auth-title">{copy.title}</h1>
          <p className="auth-intro">{copy.intro}</p>
          {(path === "/admin/forgot-password" || path === "/admin/reset-password") && <p className="admin-auth-notice"><LockKeyhole size={16} /> Recovery is not connected. No email is sent and no credential is changed.</p>}
          <form className="auth-form" onSubmit={submit} noValidate>
            {fields.map((field) => {
              const id = `admin-auth-${field.name}`;
              const errorId = `${id}-error`;
              return <div className="auth-field" key={field.name}>
                <label htmlFor={id}>{field.label}<span aria-hidden="true"> *</span></label>
                <div className={`auth-input-wrap${field.type === "password" ? " password-wrap" : ""}`}>
                  <input id={id} name={field.name} type={field.type === "password" ? (visible[field.name] ? "text" : "password") : (field.type ?? "text")} value={values[field.name] ?? ""} autoComplete={field.autoComplete} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? errorId : undefined} onChange={(event) => { const { value } = event.target; setValues((current) => ({ ...current, [field.name]: value })); setErrors((current) => ({ ...current, [field.name]: "" })); setFeedback(""); }} />
                  {field.type === "password" && <button className="password-toggle" type="button" aria-label={`${visible[field.name] ? "Hide" : "Show"} ${field.label.toLowerCase()}`} aria-pressed={Boolean(visible[field.name])} onClick={() => setVisible((current) => ({ ...current, [field.name]: !current[field.name] }))}>{visible[field.name] ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
                </div>
                {errors[field.name] && <small id={errorId} className="field-error" role="alert">{errors[field.name]}</small>}
              </div>;
            })}
            <button className="auth-primary auth-submit" type="submit">{copy.submit} <ArrowRight size={17} /></button>
            <div className="auth-feedback" aria-live="polite" aria-atomic="true">{feedback && <p className="feedback-message feedback-success" role="status">{feedback}</p>}</div>
            <div className="admin-auth-links">{nextLinks(path)}</div>
            <p className="auth-prototype-footnote"><LockKeyhole size={14} /> Credentials are not sent to a server or retained after this form check.</p>
          </form>
        </section>
      </div>
      <footer className="auth-footer">Student Vault <span>·</span> Admin authentication prototype only</footer>
    </main>
  );
}
