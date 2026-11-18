import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import HelpTip from "@/components/HelpTip";
import Icon from "@/components/Icon";
import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useFriendships } from "@/hooks/useFriendships";
import { DELETED_USER, profileName, useProfiles } from "@/hooks/useProfiles";
import { KNICK_KNACKS, KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";
import { drawerContents } from "@/features/ledger/buddy/knickknacks/drawer";
import { giftableByItem } from "@/features/ledger/buddy/knickknacks/gifts";
import {
  FOREST_SPIRIT_ID,
  giverName as nameOfGiver,
} from "@/features/ledger/buddy/knickknacks/provenance";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import {
  KnickKnackFind,
  useKnickKnackFinds,
} from "@/features/ledger/buddy/knickknacks/useUnseenFinds";
import GiftModal from "@/features/gifts/GiftModal";
import { LUCK_WORDS, useLuck } from "@/features/ledger/buddy/knickknacks/luck";
import KnickKnackReveal from "@/features/ledger/buddy/knickknacks/KnickKnackReveal";

import "./Dashboard.scss";

export const KNICK_KNACK_HELP =
  "budget buddies in financial logs sometimes find random things throughout the day. rumour has it that better spending habits increase your luck. so does dropping by every day.";

/** The bouncing "!" on the drawer's alerts. */
const AlertMark = () => (
  <span className="KnickKnackDrawer__alertMark" aria-hidden="true">
    <Icon type="warning" size={14} />
  </span>
);

/**
 * Everything the budget buddies have found for you, on the dashboard. Always there,
 * even empty. Finds your buddy hasn't shown you yet, and gifts from friends, wait
 * behind centred alerts with a bouncing "!"; clicking one opens the reveal pop-up,
 * which is what completes the event. With a friend to give to, each knick-knack you found yourself is
 * a button that gives one copy (after a confirmation). `?giftTo=<userDocId>` (from a
 * friend's profile) preselects who it goes to.
 */
export const KnickKnackDrawer = () => {
  const { user } = useCurrentUser();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading } = useKnickKnackFinds(user?.id);
  const luck = useLuck(user?.id);
  const { friends } = useFriendships();
  const { kept, waiting, gifts } = drawerContents(data);
  const [giving, setGiving] = useState<KnickKnackId | null>(null);
  // What the reveal pop-up is showing: a snapshot of the queue (finds leave `waiting` as
  // soon as they're marked seen) and where it's up to.
  const [reveal, setReveal] = useState<{ queue: KnickKnackFind[]; at: number } | null>(null);
  // Givers of unopened gifts and of the one being unwrapped: opening a gift marks it seen,
  // which drops it from `gifts`, but the pop-up still names who sent it.
  const givers = useProfiles(
    [...gifts, ...(reveal?.queue ?? [])]
      .map((g) => g.giftedBy ?? "")
      .filter((id) => id && id !== FOREST_SPIRIT_ID),
  );
  const giverName = (id?: string | null) =>
    nameOfGiver(id, (giver) => profileName(givers, giver) ?? "…", DELETED_USER);
  const giftable = useMemo(
    () => new Set(friends.length ? giftableByItem(data).map((g) => g.item) : []),
    [data, friends.length],
  );
  const giftTo = searchParams.get("giftTo");
  const givingTo = giftTo && friends.includes(giftTo) ? giftTo : null;
  const givingToProfiles = useProfiles(givingTo ? [givingTo] : []);
  const givingToName =
    givingToProfiles.profiles.get(givingTo ?? "")?.displayName ??
    (givingToProfiles.isLoading ? "…" : "your friend");
  const stopGivingTo = () => navigate({ search: "", hash: "#knickknacks" }, { replace: true });

  // Gift notifications link to /#knickknacks.
  useEffect(() => {
    if (hash === "#knickknacks") {
      document.getElementById("knickknacks")?.scrollIntoView?.({ block: "start" });
    }
  }, [hash]);

  return (
    <section
      id="knickknacks"
      className="Dashboard__section KnickKnackDrawer"
      aria-labelledby="dashboard-drawer"
    >
      <div className="KnickKnackDrawer__heading">
        <h3 id="dashboard-drawer">knick-knack drawer</h3>
        <HelpTip label="What's the knick-knack drawer?">{KNICK_KNACK_HELP}</HelpTip>
        {luck && (
          <span className="KnickKnackDrawer__luck">
            luck: <strong>{LUCK_WORDS[luck]}</strong>
          </span>
        )}
      </div>
      {givingTo && (
        <div className="KnickKnackDrawer__givingTo" role="status">
          <span className="keep-case">
            pick something to give to {givingToName}
            {giftable.size ? "" : ". you don't have anything you found yourself to give yet"}
          </span>
          <RowButton onClick={stopGivingTo}>cancel</RowButton>
        </div>
      )}
      <div className="KnickKnackDrawer__box">
        {(waiting.length > 0 || gifts.length > 0) && (
          <div className="KnickKnackDrawer__alerts">
            {waiting.length > 0 && (
              <button
                type="button"
                className="KnickKnackDrawer__alert KnickKnackDrawer__alert--bounce"
                onClick={() => setReveal({ queue: waiting, at: 0 })}
              >
                <AlertMark />
                <span className="keep-case">
                  your budget buddy has{" "}
                  {waiting.length > 1 ? `${waiting.length} things` : "something"} to show you
                </span>
              </button>
            )}
            {gifts.map((gift) => (
              <button
                key={gift.id}
                type="button"
                className="KnickKnackDrawer__alert"
                onClick={() => setReveal({ queue: [gift], at: 0 })}
              >
                <AlertMark />
                <span className="keep-case">
                  {giverName(gift.giftedBy)} has sent you something!
                </span>
              </button>
            ))}
          </div>
        )}
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
      {reveal && user?.id && (
        <KnickKnackReveal
          userDocId={user.id}
          find={reveal.queue[reveal.at]}
          fromName={
            reveal.queue[reveal.at].source === "gift"
              ? giverName(reveal.queue[reveal.at].giftedBy)
              : undefined
          }
          remaining={reveal.queue.length - reveal.at - 1}
          onNext={() => setReveal({ ...reveal, at: reveal.at + 1 })}
          onClose={() => setReveal(null)}
        />
      )}
    </section>
  );
};

export default KnickKnackDrawer;
