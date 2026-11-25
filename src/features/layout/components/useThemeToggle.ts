import { IconType } from "@/components/Icon";
import {
  isColourTheme,
  nextToggleTheme,
  Theme,
  THEME_LABELS,
  useLastColourTheme,
  useTheme,
} from "@/utils/theme";

/** The icon for a theme: sun for Paper, moon for Night shift, star for any colour theme. */
export const themeIcon = (theme: Theme): IconType =>
  theme === "paper" ? "sun" : theme === "night" ? "moon" : "star";

/**
 * The theme toggle's cycle: Paper → ★ last colour theme → Night shift, the star only once
 * a colour theme has been picked in /me, and only when signed in. Shared by the nav's
 * ThemeToggle (wide screens) and the nav menu's theme item (phones).
 */
export const useThemeToggle = (isLoggedIn: boolean) => {
  const theme = useTheme();
  const lastColour = useLastColourTheme();
  const next = nextToggleTheme(theme, {
    includeStar: isLoggedIn && isColourTheme(lastColour),
    lastColour,
  });
  const action = `Switch to ${THEME_LABELS[next]}`;
  return { theme, next, action, label: `Theme: ${THEME_LABELS[theme]}. ${action}` };
};
