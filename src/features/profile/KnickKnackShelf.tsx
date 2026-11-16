import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";
import { useProfiles } from "@/hooks/useProfiles";
import { KNICK_KNACKS } from "@/features/ledger/buddy/knickknacks/catalog";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import {
  giverIds,
  provenanceLabel,
  shelfContents,
} from "@/features/ledger/buddy/knickknacks/provenance";
import { usePublicFinds } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";

export const DELETED_USER = "deleted user";

/**
 * Someone's kept knick-knacks on their profile: each item once, with how every copy
 * came to them (found, or a gift from whom) and when. A display only: no totals, no
 * comparing with anyone.
 */
export const KnickKnackShelf = ({ userDocId }: { userDocId: string }) => {
  const { data, isLoading, isError } = usePublicFinds(userDocId);
  const givers = useProfiles(giverIds(data));
  const { formatShortDate } = useDateFormat();

  const nameOf = (id: string) => givers.get(id)?.displayName ?? DELETED_USER;
  const day = (ms: number) => formatShortDate(dayjs(ms));
  const shelf = shelfContents(data);

  if (isError) return <p className="ProfilePage__muted">couldn't open the shelf.</p>;
  if (isLoading && !data.length) return null;
  if (!shelf.length) return <p className="ProfilePage__muted">nothing on the shelf yet.</p>;

  return (
    <ul className="KnickKnackShelf">
      {shelf.map(({ item, provenance }) => (
        <li key={item} className="KnickKnackShelf__item">
          <KnickKnack id={item} size={64} />
          <span className="KnickKnackShelf__name">{KNICK_KNACKS[item].name}</span>
          <ul className="KnickKnackShelf__provenance">
            {provenance.map((p, i) => (
              <li key={i} className="keep-case">
                {provenanceLabel(p, nameOf, day)}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

export default KnickKnackShelf;
