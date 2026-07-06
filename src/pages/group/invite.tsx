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
  const [showJoinedModal, setShowJoinedModal] = useState(false);

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
      if (!loggedInUser.timezone) {
        setShowInviteModal(false);
        setShowJoinedModal(true);
      } else {
        void navigate("/");
      }
    } catch (error) {
      console.error("Failed to join group:", error);
    }
  };

  useEffect(() => {
    if (currentUserIsMember && groupId && !showJoinedModal) {
      void navigate(`/g/${groupId}`, { replace: true });
    }
  }, [currentUserIsMember, groupId, navigate, showJoinedModal]);

  useEffect(() => {
    if (isSuccessGroup && group?.members && !currentUserIsMember) {
      setShowInviteModal(true);
    }
  }, [currentUserIsMember, isSuccessGroup, group?.members]);

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
      {group && (
        <Modal isOpen={showJoinedModal} onClose={() => setShowJoinedModal(false)}>
          <Modal.Header>You have joined {group.title}!</Modal.Header>
          <Modal.Body>
            <p>Please set up your user profile.</p>
          </Modal.Body>
          <Modal.Actions>
            <Button
              onClick={() => navigate("/me")}
              buttonStyle="primary-border"
              text="Set up my profile"
            />
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
};
