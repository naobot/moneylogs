import { MouseEvent } from "react";

type Props = {
  text: string;
  onDismiss: () => void;
  position?: "top" | "bottom";
};

const TutorialTooltip = ({ text, onDismiss, position = "bottom" }: Props) => {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <div
      className={`TutorialTooltip TutorialTooltip--${position}`}
      onClick={handleClick}
      role="tooltip"
    >
      <span>{text}</span>
      <small>tap to dismiss</small>
    </div>
  );
};

export default TutorialTooltip;
