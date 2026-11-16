import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import HelpTip from "@/components/HelpTip";
import Icon from "@/components/Icon";
import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useFriendships } from "@/hooks/useFriendships";
import { useProfiles } from "@/hooks/useProfiles";
import { Ledger } from "@/types/ledger";
import { reportError } from "@/utils/reportError";
import { KNICK_KNACKS, KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";
import { drawerContents } from "@/features/ledger/buddy/knickknacks/drawer";
import { giftableByItem } from "@/features/ledger/buddy/knickknacks/gifts";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import {
  KnickKnackFind,
  markFindSeen,
  useKnickKnackFinds,
} from "@/features/ledger/buddy/knickknacks/useUnseenFinds";
import GiftModal from "@/features/gifts/GiftModal";

import "./Dashboard.scss";

export const KNICK_KNACK_HELP =
  "budget buddies in financial logs sometimes find random things throughout the day. rumour has it that better spending habits increase your luck.";

const DELETED_USER = "deleted user";

/**
 * Everything the budget buddies have found for you, on the dashboard. Always there,
 * even empty. Finds the buddy hasn't shown you yet stay wrapped: the drawer only
 * points to the log whose buddy has them. Gifts from friends arrive wrapped too, and
 * unwrap right here. With a friend to give to, each knick-knack you found yourself is
 * a button that gives one copy (after a confirmation). `?giftTo=<userDocId>` (from a
 * friend's profile) preselects who it goes to.
 */
export const KnickKnackDrawer = ({ ledgers = [] }: { ledgers?: ReadonlyArray<Ledger> }) => {
  const { user } = useCurrentUser();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading } = useKnickKnackFinds(user?.id);
  const { friends } = useFriendships();
  const { kept, waiting, gifts } = drawerContents(data);
  const givers = useProfiles(gifts.map((g) => g.giftedBy ?? "").filter(Boolean));
  const [giving, setGiving] = useState<KnickKnackId | null>(null);
  const [unwrapped, setUnwrapped] = useState<{ item: KnickKnackId; from: string } | null>(null);
  const titleOf = (id: string) => ledgers.find((l) => l.id === id)?.title;
  const giverName = (id?: string | null) => (id && givers.get(id)?.displayName) || DELETED_USER;
  const giftable = useMemo(
    () => new Set(friends.length ? giftableByItem(data).map((g) => g.item) : []),
    [data, friends.length],
  );
  const giftTo = searchParams.get("giftTo");
  const givingTo = giftTo && friends.includes(giftTo) ? giftTo : null;
  const givingToName = useProfiles(givingTo ? [givingTo] : []).get(givingTo ?? "")?.displayName;
  const stopGivingTo = () => navigate({ search: "", hash: "#knickknacks" }, { replace: true });

  // Gift notifications link to /#knickknacks.
  useEffect(() => {
    if (hash === "#knickknacks") {
      document.getElementById("knickknacks")?.scrollIntoView?.({ block: "start" });
    }
  }, [hash]);

  const unwrap = (gift: KnickKnackFind) => {
    if (!user?.id) return;
    setUnwrapped({ item: gift.item, from: giverName(gift.giftedBy) });
    markFindSeen(user.id, gift.id).catch((err) =>
      reportError(err, { feature: "friends", action: "unwrap_gift", level: "warning" }),
    );
  };

  return (
    <section
      id="knickknacks"
      className="Dashboard__section KnickKnackDrawer"
      aria-labelledby="dashboard-drawer"
    >
      <div className="KnickKnackDrawer__heading">
        <h3 id="dashboard-drawer">knick-knack drawer</h3>
        <HelpTip label="What's the knick-knack drawer?">{KNICK_KNACK_HELP}</HelpTip>
      </div>
      {givingTo && (
        <div className="KnickKnackDrawer__givingTo" role="status">
          <span className="keep-case">
            pick something to give to {givingToName ?? "your friend"}
            {giftable.size ? "" : ". you don't have anything you found yourself to give yet"}
          </span>
          <RowButton onClick={stopGivingTo}>cancel</RowButton>
        </div>
      )}
      <div className="KnickKnackDrawer__box">
        {unwrapped && (
          <p className="KnickKnackDrawer__unwrapped keep-case" role="status">
            you unwrapped {KNICK_KNACKS[unwrapped.item].name.toLowerCase()} from {unwrapped.from}!
          </p>
        )}
        {gifts.map((gift) => (
          <button
            key={gift.id}
            type="button"
            className="KnickKnackDrawer__waiting KnickKnackDrawer__gift"
            onClick={() => unwrap(gift)}
          >
            <Icon type="gift" size={14} />
            <span className="keep-case">a gift from {giverName(gift.giftedBy)}. open it?</span>
          </button>
        ))}
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
            {kept.map(({ item, count }) => {
              const contents = (
                <>
                  <KnickKnack id={item} size={64} />
                  <span className="KnickKnackDrawer__name">
                    {KNICK_KNACKS[item].name}
                    {count > 1 && <span className="KnickKnackDrawer__count"> ×{count}</span>}
                  </span>
                </>
              );
              return (
                <li key={item}>
                  {giftable.has(item) ? (
                    <button
                      type="button"
                      className="KnickKnackDrawer__item KnickKnackDrawer__item--giftable"
                      aria-label={`Give one ${KNICK_KNACKS[item].name.toLowerCase()} to a friend`}
                      onClick={() => setGiving(item)}
                    >
                      {contents}
                    </button>
                  ) : (
                    <div className="KnickKnackDrawer__item">{contents}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          !isLoading &&
          !gifts.length && (
            <p className="KnickKnackDrawer__empty">
              nothing in here yet. the budget buddies are keeping an eye out~
            </p>
          )
        )}
        {giftable.size > 0 && !givingTo && (
          <p className="KnickKnackDrawer__hint">
            tap a knick-knack you found to give one to a friend
          </p>
        )}
      </div>
      {giving && (
        <GiftModal
          item={giving}
          toUserDocId={givingTo ?? undefined}
          onClose={() => setGiving(null)}
          onGiven={givingTo ? stopGivingTo : undefined}
        />
      )}
    </section>
  );
};

export default KnickKnackDrawer;
