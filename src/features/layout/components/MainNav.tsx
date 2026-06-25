import { useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { auth } from "@/config/firebase-config";
import { signOut } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";

import Button from "@/components/Button";

declare const __APP_VERSION__: string;

const MainNav = () => {
  const [firebaseUser] = useAuthState(auth);
  const isLoggedIn = !!firebaseUser;

  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const currentGroupId = location.pathname.match(/\/g\/([^/]+)/)?.[1];
  const { currentGroups, allGroups, isSuccess, isLoading } = useGetCurrentGroups();

  const pastGroups = allGroups
    .filter((group) => group.end.toDate() < new Date())
    .sort((a, b) => b.end.seconds - a.end.seconds)
    .slice(0, 3);

  const highlightedGroupId = useMemo(() => {
    if (currentGroupId) {
      return currentGroupId;
    } else if (isHome && currentGroups) {
      return currentGroups[0]?.id;
    }
    return null;
  }, [currentGroupId, currentGroups, isHome]);

  const [signOutPending, setSignOutPending] = useState(false);

  const handleSignOut = () => {
    setSignOutPending(true);
    void signOut(auth)
      .then(() => {
        console.log("sign out successful");
        setSignOutPending(false);
        void navigate("/login");
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        setSignOutPending(false);
        console.log(`${errorCode}: ${errorMessage}`);
      });
  };

  return (
    <nav className="MainNav">
      <div className="MainNav__item Menu">
        {isLoggedIn && (
          <>
            <Button className="MainNav__item--icon" to="/" title="Home" icon="home" />
            <Button className="MainNav__item--icon" to="/me" title="My Preferences" icon="user" />
            {isLoading && <div>...</div>}
            {isSuccess && (
              <div className="MainNav__list">
                <Button
                  title="New Log Group"
                  to={"/create"}
                  text="+"
                  buttonStyle="primary-border-lite"
                />
                {currentGroups.map((group) => (
                  <Button
                    key={group.id}
                    to={`/g/${group.id}`}
                    title={group.title}
                    text={group.title}
                    buttonStyle="primary-border-lite"
                    isSelected={highlightedGroupId == group?.id}
                  />
                ))}
                {pastGroups.map((group) => (
                  <Button
                    key={group.id}
                    to={`/g/${group.id}`}
                    title={group.title}
                    text={group.title}
                    buttonStyle="primary-border-lite"
                    className="Button--past"
                    isSelected={highlightedGroupId == group?.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="MainNav__item MainNav__header"></div>
      <div className="MainNev__item Menu">
        <Link to={"/about"}>
          moneylogs <small>{__APP_VERSION__}</small>
        </Link>
        <Button
          title="Sign out"
          onClick={() => handleSignOut()}
          loading={signOutPending}
          icon="exit"
        />
      </div>
    </nav>
  );
};

export default MainNav;
