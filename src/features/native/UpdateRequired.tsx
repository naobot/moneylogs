import Button from "@/components/Button";
import "./UpdateRequired.scss";

/**
 * Full-screen stop for a native build older than the supported minimum. Shown instead
 * of the app, since an old build may misbehave against current data.
 */
const UpdateRequired = ({ storeUrl }: { storeUrl?: string }) => (
  <main className="UpdateRequired" role="alert">
    <div className="UpdateRequired__frame">
      <h1>update needed</h1>
      <p>This version of moneylogs is too old to keep using. Update it to carry on logging.</p>
      {storeUrl ? (
        <Button text="UPDATE" onClick={() => window.open(storeUrl, "_blank")} />
      ) : (
        <p>Open the app store on this device and update moneylogs from there.</p>
      )}
    </div>
  </main>
);

export default UpdateRequired;
