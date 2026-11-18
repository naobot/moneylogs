import cx from "classnames";
import { useRef, useState } from "react";
import { copyText } from "@/platform";
import { ShareContent, track } from "@/utils/analytics";

interface CopyTextAreaProps {
  value: string;
  rows?: number;
  /** What's being shared, for the `share` analytics event; omit to not count copies. */
  shareContent?: ShareContent;
}

const CopyTextArea = ({ value, rows = 1, shareContent }: CopyTextAreaProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [showCopiedMsg, setShowCopiedMsg] = useState(false);

  const handleClick = () => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();

      // Selected above, so if the clipboard refuses, the text is ready to copy by hand.
      void copyText(value);
      if (shareContent) track("share", { method: "copy", content_type: shareContent });
      setShowCopiedMsg(true);

      setTimeout(() => {
        setShowCopiedMsg(false);
      }, 1000);
    }
  };

  return (
    <div className="CopyTextArea">
      <textarea ref={textAreaRef} onClick={handleClick} value={value} rows={rows} readOnly />
      <div className={cx("CopyTextArea__block", { "CopyTextArea__block--hidden": !showCopiedMsg })}>
        Copied!
      </div>
    </div>
  );
};

export default CopyTextArea;
