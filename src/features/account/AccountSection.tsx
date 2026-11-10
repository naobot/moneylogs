declare const __APP_VERSION__: string;

/** Account details and credentials. Filled in by the next PR in the /me epic. */
export const AccountSection = () => (
  <p className="GroupArchive__empty">App version {__APP_VERSION__}</p>
);

export default AccountSection;
