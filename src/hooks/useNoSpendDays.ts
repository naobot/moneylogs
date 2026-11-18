import { useMemo } from "react";
import { collection, documentId, query, where } from "firebase/firestore";
import dayjs from "@/utils/configuredDayjs";
import { todayInTz } from "@/utils/ledger";
import { db } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useFirebaseCollection } from "./useFirebase";

/** Enough confirmed days for the buddy's streak and today's state. */
const RECENT_DAYS = 31;

/**
 * The days the person confirmed as no-spend days (users/{id}/noSpendDays, written by the
 * confirmNoSpendDay function), most recent month or so, live. A day with nothing logged
 * that isn't in here may just have been forgotten.
 */
export const useNoSpendDays = () => {
  const { user } = useCurrentUser();
  // Only read on a financial log, which no one reaches before their user doc has saved.
  // TODO: gate on isUserDocSaved once fix/new-user-notifications-error is merged.
  const userDocId = user?.id;
  // Day ids sort as dates, so "since" is a plain range on the id. (Not orderBy + limit: on
  // the log page that shape set off the Firestore 11.10 "ca9" internal assertion.)
  const since = dayjs(todayInTz(user?.timezone)).subtract(RECENT_DAYS, "day").format("YYYY-MM-DD");
  const result = useFirebaseCollection<string>({
    queryBuilder: () =>
      userDocId
        ? query(collection(db, "users", userDocId, "noSpendDays"), where(documentId(), ">=", since))
        : null,
    dataTransformer: (docs) => docs.map((d) => d.id),
    dependencies: [userDocId, since],
    enabled: !!userDocId,
  });
  const days = useMemo(() => new Set(userDocId ? result.data : []), [userDocId, result.data]);
  return { days, isSuccess: !!userDocId && result.isSuccess };
};
