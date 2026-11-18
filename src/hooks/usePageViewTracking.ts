import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase-config";
import { trackPageView } from "@/utils/analytics";

/**
 * One page view per route change (pathname only: query and hash changes, like opening
 * a post link or a /me drawer, aren't new pages). Waits for auth to settle so the
 * first view knows whether the visitor is signed in. Must render inside the Router.
 */
export const usePageViewTracking = () => {
  const { pathname } = useLocation();
  const [, loading] = useAuthState(auth);

  // Read the user here rather than depending on it: signing in or out alone isn't a
  // new page view (the redirect that follows is). Once loading is done it's settled.
  useEffect(() => {
    if (loading) return;
    trackPageView(pathname, !!auth.currentUser);
  }, [pathname, loading]);
};

/** Renders nothing; mounts the page view tracking inside the Router. */
export const PageViewTracker = () => {
  usePageViewTracking();
  return null;
};
