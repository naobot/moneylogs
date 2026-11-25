import Button from "@/components/Button";
import { setTheme } from "@/utils/theme";
import { themeIcon, useThemeToggle } from "./useThemeToggle";

/**
 * Icon-only theme switch for the top bar. Shows the icon of the current theme (sun,
 * star or moon) and cycles Paper → ★ last colour theme → Night shift. The star joins
 * the cycle only once a colour theme has been picked in /me, and only when signed in.
 */
export const ThemeToggle = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { theme, next, action, label } = useThemeToggle(isLoggedIn);

  return (
    <Button
      variant="icon"
      title={action}
      aria-label={label}
      icon={themeIcon(theme)}
      onClick={() => setTheme(next)}
    />
  );
};

export default ThemeToggle;
