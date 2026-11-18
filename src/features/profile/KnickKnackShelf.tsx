import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";
import { profileName, useProfiles } from "@/hooks/useProfiles";
import { KNICK_KNACKS } from "@/features/ledger/buddy/knickknacks/catalog";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { giverIds, provenanceLabel } from "@/features/ledger/buddy/knickknacks/provenance";
import { useCurrentUser } from "@/contexts";
import { useShelf } from "./useShelf";
import { useGiftsInTransit } from "./useGiftsInTransit";

/**
 * Someone's kept knick-knacks on their profile: each item once, with how they first got
 * it (found, earned, or a gift from whom) and when. How many of anything they have is
 * private, so it's never shown (or readable: see shelves/ in firestore.rules). A display
 * only: no totals, no comparing with anyone.
 *
 * Gifts the viewer sent that are still wrapped show after it, dimmed: only the viewer's
 * own, never anyone else's (firestore.rules).
 */
export const KnickKnackShelf = ({ userDocId }: { userDocId: string }) => {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { slots: shelf, isLoading, isError } = useShelf(userDocId);
  const { gifts: inTransit, isLoading: inTransitLoading } = useGiftsInTransit(userDocId, user?.id);
  const givers = useProfiles(giverIds(shelf));
  const { formatShortDate } = useDateFormat();

  // "…" while the giver's profile loads; "deleted user" only once it's known to be gone.
  const nameOf = (id: string) => profileName(givers, id) ?? "…";
  const day = (ms: number) => formatShortDate(dayjs(ms));

  if (isError) return <p className="ProfilePage__muted">couldn't open the shelf.</p>;
  // The viewer's wrapped gifts count too: without them an empty shelf isn't empty yet.
  if (isLoading || inTransitLoading || userLoading) return null;
  if (!shelf.length && !inTransit.length) {
    return <p className="ProfilePage__muted">nothing on the shelf yet.</p>;
  }

  return (
    <ul className="KnickKnackShelf">
      {shelf.map(({ item, provenance }) => (
        <li key={item} className="KnickKnackShelf__item">
          <KnickKnack id={item} size={64} />
          <span className="KnickKnackShelf__name">{KNICK_KNACKS[item].name}</span>
          <span className="KnickKnackShelf__provenance keep-case">
            {provenanceLabel(provenance, nameOf, day)}
          </span>
        </li>
      ))}
      {inTransit.map(({ id, item, sentAtMs }) => (
        <li key={id} className="KnickKnackShelf__item KnickKnackShelf__item--transit">
          <span className="KnickKnackShelf__art">
            <KnickKnack id={item} size={64} />
          </span>
          <span className="KnickKnackShelf__name">{KNICK_KNACKS[item].name}</span>
          <span className="KnickKnackShelf__provenance">
            your gift · not opened yet{sentAtMs != null && <> · sent {day(sentAtMs)}</>}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default KnickKnackShelf;
