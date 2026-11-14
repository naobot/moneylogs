import Button from "@/components/Button";
import { useToastContext } from "@/hooks/useToastContext";
import { canShare, shareLink } from "@/platform";

import "./ShareLinkButton.scss";

/**
 * Opens the system share sheet for an invite link. Renders nothing where there's no
 * share sheet (most desktop browsers); the CopyTextArea beside it still works there.
 */
const ShareLinkButton = ({ title, url }: { title: string; url: string }) => {
  const { showToast } = useToastContext();
  if (!canShare()) return null;

  const share = async () => {
    if ((await shareLink({ title, url })) === "unavailable") {
      showToast("Couldn't open sharing here. Copy the link instead.", "error");
    }
  };

  return (
    <Button
      className="ShareLinkButton"
      text="SHARE"
      size="sm"
      buttonStyle="primary-border"
      onClick={() => void share()}
    />
  );
};

export default ShareLinkButton;
