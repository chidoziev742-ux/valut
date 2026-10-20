import { ArrowRight, CircleUserRound, Pencil, Settings2 } from "lucide-react";
import { studentProfileFields } from "../data/mockProfile.js";
import "../profile-settings.css";

export default function ProfilePage({ profile }) {
  return (
    <div className="content-wrap profile-settings-wrap">
      <header className="profile-page-heading">
        <span className="profile-heading-icon" aria-hidden="true"><CircleUserRound size={23} /></span>
        <div><p className="profile-kicker">YOUR ACCOUNT</p><h1>Student profile</h1><p>Your personal and academic details, together in one place.</p></div>
      </header>

      <section id="profile-details" className="profile-settings-card profile-overview-card" aria-labelledby="profile-details-title">
        <div className="profile-card-heading">
          <div><h2 id="profile-details-title">Personal and academic details</h2><p>Read-only profile overview · sample data for this browser session.</p></div>
          <a className="profile-secondary-button" href="/profile/edit"><Pencil size={16} /> Edit Profile</a>
        </div>
        <dl className="profile-readonly-grid">
          {studentProfileFields.map(({ name, label }) => <div key={name}><dt>{label}</dt><dd>{String(profile[name] ?? "").trim() || <span className="profile-value-empty">Not added</span>}</dd></div>)}
        </dl>
      </section>

      <section className="profile-settings-entry" aria-labelledby="profile-settings-title">
        <span className="profile-settings-entry-icon" aria-hidden="true"><Settings2 size={20} /></span>
        <div className="profile-settings-entry-copy"><h2 id="profile-settings-title">Settings</h2><p>Account information, security, notification preferences and storage are managed on a separate page.</p></div>
        <a className="profile-settings-entry-link" href="/settings">Open Settings <ArrowRight size={16} /></a>
      </section>
    </div>
  );
}
