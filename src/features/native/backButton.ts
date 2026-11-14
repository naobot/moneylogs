/** Screens the Android back button leaves the app from, like a launcher's home screen. */
const ROOT_PATHS = new Set(["/", "/login", "/welcome"]);

export type BackAction = "back" | "home" | "exit";

/**
 * What Android's back button does on `pathname`. Go back through history while there is
 * some. A deep link or notification can open the app with no history, and then back
 * goes to the dashboard rather than straight out of the app.
 */
export const backButtonAction = (pathname: string, canGoBack: boolean): BackAction => {
  if (ROOT_PATHS.has(pathname)) return "exit";
  return canGoBack ? "back" : "home";
};
