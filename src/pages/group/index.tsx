import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { parseReferenceArray } from "@/utils/helpers";
import { useGetGroup } from "@/hooks/useGetGroup";
import { LogNotFound } from "@/features/logs/LogNotFound";
import { Group } from "@/features/moneylog/components/Group";

export const GroupPage = () => {
  const { groupId } = useParams();
  const { group, isSuccess: isSuccessGroup, isError } = useGetGroup(groupId);
  const { user: loggedInUser } = useCurrentUser();

  const memberIds = useMemo(() => {
    if (!group?.members) return [];
    return parseReferenceArray(group.members).map((ref) => ref.id);
  }, [group?.members]);

  const isSpectator = useMemo(
    () => !memberIds.includes(loggedInUser?.id ?? ""),
    [loggedInUser, memberIds],
  );

  if (isError) return <LogNotFound />;

  return (
    <>
      {isSuccessGroup && group && groupId && (
        <Group group={group} groupId={groupId} isSpectator={isSpectator} />
      )}
    </>
  );
};
