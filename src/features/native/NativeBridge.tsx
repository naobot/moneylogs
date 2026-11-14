import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { auth } from "@/config/firebase-config";
import { isNative, nativePlatform } from "@/platform";
import { useTheme } from "@/utils/theme";
import { backButtonAction } from "./backButton";
import { deepLinkPath } from "./deepLink";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { useCurrentUser } from "@/contexts";
import { pushTapPath, refreshPushToken } from "@/features/push/devicePush";

/**
 * Wires the native shell to the app: Android's back button, links opened from outside,
 * push tokens and taps, the status bar's ink, and the splash screen. Renders nothing, and does nothing in a browser. Mount inside the
 * router.
 */
const NativeBridge = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const { user } = useCurrentUser();
  const userDocId = user?.id;

  // The listener is registered once; it reads the current path from a ref.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (nativePlatform() !== "android") return;
    const listener = CapApp.addListener("backButton", ({ canGoBack }) => {
      const action = backButtonAction(pathnameRef.current, canGoBack);
      if (action === "back") void navigate(-1);
      else if (action === "home") void navigate("/", { replace: true });
      else void CapApp.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  // Universal links (iOS) and app links (Android) for moneylogs.app open here, on the
  // same route the web would show, so invites and CheckAuth's redirect work unchanged.
  useEffect(() => {
    if (!isNative()) return;
    const listener = CapApp.addListener("appUrlOpen", ({ url }) => {
      const path = deepLinkPath(url);
      if (path) void navigate(path);
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  // Push: tokens rotate, so re-save the current one for whoever is signed in. Does
  // nothing unless push was turned on on this device.
  useEffect(() => {
    if (!isNative() || !userDocId) return;
    void refreshPushToken(userDocId).catch(() => undefined);
    const listener = FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
      void refreshPushToken(userDocId, token).catch(() => undefined);
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [userDocId]);

  // A tapped push opens the inbox at that notification, which follows its link.
  useEffect(() => {
    if (!isNative()) return;
    const listener = FirebaseMessaging.addListener(
      "notificationActionPerformed",
      ({ notification }) => {
        const path = pushTapPath(notification.data);
        if (path) void navigate(path);
      },
    );
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  // Style.Dark is light text for a dark page (Night shift); Style.Light the reverse.
  useEffect(() => {
    if (!isNative()) return;
    void StatusBar.setStyle({ style: theme === "night" ? Style.Dark : Style.Light }).catch(
      () => undefined,
    );
  }, [theme]);

  // Keep the splash up until Firebase knows who is signed in, so a signed-in person
  // never sees the login page flash first.
  useEffect(() => {
    if (!isNative()) return;
    void auth
      .authStateReady()
      .catch(() => undefined)
      .then(() => SplashScreen.hide());
  }, []);

  return null;
};

export default NativeBridge;
