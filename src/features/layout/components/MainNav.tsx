import { useLocation, Link } from "react-router-dom";
import { auth } from "@/config/firebase-config";
import { useAuthState } from "react-firebase-hooks/auth";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { useCurrentUser } from "@/contexts";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { arrangeDashboard } from "@/utils/dashboard";

import Button from "@/components/Button";
import ThemeToggle from "./ThemeToggle";

declare const __APP_VERSION__: string;

const MainNav = () => {
  const [firebaseUser] = useAuthState(auth);
  const isLoggedIn = !!firebaseUser;

  const location = useLocation();
  const currentGroupId = location.pathname.match(/\/[gl]\/([^/]+)/)?.[1];
  const { user } = useCurrentUser();
  const groupsQuery = useGetCurrentGroups();
  const { isSuccess, isLoading } = groupsQuery;
  const ledgersQuery = useGetMyLedgers();

  // Same arrangement as the Home dashboard, so the nav and Home always agree: archived
  // logs left out, ongoing groups ending soonest first, financial logs, and the few most
  // recently ended groups.
  const { now, recent: pastGroups } = arrangeDashboard({
    groups: groupsQuery.allGroups,
    ledgers: ledgersQuery.ledgers,
    user,
  });
  const ledgers = now.flatMap((item) => (item.kind === "financial" ? [item.ledger] : []));
  const currentGroups = now.flatMap((item) => (item.kind === "social" ? [item.group] : []));

  // Home is a list of logs now, so only highlight the log actually being viewed.
  const highlightedGroupId = currentGroupId ?? null;

  const { signOut, isPending: signOutPending } = useSignOut();

  return (
    <nav className="MainNav">
      <div className="MainNav__item Menu">
        {!isLoggedIn && location.pathname !== "/login" && (
          <Button to="/login" text="Sign in" buttonStyle="primary-border-lite" />
        )}
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
        {/* Theme toggle and sign-out read as one pair of icons, set close together. */}
        <span className="MainNav__iconPair">
          <ThemeToggle />
          {isLoggedIn && (
            <Button title="Sign out" onClick={signOut} loading={signOutPending} icon="exit" />
          )}
        </span>
      </div>
    </nav>
  );
};

export default MainNav;
