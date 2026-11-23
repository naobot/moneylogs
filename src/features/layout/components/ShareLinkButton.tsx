import { useState } from "react";

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
  // While the sheet is open: a second tap would be refused as "unavailable".
  const [sharing, setSharing] = useState(false);
  if (!canShare()) return null;

  const share = async () => {
    setSharing(true);
    try {
      if ((await shareLink({ title, url })) === "unavailable") {
        showToast("Couldn't open sharing here. Copy the link instead.", "error");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Button
      className="ShareLinkButton"
      text="SHARE"
      size="sm"
      variant="secondary"
      disabled={sharing}
      onClick={() => void share()}
    />
  );
};

export default ShareLinkButton;
