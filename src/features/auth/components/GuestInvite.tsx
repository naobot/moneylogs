import SaveGuestAccount from "./SaveGuestAccount";

/**
 * What a guest sees at an invite link instead of joining: accepting needs a real account
 * (anything a guest joined would vanish with them). Saving reloads this same page, so the
 * invite carries on as for anyone.
 */
export const GuestInvite = () => (
  <div className="Window GuestInvite">
    <h2>save your account to accept</h2>
    <p>
      You're trying moneylogs as a guest. Save your account with an email and password to accept
      this invite. Everything you've logged so far stays.
    </p>
    <SaveGuestAccount />
  </div>
);

export default GuestInvite;
