import Button from "@/components/Button";
import { IconType } from "@/components/Icon";
import {
  isColourTheme,
  nextToggleTheme,
  setTheme,
  Theme,
  THEME_LABELS,
  useLastColourTheme,
  useTheme,
} from "@/utils/theme";

/** The icon for a theme: sun for Paper, moon for Night shift, star for any colour theme. */
const themeIcon = (theme: Theme): IconType =>
  theme === "paper" ? "sun" : theme === "night" ? "moon" : "star";

/**
 * Icon-only theme switch for the top bar. Shows the icon of the current theme (sun,
 * star or moon) and cycles Paper → ★ last colour theme → Night shift. The star joins
 * the cycle only once a colour theme has been picked in /me, and only when signed in.
 */
export const ThemeToggle = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const theme = useTheme();
  const lastColour = useLastColourTheme();
  const next = nextToggleTheme(theme, {
    includeStar: isLoggedIn && isColourTheme(lastColour),
    lastColour,
  });
  const action = `Switch to ${THEME_LABELS[next]}`;

  return (
    <Button
      variant="icon"
      title={action}
      aria-label={`Theme: ${THEME_LABELS[theme]}. ${action}`}
      icon={themeIcon(theme)}
      onClick={() => setTheme(next)}
    />
  );
};

export default ThemeToggle;
