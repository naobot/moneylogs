import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
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
import { useEnsurePersonalLedger } from "@/hooks/useEnsurePersonalLedger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import UpdateBanner from "@/components/UpdateBanner";
import { DefaultCurrencyPrompt } from "@/features/account/DefaultCurrencyPrompt";

import { Auth } from "@/pages/auth";
import { Home } from "@/pages/home";
import { Landing } from "@/features/landing/Landing";
import { UserSettings } from "@/pages/me";
import { CreateNewLog } from "@/pages/create";
import { GroupPage } from "@/pages/group";
import { InvitePage } from "@/pages/group/invite";
import { LedgerPage, LedgerStatsPage } from "@/pages/ledger";
import { LedgerInvitePage } from "@/pages/ledger/invite";
import { About } from "@/pages/about";
import { Notifications } from "@/pages/notifications";

import "./App.scss";

export const CheckAuth = ({
  children,
  auth: requireAuth = true,
  fallback,
  ...props
}: PropsWithChildren<
  Partial<NavigateProps> & {
    auth?: boolean;
    /** Shown to logged-out visitors instead of redirecting them to /login. */
    fallback?: ReactNode;
  }
>) => {
  const [user, loading] = useAuthState(auth);
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

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

  return <>{children}</>;
};

const App = () => {
  const { showToast } = useToastContext();
  const { updateAvailable, refresh } = useAppVersionRefresh();
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEnsurePersonalLedger();

  useEffect(() => {
    GlobalErrorHandler.getInstance().initialize(showToast);
  }, [showToast]);

  return (
    <Router>
      {updateAvailable && !updateDismissed && (
        <UpdateBanner onRefresh={refresh} onDismiss={() => setUpdateDismissed(true)} />
      )}
      <DefaultCurrencyPrompt />
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/about" element={<About />} />
            <Route path="/create" element={<CreateNewLog />} />
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
              path="/notifications"
              element={
                <CheckAuth>
                  <Notifications />
                </CheckAuth>
              }
            />
            <Route path="/g/:groupId" element={<GroupPage />} />
            <Route
              path="/g/:groupId/invite"
              element={
                <CheckAuth>
                  <InvitePage />
                </CheckAuth>
              }
            />
            <Route
              path="/l/:ledgerId"
              element={
                <CheckAuth>
                  <LedgerPage />
                </CheckAuth>
              }
            />
            <Route
              path="/l/:ledgerId/stats"
              element={
                <CheckAuth>
                  <LedgerStatsPage />
                </CheckAuth>
              }
            />
            <Route
              path="/l/:ledgerId/invite"
              element={
                <CheckAuth>
                  <LedgerInvitePage />
                </CheckAuth>
              }
            />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
};

export default App;
