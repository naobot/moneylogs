import Button from "./Button";

interface UpdateBannerProps {
  onRefresh: () => void;
  onDismiss: () => void;
}

// Slim, dismissible "a new version is available" prompt. Shown by App when
// useAppVersionRefresh detects a newer deploy on a long-idle tab.
const UpdateBanner = ({ onRefresh, onDismiss }: UpdateBannerProps) => {
  return (
    <div className="UpdateBanner" role="alert">
      <span className="UpdateBanner__text">A new version is available.</span>
      <Button text="Refresh" size="sm" buttonStyle="primary-border" onClick={onRefresh} />
      <button
        type="button"
        className="UpdateBanner__dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
};

export default UpdateBanner;
