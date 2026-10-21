import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import "../styles/auth.css";

const screenCopy = {
  "/sign-up": { eyebrow: "START YOUR VAULT", title: "Create your account", intro: "Bring your university documents and academic records together." },
  "/login": { eyebrow: "WELCOME BACK", title: "Log in to Student Vault", intro: "Pick up where you left off and keep your university life organized." },
  "/forgot-password": { eyebrow: "ACCOUNT ACCESS", title: "Forgot your password?", intro: "Enter the email address you would use for your Student Vault account." },
  "/reset-password": { eyebrow: "ACCOUNT ACCESS", title: "Choose a new password", intro: "This screen is a prototype and will not change a real password." },
  "/verify": { eyebrow: "ONE MORE STEP", title: "Check your email", intro: "Enter the six digit code shown in this prototype flow." },
  "/profile/setup": { eyebrow: "MAKE IT YOURS", title: "Set up your student profile", intro: "Add a few details to personalize the sample experience." },
};

const authLinks = {
  "/sign-up": <p className="auth-switch">Already have an account? <a href="/login">Log in</a></p>,
  "/login": <p className="auth-switch">New to Student Vault? <a href="/sign-up">Create an account</a></p>,
};

const fieldSets = {
  "/sign-up": [
    { name: "fullName", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Your email address", type: "email", autoComplete: "email" },
    { name: "password", label: "Create password", type: "password", autoComplete: "new-password", help: "Use at least 8 characters." },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ],
  "/login": [
    { name: "email", label: "Your email address", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
  "/forgot-password": [{ name: "email", label: "Email address", type: "email", autoComplete: "email" }],
  "/reset-password": [
    { name: "password", label: "New password", type: "password", autoComplete: "new-password", help: "Use at least 8 characters." },
    { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" },
  ],
  "/verify": [{ name: "code", label: "Verification code", inputMode: "numeric", maxLength: 6, help: "Enter any six digits for this prototype." }],
  "/profile/setup": [
    { name: "firstName", label: "First name", autoComplete: "given-name" },
    { name: "lastName", label: "Last name", autoComplete: "family-name" },
    { name: "university", label: "University", autoComplete: "organization" },
    { name: "program", label: "Program or course", autoComplete: "organization-title" },
    { name: "studyYear", label: "Year of study", select: true, options: ["Select your year", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5+"] },
  ],
};

function WelcomePage() {
  const prototypeSignOut = new URLSearchParams(window.location.search).get("prototypeSignOut") === "1";
  return (
    <main className="auth-landing">
      {prototypeSignOut && <p className="prototype-signout-notice" role="status">Prototype sign out selected. No real session was ended.</p>}
      <header className="auth-topbar">
        <a className="auth-brand" href="/" aria-label="Student Vault dashboard"><span className="auth-brand-icon"><GraduationCap size={25} /></span><strong>Student Vault</strong></a>
        <div className="auth-top-links"><a href="/login">Log in</a><a href="/sign-up" className="auth-top-cta">Create account <ArrowRight size={16} /></a></div>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-kicker"><Sparkles size={15} /> YOUR UNIVERSITY LIFE, ORGANIZED</span>
          <h1>All your important student documents, in one place.</h1>
          <p>Keep academic records and university documents together, easy to find when you need them.</p>
          <div className="landing-actions"><a className="auth-primary" href="/sign-up">Get started <ArrowRight size={17} /></a><a className="auth-secondary" href="/login">I already have an account</a></div>
          <p className="prototype-note"><ShieldCheck size={16} /> Frontend prototype only. No account or document is created or stored.</p>
        </div>
        <div className="landing-art" aria-label="Illustration of organized student records">
          <div className="art-glow" />
          <div className="art-sheet art-sheet-back"><span /><span /><span /></div>
          <div className="art-folder"><div className="folder-tab" /><div className="folder-front"><FileStackMark /></div></div>
          <div className="art-seal"><GraduationCap size={31} /></div>
          <div className="art-caption">Your next chapter,<br /><strong>well organized.</strong></div>
        </div>
      </section>
      <footer className="auth-landing-footer"><span id="prototype-terms">Prototype terms: no account is created and no data is saved.</span><span>·</span> Student Vault prototype</footer>
    </main>
  );
}

function FileStackMark() {
  return <div className="file-stack-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function validateForm(path, values) {
  const errors = {};
  const required = (name, label) => { if (!String(values[name] ?? "").trim()) errors[name] = label + " is required."; };
  const email = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

  if (path === "/sign-up") {
    required("fullName", "Full name"); required("email", "Email address");
    if (values.email && !email(values.email)) errors.email = "Enter a valid email address.";
    required("password", "Password");
    if (values.password && values.password.length < 8) errors.password = "Use at least 8 characters.";
    required("confirmPassword", "Password confirmation");
    if (values.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    if (!values.acceptTerms) errors.acceptTerms = "Accept the prototype terms to continue.";
  } else if (path === "/login") {
    required("email", "Email address"); if (values.email && !email(values.email)) errors.email = "Enter a valid email address.";
    required("password", "Password");
  } else if (path === "/forgot-password") {
    required("email", "Email address"); if (values.email && !email(values.email)) errors.email = "Enter a valid email address.";
  } else if (path === "/reset-password") {
    required("password", "New password");
    if (values.password && values.password.length < 8) errors.password = "Use at least 8 characters.";
    required("confirmPassword", "Password confirmation");
    if (values.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  } else if (path === "/verify") {
    required("code", "Verification code");
    if (values.code && !/^\d{6}$/.test(values.code)) errors.code = "Enter exactly six digits.";
  } else if (path === "/profile/setup") {
    required("firstName", "First name"); required("lastName", "Last name");
    required("university", "University"); required("studyYear", "Year of study");
  }
  return errors;
}

function AuthField({ field, value, error, visible, onChange, onToggle }) {
  const id = "auth-" + field.name;
  const describedBy = [field.help ? id + "-help" : "", error ? id + "-error" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id}>{field.label}<span aria-hidden="true"> *</span></label>
      <div className={"auth-input-wrap " + (field.type === "password" ? "password-wrap" : "")}>
        {field.select ? (
          <select id={id} name={field.name} value={value ?? ""} onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={describedBy} required>
            {field.options.map((option, index) => <option key={option} value={index === 0 ? "" : option}>{option}</option>)}
          </select>
        ) : (
          <input id={id} name={field.name} type={field.type === "password" ? (visible ? "text" : "password") : (field.type ?? "text")} value={value ?? ""} onChange={onChange} autoComplete={field.autoComplete} inputMode={field.inputMode} maxLength={field.maxLength} aria-invalid={Boolean(error)} aria-describedby={describedBy} required />
        )}
        {field.type === "password" && <button className="password-toggle" type="button" onClick={() => onToggle(field.name)} aria-label={(visible ? "Hide " : "Show ") + field.label.toLowerCase()} aria-pressed={Boolean(visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>
      {field.help && <small className="field-help" id={id + "-help"}>{field.help}</small>}
      {error && <small className="field-error" id={id + "-error"}>{error}</small>}
    </div>
  );
}

function AuthForm({ route, copy }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [loading, setLoading] = useState(false);
  const fields = fieldSets[route.path] ?? [];

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
    if (status.kind) setStatus({ kind: "", message: "" });
  };
  const togglePassword = (name) => setVisiblePasswords((current) => ({ ...current, [name]: !current[name] }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateForm(route.path, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ kind: "error", message: "Please review the highlighted fields." });
      document.getElementById(Object.keys(nextErrors)[0] === "acceptTerms" ? "acceptTerms" : "auth-" + Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setLoading(true);
    setStatus({ kind: "loading", message: "Checking this prototype form…" });
    window.setTimeout(() => {
      setLoading(false);
      setStatus({ kind: "success", message: successCopy[route.path] });
    }, 550);
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {fields.map((field) => <AuthField key={field.name} field={field} value={values[field.name]} error={errors[field.name]} visible={visiblePasswords[field.name]} onChange={handleChange} onToggle={togglePassword} />)}
      {route.path === "/login" && <div className="form-inline-link"><a href="/forgot-password">Forgot password?</a></div>}
      {route.path === "/sign-up" && <div className="terms-field">
        <input id="acceptTerms" name="acceptTerms" type="checkbox" checked={Boolean(values.acceptTerms)} onChange={handleChange} aria-invalid={Boolean(errors.acceptTerms)} aria-describedby={errors.acceptTerms ? "terms-error" : undefined} />
        <label htmlFor="acceptTerms">I agree to the <a href="/welcome#prototype-terms">prototype terms</a> and understand this form does not create an account.</label>
        {errors.acceptTerms && <small id="terms-error" className="field-error">{errors.acceptTerms}</small>}
      </div>}
      {route.path === "/verify" && <p className="auth-inline-note">For this demo, enter any six digits. No code is sent or verified.</p>}
      {route.path === "/forgot-password" && <p className="auth-inline-note">No reset email will be sent. This form only demonstrates the interface.</p>}
      <button className="auth-primary auth-submit" type="submit" disabled={loading}>
        {loading ? <><span className="auth-spinner" aria-hidden="true" />Please wait…</> : <>{submitLabels[route.path]} <ArrowRight size={17} /></>}
      </button>
      <div className="auth-feedback" aria-live="polite" aria-atomic="true">
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
        {status.kind === "success" && <div className="success-next">{successLinks[route.path]}</div>}
      </div>
      {authLinks[route.path]}
      <p className="auth-prototype-footnote"><LockKeyhole size={14} /> Prototype only. Credentials are not sent to a server or saved after leaving this screen.</p>
    </form>
  );
}

const submitLabels = {
  "/sign-up": "Continue to verification", "/login": "Continue", "/forgot-password": "Preview reset steps",
  "/reset-password": "Preview password reset", "/verify": "Continue to profile setup", "/profile/setup": "Preview profile setup",
};
const successCopy = {
  "/sign-up": "Prototype check complete. No account was created and no email was sent.",
  "/login": "The sample form passed its checks. You have not been signed in.",
  "/forgot-password": "Form complete. No password reset email was sent.",
  "/reset-password": "Form complete. No password was changed.",
  "/verify": "The sample code format passed. Your email has not been verified.",
  "/profile/setup": "Profile preview complete. No profile was saved.",
};
const successLinks = {
  "/sign-up": <a href="/verify">Continue to the verification preview <ArrowRight size={15} /></a>,
  "/login": <a href="/">Open the dashboard preview <ArrowRight size={15} /></a>,
  "/forgot-password": <a href="/reset-password">Open the reset preview <ArrowRight size={15} /></a>,
  "/reset-password": <a href="/login">Return to login <ArrowRight size={15} /></a>,
  "/verify": <a href="/profile/setup">Continue to profile setup <ArrowRight size={15} /></a>,
  "/profile/setup": <a href="/">Open the dashboard preview <ArrowRight size={15} /></a>,
};

export default function AuthenticationPage({ route }) {
  if (route.path === "/welcome" || route.path === "/onboarding") return <WelcomePage />;
  const copy = screenCopy[route.path];
  if (!copy) return <WelcomePage />;

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <a className="auth-brand" href="/welcome" aria-label="Student Vault welcome"><span className="auth-brand-icon"><GraduationCap size={25} /></span><strong>Student Vault</strong></a>
        <a href="/" className="auth-dashboard-link">Dashboard preview</a>
      </header>
      <div className="auth-page-grid">
        <aside className="auth-aside">
          <div className="auth-aside-orb" />
          <span className="auth-aside-icon"><ShieldCheck size={23} /></span>
          <p className="auth-aside-kicker">A calmer way to stay organized</p>
          <h2>Your university life, organized in one place.</h2>
          <p>Keep important academic documents close at hand, so you can focus on what comes next.</p>
          <div className="auth-aside-bottom"><Sparkles size={16} /> A Student Vault prototype experience</div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <a className="auth-back-link" href="/welcome"><ArrowLeft size={15} /> Back to welcome</a>
          <p className="auth-eyebrow">{copy.eyebrow}</p>
          <h1 id="auth-title">{copy.title}</h1>
          <p className="auth-intro">{copy.intro}</p>
          <AuthForm route={route} copy={copy} />
        </section>
      </div>
      <footer className="auth-footer">Student Vault <span>·</span> Frontend prototype only</footer>
    </main>
  );
}
