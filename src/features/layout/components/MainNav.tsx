import { useLocation, Link } from "react-router-dom";
import { LoadingDots } from "@/components/LoadingDots";
import { auth } from "@/config/firebase-config";
import { useAuthState } from "react-firebase-hooks/auth";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { useCurrentUser } from "@/contexts";
import { arrangeDashboard, navLedgers } from "@/utils/dashboard";

import Button from "@/components/Button";
import ThemeToggle from "./ThemeToggle";
import NavMenu from "./NavMenu";
import { showNavWordmark } from "../navWordmark";
import { inviteSignInState } from "@/features/auth/authRedirect";
import { NotificationBell } from "@/features/notifications/NotificationBell";

declare const __APP_VERSION__: string;

const MainNav = () => {
  // Until Firebase has restored the session, we don't know yet whether anyone is signed
  // in: show neither "Sign in" nor the signed-in icons, so a returning user doesn't see
  // "Sign in" flash up on every load.
  const [firebaseUser, authPending] = useAuthState(auth);
  const isLoggedIn = !!firebaseUser;

  const location = useLocation();
  const currentGroupId = location.pathname.match(/\/[gl]\/([^/]+)/)?.[1];
  const { user, isLoading: userLoading } = useCurrentUser();
  const groupsQuery = useGetCurrentGroups();
  const { isSuccess } = groupsQuery;
  // Archived logs are on the user doc: until it's in, they'd be listed as current.
  const isLoading = groupsQuery.isLoading || userLoading;
  const ledgersQuery = useGetMyLedgers();

  // Same arrangement as the Home dashboard, so the nav and Home always agree: archived
  // logs left out, ongoing groups ending soonest first, then financial logs. Past groups
  // stay on Home and /me — the nav only lists what's ongoing, to keep the header short.
  // Sublogs follow their parent, as smaller buttons.
  const { now } = arrangeDashboard({
    groups: groupsQuery.allGroups,
    ledgers: ledgersQuery.ledgers,
    user,
  });
  const ledgers = navLedgers(now);
  const currentGroups = now.flatMap((item) => (item.kind === "social" ? [item.group] : []));

  // Home is a list of logs now, so only highlight the log actually being viewed.
  const highlightedGroupId = currentGroupId ?? null;

  const showLogs = isLoggedIn && (ledgers.length > 0 || isLoading || currentGroups.length > 0);
  const showWordmark = showNavWordmark(isLoggedIn, location.pathname);

  // Three parts. On desktop they sit in one row (nav, logs, brand). On phones the brand
  // and nav share the top row, and the logs get a scrollable row of their own beneath.
  // New logs start from Home or /me, so the header has no "+".
  return (
    <nav className="MainNav">
      <div className="MainNav__nav">
        {!authPending && !isLoggedIn && location.pathname !== "/login" && (
          <Button
            to="/login"
            // On an invite page, sign-in carries the invite along (like the page's own
            // buttons), so nobody ends up on Home, or offered guest mode, instead.
            state={inviteSignInState(location.pathname, location.search)}
            text="Sign in"
            variant="secondary"
          />
        )}
        {isLoggedIn && (
          <>
            <Button
              variant="icon"
              className="MainNav__item--icon"
              to="/"
              title="Home"
              icon="home"
            />
            <Button
              variant="icon"
              className="MainNav__item--icon"
              to="/me"
              title="My Preferences"
              icon="user"
            />
            <NotificationBell />
          </>
        )}
      </div>
      {showLogs && (
        <div className="MainNav__logs">
          {/* Financial logs never end, so they're always listed — independently of
              whether the social groups query has loaded. */}
          {!userLoading &&
            ledgers.map(({ ledger, sublog }) =>
              sublog ? (
                <Button
                  key={ledger.id}
                  to={`/l/${ledger.id}`}
                  title={`${ledger.title} (a sublog)`}
                  text={`↳ ${ledger.title}`}
                  variant="toggle"
                  className="MainNav__log MainNav__log--sublog"
                  isSelected={highlightedGroupId == ledger.id}
                />
              ) : (
                <Button
                  key={ledger.id}
                  to={`/l/${ledger.id}`}
                  title={ledger.title}
                  text={ledger.title}
                  icon="dollar"
                  variant="toggle"
                  className="MainNav__log"
                  isSelected={highlightedGroupId == ledger.id}
                />
              ),
            )}
          {isLoading && (
            <div>
              <LoadingDots />
            </div>
          )}
          {isSuccess &&
            !userLoading &&
            currentGroups.map((group) => (
              <Button
                key={group.id}
                to={`/g/${group.id}`}
                title={group.title}
                text={group.title}
                icon="social"
                variant="toggle"
                className="MainNav__log"
                isSelected={highlightedGroupId == group?.id}
              />
            ))}
        </div>
      )}
      <div className="MainNav__brand">
        {showWordmark && (
          <Link to={"/about"} className="MainNav__wordmark">
            moneylogs <small>{__APP_VERSION__}</small>
          </Link>
        )}
        {/* The theme toggle and the menu (display settings, sign out) read as one pair
            of icons, set close together. On phones the theme toggle is left to the menu's
            display settings; the menu stays, far right. It waits for auth, so sign out
            doesn't pop into it a moment later. */}
        <span className="MainNav__iconPair">
          <ThemeToggle isLoggedIn={isLoggedIn} />
          {!authPending && <NavMenu isLoggedIn={isLoggedIn} />}
        </span>
      </div>
    </nav>
  );
};

export default MainNav;
