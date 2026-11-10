import Button from "@/components/Button";
import { setTheme, Theme, useTheme } from "@/utils/theme";

export const THEME_LABELS: Record<Theme, string> = {
  paper: "Paper",
  night: "Night shift",
};

/** Paper or Night shift: the same two inks, swapped. Remembered on this device. */
export const DisplaySection = () => {
  const theme = useTheme();

  return (
    <>
      <div className="Segmented" role="group" aria-label="Theme">
        <Button
          text={THEME_LABELS.paper}
          icon="sun"
          buttonStyle="primary-border-lite"
          isSelected={theme === "paper"}
          onClick={() => setTheme("paper")}
        />
        <Button
          text={THEME_LABELS.night}
          icon="moon"
          buttonStyle="primary-border-lite"
          isSelected={theme === "night"}
          onClick={() => setTheme("night")}
        />
      </div>
      <p className="DisplaySection__hint">Saved on this device only.</p>
    </>
  );
};

export default DisplaySection;
