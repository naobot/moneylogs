import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { parseReferenceArray } from "@/utils/helpers";
import { useGetGroup } from "@/hooks/useGetGroup";
import { useStampLogVisit } from "@/hooks/useStampLogVisit";
import { LogNotFound } from "@/features/logActions/LogNotFound";
import { Group } from "@/features/moneylog/components/Group";

export const GroupPage = () => {
  const { groupId } = useParams();
  const { group, isSuccess: isSuccessGroup, isError } = useGetGroup(groupId);
  const { user: loggedInUser, isLoading: userLoading } = useCurrentUser();

  const memberIds = useMemo(() => {
    if (!group?.members) return [];
    return parseReferenceArray(group.members).map((ref) => ref.id);
  }, [group?.members]);

  const isSpectator = useMemo(
    () => !memberIds.includes(loggedInUser?.id ?? ""),
    [loggedInUser, memberIds],
  );

  // Members only: spectators have nothing to come back to on Home.
  useStampLogVisit(isSuccessGroup && group && !isSpectator ? groupId : undefined);

  if (isError) return <LogNotFound />;

  return (
    <>
      {/* Wait for the viewer too, or a member briefly gets the spectator view. */}
      {isSuccessGroup && group && groupId && !userLoading && (
        <Group group={group} groupId={groupId} isSpectator={isSpectator} />
      )}
    </>
  );
};
