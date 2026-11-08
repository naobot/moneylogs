import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { auth } from "@/config/firebase-config";
import { signOut } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { absoluteEnd, byMostRecentlyEnded } from "@/utils/groupBoundaries";

import Button from "@/components/Button";

declare const __APP_VERSION__: string;

const MainNav = () => {
  const [firebaseUser] = useAuthState(auth);
  const isLoggedIn = !!firebaseUser;

  const navigate = useNavigate();
  const location = useLocation();
  const currentGroupId = location.pathname.match(/\/[gl]\/([^/]+)/)?.[1];
  const { currentGroups, allGroups, isSuccess, isLoading } = useGetCurrentGroups();
  const { ledgers } = useGetMyLedgers();

  const pastGroups = allGroups
    .filter((group) => absoluteEnd(group).isBefore(new Date()))
    .sort(byMostRecentlyEnded)
    .slice(0, 3);

  // Home is a list of logs now, so only highlight the log actually being viewed.
  const highlightedGroupId = currentGroupId ?? null;

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
            <div className="MainNav__list">
              <Button title="New Log" to={"/create"} text="+" buttonStyle="primary-border-lite" />
              {/* Financial logs never end, so they're always listed — independently of
                  whether the social groups query has loaded. */}
              {ledgers.map((ledger) => (
                <Button
                  key={ledger.id}
                  to={`/l/${ledger.id}`}
                  title={ledger.title}
                  text={`$ ${ledger.title}`}
                  buttonStyle="primary-border-lite"
                  isSelected={highlightedGroupId == ledger.id}
                />
              ))}
              {isLoading && <div>...</div>}
              {isSuccess &&
                currentGroups.map((group) => (
                  <Button
                    key={group.id}
                    to={`/g/${group.id}`}
                    title={group.title}
                    text={group.title}
                    buttonStyle="primary-border-lite"
                    isSelected={highlightedGroupId == group?.id}
                  />
                ))}
              {isSuccess &&
                pastGroups.map((group) => (
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
