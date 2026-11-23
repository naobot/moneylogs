import { PropsWithChildren, ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  NavigateProps,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase-config";
import Layout from "@/features/layout/Layout";
import GlobalErrorHandler from "@/utils/errorHandler";
import { useToastContext } from "@/hooks/useToastContext";
import { useAppVersionRefresh } from "@/hooks/useAppVersionRefresh";
import { PageViewTracker } from "@/hooks/usePageViewTracking";
import { useEnsurePersonalLedger } from "@/hooks/useEnsurePersonalLedger";
import { useDailyCheckIn } from "@/features/ledger/buddy/knickknacks/checkIn";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import KeyByParam from "@/components/KeyByParam";
import UpdateBanner from "@/components/UpdateBanner";
import NativeBridge from "@/features/native/NativeBridge";
import NavigationHold from "@/components/NavigationHold";
import UpdateRequired from "@/features/native/UpdateRequired";
import { useRequiredUpdate } from "@/features/native/useRequiredUpdate";
import { DefaultCurrencyPrompt } from "@/features/account/DefaultCurrencyPrompt";

import { Auth } from "@/pages/auth";
import { AuthAction } from "@/pages/auth/action";
import { Home } from "@/pages/home";
import { Landing } from "@/features/landing/Landing";
import { UserSettings } from "@/pages/me";
import { CreateNewLog } from "@/pages/create";
import { GroupPage } from "@/pages/group";
import { InvitePage } from "@/pages/group/invite";
import { LedgerPage, LedgerStatsPage } from "@/pages/ledger";
import { LedgerInvitePage } from "@/pages/ledger/invite";
import { Privacy } from "@/pages/privacy";
import { About } from "@/pages/about";
import { Notifications } from "@/pages/notifications";
import { Welcome } from "@/pages/welcome";
import { UserProfilePage } from "@/pages/user";
import { InviteFriendPage } from "@/pages/invite";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { isGuest } from "@/features/auth/guest";
import GuestInvite from "@/features/auth/components/GuestInvite";

import "./App.scss";

// Admin tools are only for accounts with the admin claim: kept out of the main bundle.
const AdminPage = lazy(() => import("@/pages/admin"));

export const CheckAuth = ({
  children,
  auth: requireAuth = true,
  fallback,
  guests,
  ...props
}: PropsWithChildren<
  Partial<NavigateProps> & {
    auth?: boolean;
    /** Shown to logged-out visitors instead of redirecting them to /login. */
    fallback?: ReactNode;
    /** Shown to guests instead (features/auth/guest.ts), where a real account is needed. */
    guests?: ReactNode;
  }
>) => {
  const [user, loading] = useAuthState(auth);
  const location = useLocation();

  if (loading)
    return (
      <div>
        loading
        <LoadingDots label="" />
      </div>
    );

  if (!user && requireAuth) {
    if (fallback) return <>{fallback}</>;
    return (
      <Navigate
        to={"/login"}
        replace
        // Keep the hash too, so e.g. /me#logs still opens that drawer after signing in.
        state={{ from: location.pathname + location.search + location.hash }}
        {...props}
      />
    );
  }

  if (guests && isGuest(user)) return <>{guests}</>;

  return <>{children}</>;
};

const App = () => {
  const { showToast } = useToastContext();
  const { updateAvailable, refresh } = useAppVersionRefresh();
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEnsurePersonalLedger();
  // Any signed-in visit checks in for the day: streak, luck, and the day's knick-knack rolls.
  useDailyCheckIn();
  const requiredUpdate = useRequiredUpdate();

  useEffect(() => {
    GlobalErrorHandler.getInstance().initialize(showToast);
  }, [showToast]);

  // The bridge still mounts, so the splash screen hides and the status bar matches.
  if (requiredUpdate) {
    return (
      <Router>
        <NativeBridge />
        <UpdateRequired storeUrl={requiredUpdate.storeUrl} />
      </Router>
    );
  }

  return (
    <Router>
      <NativeBridge />
      <NavigationHold />
      <PageViewTracker />
      {updateAvailable && !updateDismissed && (
        <UpdateBanner onRefresh={refresh} onDismiss={() => setUpdateDismissed(true)} />
      )}
      <DefaultCurrencyPrompt />
      <Layout>
        <ErrorBoundary>
          <OnboardingGate>
            <Routes>
              <Route path="/login" element={<Auth />} />
              <Route path="/auth/action" element={<AuthAction />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/create" element={<CreateNewLog />} />
              <Route
                path="/welcome"
                element={
                  <CheckAuth>
                    <Welcome />
                  </CheckAuth>
                }
              />
              <Route
                path="/"
                element={
                  <CheckAuth fallback={<Landing />}>
                    <Home />
                  </CheckAuth>
                }
              />
              <Route
                path="/me"
                element={
                  <CheckAuth>
                    <UserSettings />
                  </CheckAuth>
                }
              />
              <Route
                path="/u/:userDocId"
                element={
                  <CheckAuth>
                    <KeyByParam param="userDocId">
                      <UserProfilePage />
                    </KeyByParam>
                  </CheckAuth>
                }
              />
              <Route
                path="/invite/:code"
                element={
                  <CheckAuth fallback={<Landing invite="friend" />} guests={<GuestInvite />}>
                    <InviteFriendPage />
                  </CheckAuth>
                }
              />
              <Route
                path="/notifications"
                element={
                  <CheckAuth>
                    <Notifications />
                  </CheckAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <CheckAuth>
                    <Suspense
                      fallback={
                        <div className="Window">
                          loading
                          <LoadingDots label="" />
                        </div>
                      }
                    >
                      <AdminPage />
                    </Suspense>
                  </CheckAuth>
                }
              />
              <Route
                path="/g/:groupId"
                element={
                  <KeyByParam param="groupId">
                    <GroupPage />
                  </KeyByParam>
                }
              />
              <Route
                path="/g/:groupId/invite"
                element={
                  <CheckAuth fallback={<Landing invite="log" />} guests={<GuestInvite />}>
                    <KeyByParam param="groupId">
                      <InvitePage />
                    </KeyByParam>
                  </CheckAuth>
                }
              />
              <Route
                path="/l/:ledgerId"
                element={
                  <CheckAuth>
                    <KeyByParam param="ledgerId">
                      <LedgerPage />
                    </KeyByParam>
                  </CheckAuth>
                }
              />
              <Route
                path="/l/:ledgerId/stats"
                element={
                  <CheckAuth>
                    <KeyByParam param="ledgerId">
                      <LedgerStatsPage />
                    </KeyByParam>
                  </CheckAuth>
                }
              />
              <Route
                path="/l/:ledgerId/invite"
                element={
                  <CheckAuth fallback={<Landing invite="ledger" />} guests={<GuestInvite />}>
                    <KeyByParam param="ledgerId">
                      <LedgerInvitePage />
                    </KeyByParam>
                  </CheckAuth>
                }
              />
            </Routes>
          </OnboardingGate>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
};

export default App;
