import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";
import { useProfiles } from "@/hooks/useProfiles";
import { KNICK_KNACKS } from "@/features/ledger/buddy/knickknacks/catalog";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { giverIds, provenanceLabel } from "@/features/ledger/buddy/knickknacks/provenance";
import { useShelf } from "./useShelf";

export const DELETED_USER = "deleted user";

/**
 * Someone's kept knick-knacks on their profile: each item once, with how they first got
 * it (found, earned, or a gift from whom) and when. How many of anything they have is
 * private, so it's never shown (or readable: see shelves/ in firestore.rules). A display
 * only: no totals, no comparing with anyone.
 */
export const KnickKnackShelf = ({ userDocId }: { userDocId: string }) => {
  const { slots: shelf, isLoading, isError } = useShelf(userDocId);
  const givers = useProfiles(giverIds(shelf));
  const { formatShortDate } = useDateFormat();

  const nameOf = (id: string) => givers.get(id)?.displayName ?? DELETED_USER;
  const day = (ms: number) => formatShortDate(dayjs(ms));

  if (isError) return <p className="ProfilePage__muted">couldn't open the shelf.</p>;
  if (isLoading) return null;
  if (!shelf.length) return <p className="ProfilePage__muted">nothing on the shelf yet.</p>;

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
    </ul>
  );
};

export default KnickKnackShelf;
