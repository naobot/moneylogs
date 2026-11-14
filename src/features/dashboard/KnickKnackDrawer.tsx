import { Link } from "react-router-dom";

import HelpTip from "@/components/HelpTip";
import Icon from "@/components/Icon";
import { useCurrentUser } from "@/contexts";
import { Ledger } from "@/types/ledger";
import { KNICK_KNACKS } from "@/features/ledger/buddy/knickknacks/catalog";
import { drawerContents } from "@/features/ledger/buddy/knickknacks/drawer";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { useKnickKnackFinds } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";

import "./Dashboard.scss";

export const KNICK_KNACK_HELP =
  "budget buddies in financial logs sometimes find random things throughout the day. rumour has it that better spending habits increase your luck.";

/**
 * Everything the budget buddies have found for you, on the dashboard. Always there,
 * even empty. Finds the buddy hasn't shown you yet stay wrapped: the drawer only
 * points to the log whose buddy has them.
 */
export const KnickKnackDrawer = ({ ledgers = [] }: { ledgers?: ReadonlyArray<Ledger> }) => {
  const { user } = useCurrentUser();
  const { data, isLoading } = useKnickKnackFinds(user?.id);
  const { kept, waiting } = drawerContents(data);
  const titleOf = (id: string) => ledgers.find((l) => l.id === id)?.title;

  return (
    <section className="Dashboard__section KnickKnackDrawer" aria-labelledby="dashboard-drawer">
      <div className="KnickKnackDrawer__heading">
        <h3 id="dashboard-drawer">knick-knack drawer</h3>
        <HelpTip label="What's the knick-knack drawer?">{KNICK_KNACK_HELP}</HelpTip>
      </div>
      <div className="KnickKnackDrawer__box">
        {waiting.map(({ ledgerId, count }) => {
          const title = titleOf(ledgerId);
          return (
            <Link key={ledgerId} to={`/l/${ledgerId}`} className="KnickKnackDrawer__waiting">
              <Icon type="warning" size={14} />
              <span className="keep-case">
                the budget buddy{title ? ` in ${title}` : ""} has{" "}
                {count > 1 ? `${count} things` : "something"} to show you
              </span>
            </Link>
          );
        })}
        {kept.length > 0 ? (
          <ul className="KnickKnackDrawer__items">
            {kept.map(({ item, count }) => (
              <li key={item} className="KnickKnackDrawer__item">
                <KnickKnack id={item} size={64} />
                <span className="KnickKnackDrawer__name">
                  {KNICK_KNACKS[item].name}
                  {count > 1 && <span className="KnickKnackDrawer__count"> ×{count}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          !isLoading && (
            <p className="KnickKnackDrawer__empty">
              nothing in here yet. the budget buddies are keeping an eye out~
            </p>
          )
        )}
      </div>
    </section>
  );
};

export default KnickKnackDrawer;
