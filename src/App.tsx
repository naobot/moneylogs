import { PropsWithChildren, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, NavigateProps, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase-config";
import Layout from "@/features/layout/Layout";
import GlobalErrorHandler from "@/utils/errorHandler";
import { useToastContext } from "@/hooks/useToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { Auth } from "@/pages/auth";
import { Home } from "@/pages/home";
import { UserSettings } from "@/pages/me";
import { CreateNewLog } from "@/pages/create";
import { GroupPage } from "@/pages/group";
import { InvitePage } from "@/pages/group/invite";
import { About } from "@/pages/about";

import "./App.scss";

export const CheckAuth = ({
  children,
  auth: requireAuth = true,
  ...props
}: PropsWithChildren<
  Partial<NavigateProps> & {
    auth?: boolean;
  }
>) => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div>Loading...</div>;

  if (!user && requireAuth) {
    return <Navigate to={"/login"} replace {...props} />;
  }

  return <>{children}</>;
};

const App = () => {
  const { showToast } = useToastContext();

  useEffect(() => {
    GlobalErrorHandler.getInstance().initialize(showToast);
  }, [showToast]);

  return (
    <Router>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/about" element={<About />} />
            <Route path="/create" element={<CreateNewLog />} />
            <Route
              path="/"
              element={
                <CheckAuth>
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
            <Route path="/g/:groupId" element={<GroupPage />} />
            <Route
              path="/g/:groupId/invite"
              element={
                <CheckAuth>
                  <InvitePage />
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
