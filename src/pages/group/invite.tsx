import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { parseReferenceArray } from "@/utils/helpers";
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useGetGroup } from "@/hooks/useGetGroup";
import { Group } from "@/features/moneylog/components/Group";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

export const InvitePage = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { group, isSuccess: isSuccessGroup } = useGetGroup(groupId);
  const { user: loggedInUser } = useCurrentUser();
  const { addGroupToMember, addMemberToGroup } = useLogGroupQuery();

  const [showInviteModal, setShowInviteModal] = useState(false);

  const isProcessingJoin = useMemo(
    () => addGroupToMember.isLoading || addMemberToGroup.isLoading,
    [addGroupToMember, addMemberToGroup],
  );

  const memberIds = useMemo(() => {
    if (!group?.members) return [];
    return parseReferenceArray(group.members).map((ref) => ref.id);
  }, [group?.members]);

  const currentUserIsMember = useMemo(
    () => memberIds.includes(loggedInUser?.id ?? ""),
    [loggedInUser, memberIds],
  );

  const handleJoinGroup = async () => {
    if (!loggedInUser || !groupId) return;
    try {
      await Promise.all([
        addGroupToMember.mutate({ currentUserId: loggedInUser.userId, groupId }),
        addMemberToGroup.mutate({ currentUserId: loggedInUser.userId, groupId }),
      ]);
      navigate("/");
    } catch (error) {
      console.error("Failed to join group:", error);
    }
  };

  useEffect(() => {
    if (currentUserIsMember && groupId) {
      navigate(`/g/${groupId}`, { replace: true });
    }
  }, [currentUserIsMember, groupId, navigate]);

  useEffect(() => {
    if (isSuccessGroup && group?.members && !currentUserIsMember) {
      setShowInviteModal(true);
    }
  }, [currentUserIsMember, isSuccessGroup]);

  return (
    <>
      {isSuccessGroup && group && groupId && (
        <Group group={group} groupId={groupId} isSpectator={true} />
      )}
      {isSuccessGroup && group && groupId && !currentUserIsMember && (
        <Modal isOpen={showInviteModal}>
          <Modal.Header>
            {group.members.length < group.max_participants
              ? `Welcome to ${group.title}`
              : "Group full"}
          </Modal.Header>
          <Modal.Body>
            {group.members.length < group.max_participants ? (
              <p>You've been invited to join this moneylog group!</p>
            ) : (
              <>
                <p>Sorry, this group is already full :(</p>
                <p>Were you sent here by accident?</p>
              </>
            )}
          </Modal.Body>
          <Modal.Actions>
            {group.members.length < group.max_participants && (
              <Button
                onClick={handleJoinGroup}
                buttonStyle="primary-border"
                text="Join"
                disabled={isProcessingJoin}
              />
            )}
            {group.members.length >= group.max_participants && (
              <Button onClick={() => navigate("/")} buttonStyle="primary-border" text="Back" />
            )}
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
};
