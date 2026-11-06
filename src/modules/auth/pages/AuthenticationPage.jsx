import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff, GraduationCap, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest } from "../../../api/apiClient.js";
import "../styles/auth.css";

const screenCopy = {
  "/sign-up": { eyebrow: "START YOUR VAULT", title: "Create your account", intro: "Bring your university documents and academic records together." },
  "/login": { eyebrow: "WELCOME BACK", title: "Log in to Vaultori", intro: "Pick up where you left off and keep your university life organized." },
  "/forgot-password": { eyebrow: "ACCOUNT ACCESS", title: "Forgot your password?", intro: "Enter the email address you would use for your Vaultori account." },
  "/reset-password": { eyebrow: "ACCOUNT ACCESS", title: "Choose a new password", intro: "Create a new password for your Vaultori account." },
};

const authLinks = {
  "/sign-up": <p className="auth-switch">Already have an account? <a href="/login">Log in</a></p>,
  "/login": <p className="auth-switch">New to Vaultori? <a href="/sign-up">Create an account</a></p>,
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
};

function WelcomePage() {
  return (
    <main className="auth-landing">
      <header className="auth-topbar">
        <a className="auth-brand" href="/" aria-label="Vaultori home"><span className="auth-brand-icon"><GraduationCap size={25} /></span><strong>Vaultori</strong></a>
        <div className="auth-top-links"><a href="/login">Log in</a><a href="/sign-up" className="auth-top-cta">Create account <ArrowRight size={16} /></a></div>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-kicker"><Sparkles size={15} /> YOUR UNIVERSITY LIFE, ORGANIZED</span>
          <h1>All your important student documents, in one place.</h1>
          <p>Keep academic records and university documents together, easy to find when you need them.</p>
          <div className="landing-actions"><a className="auth-primary" href="/sign-up">Get started <ArrowRight size={17} /></a><a className="auth-secondary" href="/login">I already have an account</a></div>
        </div>
        <div className="landing-art" aria-label="Illustration of organized student records">
          <div className="art-glow" />
          <div className="art-sheet art-sheet-back"><span /><span /><span /></div>
          <div className="art-folder"><div className="folder-tab" /><div className="folder-front"><FileStackMark /></div></div>
          <div className="art-seal"><GraduationCap size={31} /></div>
          <div className="art-caption">Your next chapter,<br /><strong>well organized.</strong></div>
        </div>
      </section>
      <footer className="auth-landing-footer">Vaultori</footer>
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
    if (!values.acceptTerms) errors.acceptTerms = "Accept to continue.";
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

function EmailVerificationExperience({ verificationEmail, onNavigate }) {
  const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [verificationFailure, setVerificationFailure] = useState("");
  const [status, setStatus] = useState(() => token
    ? { kind: "loading", message: "Verifying your email…" }
    : { kind: "", message: "" });
  const [resending, setResending] = useState(false);
  const verificationRequestToken = useRef("");
  const resendInProgress = useRef(false);

  useEffect(() => {
    if (!token || verificationRequestToken.current === token) return;

    verificationRequestToken.current = token;
    setStatus({ kind: "loading", message: "Verifying your email…" });
    apiRequest("/api/auth/verify-email", {
      method: "POST",
      body: { token },
    }).then(() => {
      setVerificationComplete(true);
      setStatus({ kind: "success", message: "Your email is verified." });
      window.history.replaceState({}, "", window.location.pathname);
    }).catch((error) => {
      setVerificationFailure(error.status === 400 ? "invalid" : "request");
      setStatus({
        kind: "error",
        message: error.status === 400
          ? "This link is invalid, expired, or has already been used."
          : error.message || "We couldn't verify this link. Please try again or request a new email.",
      });
    });
  }, [token]);

  const resendVerification = async () => {
    if (!verificationEmail || resendInProgress.current) return;

    resendInProgress.current = true;
    setResending(true);
    setStatus({ kind: "loading", message: "Sending a new verification email…" });
    try {
      const result = await apiRequest("/api/auth/resend-verification", {
        method: "POST",
        body: { email: verificationEmail },
      });
      setStatus({
        kind: "success",
        message: result?.message || "If an unverified account exists for this email, a verification message has been sent.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error.message || "We couldn't request a new verification email. Please try again.",
      });
    } finally {
      resendInProgress.current = false;
      setResending(false);
    }
  };

  if (verificationComplete) {
    return (
      <div className="auth-verification-state">
        <span className="auth-verification-icon auth-verification-icon-success"><CheckCircle2 size={29} /></span>
        <p className="auth-eyebrow">EMAIL CONFIRMED</p>
        <h1 id="auth-title">Your email is verified!</h1>
        <p className="auth-intro">Your Vaultori account is ready. You can now log in.</p>
        <button className="auth-primary auth-submit" type="button" onClick={() => onNavigate("/login")}>
          Go to Login <ArrowRight size={17} />
        </button>
      </div>
    );
  }

  if (token && !verificationFailure && !verificationComplete) {
    return (
      <div className="auth-verification-state" aria-live="polite">
        <span className="auth-verification-icon"><span className="auth-spinner" aria-hidden="true" /></span>
        <p className="auth-eyebrow">SECURE ACCOUNT SETUP</p>
        <h1 id="auth-title">Verifying your email…</h1>
        <p className="auth-intro">Please wait while we confirm your email address.</p>
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
      </div>
    );
  }

  if (token && verificationFailure) {
    return (
      <div className="auth-verification-state">
        <span className="auth-verification-icon auth-verification-icon-error"><CircleAlert size={29} /></span>
        <p className="auth-eyebrow">{verificationFailure === "invalid" ? "LINK NOT VALID" : "VERIFICATION ISSUE"}</p>
        <h1 id="auth-title">{verificationFailure === "invalid" ? "This link can't be used" : "We couldn't verify your email"}</h1>
        <p className="auth-intro">
          {verificationFailure === "invalid"
            ? "Verification links can only be used once and may expire. Request a fresh link to continue."
            : "Please try again in a moment, or request a fresh verification link."}
        </p>
        {verificationEmail && (
          <button className="auth-primary auth-submit" type="button" onClick={resendVerification} disabled={resending}>
            {resending ? <><span className="auth-spinner" aria-hidden="true" />Sending…</> : <>Resend verification email <ArrowRight size={17} /></>}
          </button>
        )}
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
      </div>
    );
  }

  return (
    <div className="auth-verification-state">
      <span className="auth-verification-icon"><MailCheck size={29} /></span>
      <p className="auth-eyebrow">ONE MORE STEP</p>
      <h1 id="auth-title">{verificationEmail ? "You're almost there!" : "Check your email"}</h1>
      <p className="auth-intro">
        {verificationEmail
          ? <>We sent a verification link to <strong className="auth-verification-email">{verificationEmail}</strong>. Check your inbox and follow the link to verify your email.</>
          : "If you just created an account, check your inbox for the verification link and open it to continue."}
      </p>
      {verificationEmail ? (
        <button className="auth-primary auth-submit" type="button" onClick={resendVerification} disabled={resending}>
          {resending ? <><span className="auth-spinner" aria-hidden="true" />Sending…</> : <>Resend verification email <ArrowRight size={17} /></>}
        </button>
      ) : (
        <button className="auth-primary auth-submit" type="button" onClick={() => onNavigate("/sign-up")}>
          Create an account <ArrowRight size={17} />
        </button>
      )}
      {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
    </div>
  );
}

function ForgotPasswordExperience({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const errors = validateForm("/forgot-password", { email });
    setError(errors.email ?? "");
    if (Object.keys(errors).length) return;

    setLoading(true);
    setStatus({ kind: "loading", message: "Sending your request…" });
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setStatus({
        kind: "success",
        message: "If an account exists for this email, we’ve sent instructions to reset its password. Check your inbox.",
      });
    } catch (requestError) {
      setStatus({
        kind: "error",
        message: requestError.message || "We couldn't process your request. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (status.kind === "success") {
    return (
      <div className="auth-verification-state">
        <span className="auth-verification-icon"><MailCheck size={29} /></span>
        <p className="auth-eyebrow">ACCOUNT ACCESS</p>
        <h1 id="auth-title">Check your email</h1>
        <p className="auth-intro">{status.message}</p>
        <button className="auth-primary auth-submit" type="button" onClick={() => onNavigate("/login")}>
          Return to Login <ArrowRight size={17} />
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="auth-eyebrow">ACCOUNT ACCESS</p>
      <h1 id="auth-title">Forgot your password?</h1>
      <p className="auth-intro">Enter the email address linked to your Vaultori account. If an account exists, we’ll send password reset instructions.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          field={{ name: "email", label: "Email address", type: "email", autoComplete: "email" }}
          value={email}
          error={error}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
            if (status.kind) setStatus({ kind: "", message: "" });
          }}
        />
        <button className="auth-primary auth-submit" type="submit" disabled={loading}>
          {loading ? <><span className="auth-spinner" aria-hidden="true" />Sending…</> : <>Send reset link <ArrowRight size={17} /></>}
        </button>
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
        <button className="auth-secondary auth-submit" type="button" onClick={() => onNavigate("/login")}>
          Return to Login
        </button>
      </form>
    </>
  );
}

function ResetPasswordExperience({ onNavigate }) {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token")?.trim() ?? "");
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
    if (status.kind) setStatus({ kind: "", message: "" });
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm("/reset-password", values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!token) {
      setInvalidToken(true);
      setStatus({ kind: "error", message: "This password reset link is invalid or expired. Request a new link to continue." });
      return;
    }

    setLoading(true);
    setStatus({ kind: "loading", message: "Updating your password…" });
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token, newPassword: values.password },
      });
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("token");
      window.history.replaceState({}, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
      setToken("");
      setValues({ password: "", confirmPassword: "" });
      setComplete(true);
      setStatus({ kind: "success", message: "Your password has been updated. Sign in with your new password." });
    } catch (requestError) {
      if (requestError.code === "INVALID_RESET_TOKEN" || requestError.status === 400) {
        setInvalidToken(true);
        setStatus({ kind: "error", message: "This password reset link is invalid, expired, or already used. Request a new link to continue." });
      } else {
        setStatus({
          kind: "error",
          message: requestError.message || "We couldn't update your password. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return (
      <div className="auth-verification-state">
        <span className="auth-verification-icon auth-verification-icon-success"><CheckCircle2 size={29} /></span>
        <p className="auth-eyebrow">PASSWORD UPDATED</p>
        <h1 id="auth-title">You’re all set</h1>
        <p className="auth-intro">{status.message}</p>
        <button className="auth-primary auth-submit" type="button" onClick={() => onNavigate("/login")}>
          Go to Login <ArrowRight size={17} />
        </button>
      </div>
    );
  }

  if (!token || invalidToken) {
    return (
      <div className="auth-verification-state">
        <span className="auth-verification-icon auth-verification-icon-error"><CircleAlert size={29} /></span>
        <p className="auth-eyebrow">ACCOUNT ACCESS</p>
        <h1 id="auth-title">{invalidToken ? "This link can’t be used" : "Reset link unavailable"}</h1>
        <p className="auth-intro">
          {invalidToken
            ? "Password reset links expire and can only be used once. Request a new link to continue."
            : "Open the password reset link from your email, or request a new one."}
        </p>
        <button className="auth-primary auth-submit" type="button" onClick={() => onNavigate("/forgot-password")}>
          Request a new reset link <ArrowRight size={17} />
        </button>
        {invalidToken && status.kind === "error" && <p className="feedback-message feedback-error" role="alert">{status.message}</p>}
      </div>
    );
  }

  return (
    <>
      <p className="auth-eyebrow">ACCOUNT ACCESS</p>
      <h1 id="auth-title">Choose a new password</h1>
      <p className="auth-intro">Use at least 8 characters. Your password reset link can only be used once.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", help: "Use at least 8 characters." },
          { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" },
        ].map((field) => (
          <AuthField
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            visible={visiblePasswords[field.name]}
            onChange={handleChange}
            onToggle={() => setVisiblePasswords((current) => ({ ...current, [field.name]: !current[field.name] }))}
          />
        ))}
        <button className="auth-primary auth-submit" type="submit" disabled={loading}>
          {loading ? <><span className="auth-spinner" aria-hidden="true" />Updating…</> : <>Update password <ArrowRight size={17} /></>}
        </button>
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
      </form>
    </>
  );
}

function AuthForm({ route, onNavigate, onVerificationEmailChange, onLoginSuccess }) {
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
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(route.path, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ kind: "error", message: "Please review the highlighted fields." });
      document.getElementById(Object.keys(nextErrors)[0] === "acceptTerms" ? "acceptTerms" : "auth-" + Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setLoading(true);
    if (route.path === "/sign-up") {
      setStatus({ kind: "loading", message: "Creating your account…" });
      let registrationSucceeded = false;
      try {
        await apiRequest("/api/auth/register", {
          method: "POST",
          body: {
            fullName: values.fullName.trim(),
            email: values.email.trim(),
            password: values.password,
          },
        });
        onVerificationEmailChange(values.email.trim());
        registrationSucceeded = true;
      } catch (error) {
        setStatus({
          kind: "error",
          message: error.message || "Registration could not be completed. Please try again.",
        });
      } finally {
        setLoading(false);
      }
      if (registrationSucceeded) onNavigate("/verify");
      return;
    }

    if (route.path === "/login") {
      setStatus({ kind: "loading", message: "Signing in…" });
      try {
        await apiRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: values.email.trim(),
            password: values.password,
          },
        });
        await onLoginSuccess();
        setStatus({ kind: "success", message: "Signed in successfully." });
      } catch (error) {
        setStatus({
          kind: "error",
          message: error.message || "We couldn't sign you in. Check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
      return;
    }

  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {fields.map((field) => <AuthField key={field.name} field={field} value={values[field.name]} error={errors[field.name]} visible={visiblePasswords[field.name]} onChange={handleChange} onToggle={togglePassword} />)}
      {route.path === "/login" && <div className="form-inline-link"><a href="/forgot-password">Forgot password?</a></div>}
      {route.path === "/sign-up" && <div className="terms-field">
        <input id="acceptTerms" name="acceptTerms" type="checkbox" checked={Boolean(values.acceptTerms)} onChange={handleChange} aria-invalid={Boolean(errors.acceptTerms)} aria-describedby={errors.acceptTerms ? "terms-error" : undefined} />
        <label htmlFor="acceptTerms">I understand that an account will be created and a verification email will be sent.</label>
        {errors.acceptTerms && <small id="terms-error" className="field-error">{errors.acceptTerms}</small>}
      </div>}
      <button className="auth-primary auth-submit" type="submit" disabled={loading}>
        {loading ? <><span className="auth-spinner" aria-hidden="true" />Please wait…</> : <>{submitLabels[route.path]} <ArrowRight size={17} /></>}
      </button>
      <div className="auth-feedback" aria-live="polite" aria-atomic="true">
        {status.message && <p className={"feedback-message feedback-" + status.kind} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
        {status.kind === "success" && <div className="success-next">{successLinks[route.path]}</div>}
      </div>
      {authLinks[route.path]}
    </form>
  );
}

const submitLabels = {
  "/sign-up": "Create account", "/login": "Continue",
};
const successCopy = {
  "/sign-up": "Your account was created. Check your email to verify your address before signing in.",
};
const successLinks = {
  "/sign-up": <a href="/verify">Continue to email verification <ArrowRight size={15} /></a>,
};

export default function AuthenticationPage({
  route,
  onNavigate,
  verificationEmail,
  onVerificationEmailChange,
  onLoginSuccess,
}) {
  if (route.path === "/welcome" || route.path === "/onboarding") return <WelcomePage />;
  const copy = screenCopy[route.path];
  const dedicatedAuthRoute = ["/verify", "/forgot-password", "/reset-password"].includes(route.path);
  if (!copy && !dedicatedAuthRoute) return <WelcomePage />;

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <a className="auth-brand" href="/welcome" aria-label="Vaultori welcome"><span className="auth-brand-icon"><GraduationCap size={25} /></span><strong>Vaultori</strong></a>
      </header>
      <div className="auth-page-grid">
        <aside className="auth-aside">
          <div className="auth-aside-orb" />
          <span className="auth-aside-icon"><ShieldCheck size={23} /></span>
          <p className="auth-aside-kicker">A calmer way to stay organized</p>
          <h2>Your university life, organized in one place.</h2>
          <p>Keep important academic documents close at hand, so you can focus on what comes next.</p>
          <div className="auth-aside-bottom"><Sparkles size={16} /> Your university life, in order</div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <a className="auth-back-link" href="/welcome"><ArrowLeft size={15} /> Back to welcome</a>
          {route.path === "/verify" ? (
            <EmailVerificationExperience verificationEmail={verificationEmail} onNavigate={onNavigate} />
          ) : route.path === "/forgot-password" ? (
            <ForgotPasswordExperience onNavigate={onNavigate} />
          ) : route.path === "/reset-password" ? (
            <ResetPasswordExperience onNavigate={onNavigate} />
          ) : (
            <>
              <p className="auth-eyebrow">{copy.eyebrow}</p>
              <h1 id="auth-title">{copy.title}</h1>
              <p className="auth-intro">{copy.intro}</p>
              <AuthForm
                route={route}
                onNavigate={onNavigate}
                onVerificationEmailChange={onVerificationEmailChange}
                onLoginSuccess={onLoginSuccess}
              />
            </>
          )}
        </section>
      </div>
      <footer className="auth-footer">Vaultori</footer>
    </main>
  );
}
