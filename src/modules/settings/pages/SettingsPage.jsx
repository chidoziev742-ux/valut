import { Bell, ChevronRight, CircleUserRound, HardDrive, LockKeyhole, Settings2, ShieldCheck } from "lucide-react";
import "../../../profile-settings.css";

function PreferenceToggle({ id, label, description, checked, onChange }) {
  return (
    <label className="preference-toggle" htmlFor={id}>
      <span className="preference-copy"><strong>{label}</strong><small>{description}</small></span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}

export default function SettingsPage({ profile, preferences, onPreferencesChange, documents, onNavigate }) {
  const attached = documents.filter((document) => Boolean(document.attachment));
  const actualBytes = attached.reduce((total, document) => total + (Number(document.attachment?.size) || 0), 0);
  const archivedCount = documents.filter((document) => Boolean(document.archived)).length;
  const formatBytes = (bytes) => bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="content-wrap profile-settings-wrap settings-page">
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><Settings2 size={23} /></span>
        <div><p className="profile-kicker">PREFERENCES</p><h1>Settings</h1><p>Manage your account details and Student Vault preferences.</p></div>
      </header>
      <div className="settings-sections">
        <section id="account-info" className="profile-settings-card settings-card" aria-labelledby="account-settings-title">
          <div className="settings-section-icon"><CircleUserRound size={19} /></div>
          <div className="settings-section-content">
            <div className="profile-card-heading"><div><h2 id="account-settings-title">Account information</h2><p>Read-only summary · sample profile for this session.</p></div><a className="settings-link-button" href="/profile">View Profile <ChevronRight size={16} /></a></div>
            <dl className="account-summary"><div><dt>Name</dt><dd>{profile.fullName || "Not added"}</dd></div><div><dt>Email</dt><dd>{profile.email || "Not added"}</dd></div><div><dt>University</dt><dd>{profile.university || "Not added"}</dd></div></dl>
          </div>
        </section>

        <section id="notifications" className="profile-settings-card settings-card" aria-labelledby="notifications-title">
          <div className="settings-section-icon"><Bell size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="notifications-title">Notification preferences</h2><p>Choose which prototype updates you would want to see.</p></div></div>
            <div className="preference-list">
              <PreferenceToggle id="pref-documents" label="Document updates" description="Prototype notices about document activity." checked={preferences.documentUpdates} onChange={(event) => onPreferencesChange((current) => ({ ...current, documentUpdates: event.target.checked }))} />
              <PreferenceToggle id="pref-account" label="Account updates" description="Prototype notices about your profile and account." checked={preferences.accountUpdates} onChange={(event) => onPreferencesChange((current) => ({ ...current, accountUpdates: event.target.checked }))} />
            </div>
            <p className="settings-prototype-note"><ShieldCheck size={15} /> Preferences are held in memory during this session. No notifications are sent.</p>
          </div>
        </section>

        <section id="security" className="profile-settings-card settings-card" aria-labelledby="security-title">
          <div className="settings-section-icon"><LockKeyhole size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="security-title">Security</h2><p>Password changes will be available when account security is connected to the backend.</p></div></div>
            <div className="security-action-row"><span className="security-action-copy"><strong>Password management</strong><small>No password is changed in this frontend prototype.</small></span><button className="profile-secondary-button" type="button" onClick={() => onNavigate("/change-password")}>Change password <ChevronRight size={16} /></button></div>
          </div>
        </section>

        <section id="storage" className="profile-settings-card settings-card" aria-labelledby="storage-title">
          <div className="settings-section-icon"><HardDrive size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="storage-title">Storage overview</h2><p>Files attached in this browser session only; sample records do not count as uploaded storage.</p></div></div>
            <dl className="storage-stat-grid"><div><dt>Total document records</dt><dd>{documents.length}</dd></div><div><dt>Actual selected files</dt><dd>{attached.length}</dd></div><div><dt>Sample records</dt><dd>{documents.length - attached.length}</dd></div><div><dt>Attached file size</dt><dd>{attached.length ? formatBytes(actualBytes) : "0 KB"}</dd></div><div><dt>Archived records</dt><dd>{archivedCount}</dd></div></dl>
            <p className="settings-prototype-note"><HardDrive size={15} /> No cloud quota, capacity, or persistent usage is represented.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
