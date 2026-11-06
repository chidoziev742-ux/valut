import { Bell, ChevronRight, CircleUserRound, HardDrive, LockKeyhole, Settings2 } from "lucide-react";
import { formatStorageBytes, getStorageCategoryWidths } from "../storageUsage.js";
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

export default function SettingsPage({
  profile,
  preferences,
  onPreferencesChange,
  storageSummary,
  storageLoading = false,
  storageError = "",
  onRetryStorage,
  onNavigate,
}) {
  const categoryUsage = getStorageCategoryWidths(
    storageSummary?.storageByCategory,
    storageSummary?.totalStorageBytes ?? 0,
  );
  return (
    <div className="content-wrap profile-settings-wrap settings-page">
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><Settings2 size={23} /></span>
        <div><p className="profile-kicker">PREFERENCES</p><h1>Settings</h1><p>Manage your account details and Vaultori preferences.</p></div>
      </header>
      <div className="settings-sections">
        <section id="account-info" className="profile-settings-card settings-card" aria-labelledby="account-settings-title">
          <div className="settings-section-icon"><CircleUserRound size={19} /></div>
          <div className="settings-section-content">
            <div className="profile-card-heading"><div><h2 id="account-settings-title">Account information</h2><p>Account details.</p></div><a className="settings-link-button" href="/profile">View Profile <ChevronRight size={16} /></a></div>
            <dl className="account-summary"><div><dt>Name</dt><dd>{profile.fullName || "Not added"}</dd></div><div><dt>Email</dt><dd>{profile.email || "Not added"}</dd></div><div><dt>University</dt><dd>{profile.university || "Not added"}</dd></div></dl>
          </div>
        </section>

        <section id="notifications" className="profile-settings-card settings-card" aria-labelledby="notifications-title">
          <div className="settings-section-icon"><Bell size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="notifications-title">Notification preferences</h2><p>Choose which updates you would like to receive.</p></div></div>
            <div className="preference-list">
              <PreferenceToggle id="pref-documents" label="Document updates" description="Updates about document activity." checked={preferences.documentUpdates} onChange={(event) => onPreferencesChange((current) => ({ ...current, documentUpdates: event.target.checked }))} />
              <PreferenceToggle id="pref-account" label="Account updates" description="Updates about your profile and account." checked={preferences.accountUpdates} onChange={(event) => onPreferencesChange((current) => ({ ...current, accountUpdates: event.target.checked }))} />
            </div>
          </div>
        </section>

        <section id="security" className="profile-settings-card settings-card" aria-labelledby="security-title">
          <div className="settings-section-icon"><LockKeyhole size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="security-title">Security</h2><p>Manage your password and sign-in security.</p></div></div>
            <div className="security-action-row"><span className="security-action-copy"><strong>Password management</strong><small>Update your account password.</small></span><button className="profile-secondary-button" type="button" onClick={() => onNavigate("/change-password")}>Change password <ChevronRight size={16} /></button></div>
          </div>
        </section>

        <section id="storage" className="profile-settings-card settings-card" aria-labelledby="storage-title">
          <div className="settings-section-icon"><HardDrive size={19} /></div>
          <div className="settings-section-content"><div className="profile-card-heading"><div><h2 id="storage-title">Storage overview</h2><p>Review your document storage.</p></div></div>
            {storageLoading ? (
              <p className="storage-state" role="status">Loading storage usage…</p>
            ) : storageError ? (
              <div className="storage-state storage-state-error" role="alert">
                <span>{storageError}</span>
                <button className="profile-secondary-button" type="button" onClick={onRetryStorage}>Try again</button>
              </div>
            ) : storageSummary ? (
              <>
                <div className="storage-overview">
                  <div className="storage-used-card">
                    <span className="storage-used-label">Storage used</span>
                    <strong>{formatStorageBytes(storageSummary.totalStorageBytes)}</strong>
                    <span className="storage-quota">Total available quota <b>Not configured</b></span>
                  </div>
                  <div className="storage-count-card">
                    <HardDrive size={18} aria-hidden="true" />
                    <span><strong>{storageSummary.storedDocumentCount}</strong><small>stored {storageSummary.storedDocumentCount === 1 ? "document" : "documents"}</small></span>
                  </div>
                </div>
                {storageSummary.storedDocumentCount === 0 ? (
                  <div className="storage-empty-state">
                    <p>No documents are stored yet.</p>
                    <button className="settings-link-button" type="button" onClick={() => onNavigate("/documents")}>Go to documents <ChevronRight size={16} /></button>
                  </div>
                ) : (
                  <div className="storage-breakdown" aria-label="Storage usage by category">
                    <div className="storage-breakdown-heading"><h3>Usage by category</h3><span>Includes archived documents</span></div>
                    {categoryUsage.map((item, index) => (
                      <div className="storage-category-row" key={item.category}>
                        <div className="storage-category-meta">
                          <strong>{item.category}</strong>
                          <span>{formatStorageBytes(item.storageBytes)} · {item.count} {item.count === 1 ? "document" : "documents"}</span>
                        </div>
                        <div className="storage-category-track" role="img" aria-label={`${item.category}: ${formatStorageBytes(item.storageBytes)} across ${item.count} documents`}>
                          <span className={`storage-category-fill storage-category-tone-${index % 4}`} style={{ width: `${item.width}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="storage-state" role="status">Storage usage is not available yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
