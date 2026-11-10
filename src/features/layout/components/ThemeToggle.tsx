import Button from "@/components/Button";
import { setTheme, useTheme } from "@/utils/theme";

/**
 * Icon-only Paper / Night shift switch for the top bar. Shows the icon of the theme it
 * switches to (moon in Paper, sun in Night shift), and names that action in its title.
 */
export const ThemeToggle = () => {
  const theme = useTheme();
  const isNight = theme === "night";

  return (
    <Button
      title={isNight ? "Switch to Paper" : "Switch to Night shift"}
      icon={isNight ? "sun" : "moon"}
      onClick={() => setTheme(isNight ? "paper" : "night")}
    />
  );
};

export default ThemeToggle;
