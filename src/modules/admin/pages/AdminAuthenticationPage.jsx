import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";
import { apiRequest } from "../../../api/apiClient.js";
import "../../auth/styles/auth.css";
import "../styles/admin-auth.css";

function validate(values) {
  const errors = {};
  if (!String(values.email ?? "").trim()) errors.email = "Admin email is required.";
  if (!String(values.password ?? "")) errors.password = "Password is required.";
  return errors;
}

export default function AdminAuthenticationPage({ onLoginSuccess }) {
  const [values, setValues] = useState({});
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    setStatus("");
    try {
      await apiRequest("/api/auth/admin/login", {
        method: "POST",
        body: { email: values.email.trim(), password: values.password },
      });
      await onLoginSuccess();
    } catch (error) {
      setStatus(error.message || "We couldn't sign you in. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const update = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setStatus("");
  };

  return (
    <main className="auth-page admin-auth-page">
      <header className="auth-topbar">
        <a className="auth-brand" href="/admin/login" aria-label="Vaultori Admin">
          <span className="auth-brand-icon"><GraduationCap size={25} /></span>
          <strong>Vaultori</strong><span className="admin-auth-brand-label">Admin</span>
        </a>
      </header>
      <div className="auth-page-grid">
        <aside className="auth-aside">
          <div className="auth-aside-orb" />
          <span className="auth-aside-icon"><ShieldCheck size={23} /></span>
          <p className="auth-aside-kicker">ADMIN ACCOUNT SECURITY</p>
          <h2>Administrative access is controlled.</h2>
          <p>Administrative access is reserved for designated team members.</p>
        </aside>
        <section className="auth-card" aria-labelledby="admin-auth-title">
          <a className="auth-back-link" href="/welcome"><ArrowLeft size={15} /> Back to Vaultori</a>
          <p className="auth-eyebrow">ADMIN ACCESS</p>
          <h1 id="admin-auth-title">Admin sign in</h1>
          <p className="auth-intro">Sign in with a provisioned Vaultori administrator account.</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="auth-field">
              <label htmlFor="admin-auth-email">Admin email<span aria-hidden="true"> *</span></label>
              <input id="admin-auth-email" name="email" type="email" autoComplete="username" value={values.email ?? ""}
                aria-invalid={Boolean(errors.email)} onChange={(event) => update("email", event.target.value)} />
              {errors.email && <small className="field-error" role="alert">{errors.email}</small>}
            </div>
            <div className="auth-field">
              <label htmlFor="admin-auth-password">Password<span aria-hidden="true"> *</span></label>
              <div className="auth-input-wrap password-wrap">
                <input id="admin-auth-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password"
                  value={values.password ?? ""} aria-invalid={Boolean(errors.password)}
                  onChange={(event) => update("password", event.target.value)} />
                <button className="password-toggle" type="button" aria-label={`${visible ? "Hide" : "Show"} password`}
                  aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <small className="field-error" role="alert">{errors.password}</small>}
            </div>
            <button className="auth-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="auth-spinner" aria-hidden="true" />Signing in…</> : <>Sign in <ArrowRight size={17} /></>}
            </button>
            {status && <p className="feedback-message feedback-error" role="alert">{status}</p>}
          </form>
        </section>
      </div>
      <footer className="auth-footer">Vaultori</footer>
    </main>
  );
}
