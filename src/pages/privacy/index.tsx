import { Link } from "react-router-dom";
import { EXTERNAL_LINKS } from "@/config/links";

/**
 * Privacy policy, linked from /about, the footer and the app-store listings. Keep it in
 * step with what the app actually stores and sends (see docs/mobile.md before a release).
 */
export const Privacy = () => (
  <div className="AboutPage PrivacyPage">
    <h2>privacy</h2>
    <p>
      <small>Last updated November 14, 2026.</small>
    </p>

    <p>
      moneylogs is a small, independent project. It keeps only what it needs to run your logs, never
      sells your data, and shows no ads.
    </p>

    <h3>what you give it</h3>
    <ul>
      <li>
        <strong>Account:</strong> your email address and password (handled by Firebase
        Authentication; moneylogs never sees the password).
      </li>
      <li>
        <strong>Profile:</strong> the display name, location text, timezone and default currency you
        choose.
      </li>
      <li>
        <strong>What you log:</strong> posts, amounts, comments, reactions, photos you attach, and
        financial log entries, budgets and categories. Other members of a log can see what you post
        in it; anyone with a log group's link can read it.
      </li>
      <li>
        <strong>Push notifications (apps only):</strong> if you turn them on, a device token so
        notifications can reach your phone. Turning them off or signing out removes it.
      </li>
    </ul>

    <h3>what it collects to keep running</h3>
    <ul>
      <li>
        <strong>Errors:</strong> crash and error reports go to Sentry, tagged with your account id
        (not your name or email). On the website, a sample of sessions is also recorded as a replay
        to diagnose bugs, with text and images masked. The apps don't record replays.
      </li>
      <li>
        <strong>Usage (website only):</strong> Google Analytics for Firebase counts page views and a
        few actions, such as reading a log, to see which features are used.
      </li>
      <li>
        <strong>On your device:</strong> display preferences, drafts and short-lived caches are kept
        in your browser or app storage and never leave it.
      </li>
    </ul>

    <h3>where it lives</h3>
    <p>
      Everything is stored with Google Firebase (Authentication, Firestore, Cloud Storage, Cloud
      Functions, Cloud Messaging). Errors are processed by Sentry. Neither may use it for anything
      else.
    </p>

    <h3>deleting it</h3>
    <p>
      You can delete your account at any time from <Link to="/me">your settings</Link> (Account →
      delete account). Logs only you belong to are deleted; in shared logs, your posts stay for the
      other members but are shown as from a deleted user. Error reports expire on Sentry's normal
      schedule.
    </p>

    <h3>questions</h3>
    <p>
      Get in touch through{" "}
      <a href={EXTERNAL_LINKS.website} target="_blank" rel="noopener noreferrer">
        nnao.world
      </a>
      .
    </p>
  </div>
);

export default Privacy;
