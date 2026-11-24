import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { needsProfileSetup, parseReferenceArray } from "@/utils/helpers";
import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useGetGroup } from "@/hooks/useGetGroup";
import { writeSelfNotification } from "@/hooks/useNotifications";
import { clearLogInvite } from "@/features/invites/logInvites";
import { LogNotFound } from "@/features/logActions/LogNotFound";
import { Group } from "@/features/moneylog/components/Group";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";

export const InvitePage = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { group, isSuccess: isSuccessGroup, isError } = useGetGroup(groupId);
  const { user: loggedInUser, isLoading: userLoading } = useCurrentUser();
  const { joinGroup } = useLogGroupQuery();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinedModal, setShowJoinedModal] = useState(false);

  const isProcessingJoin = joinGroup.isLoading;

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
      await joinGroup.mutate({ currentUserId: loggedInUser.userId, groupId });
      track("join_log", { log_kind: "social" });
      void writeSelfNotification({
        userDocId: loggedInUser.id,
        prefs: loggedInUser.notificationPrefs,
        type: "log_joined",
        groupId,
        groupName: group?.title ?? "",
        logKind: "social",
      });
      clearLogInvite(loggedInUser.id, groupId).catch((err) =>
        reportError(err, { feature: "log_invites", action: "clear_invite" }),
      );
      if (needsProfileSetup(loggedInUser)) {
        setShowInviteModal(false);
        setShowJoinedModal(true);
      } else {
        void navigate("/");
      }
    } catch (error) {
      reportError(error, { feature: "log_group", action: "join_group" });
    }
  };

  useEffect(() => {
    if (currentUserIsMember && groupId && !showJoinedModal) {
      void navigate(`/g/${groupId}`, { replace: true });
    }
  }, [currentUserIsMember, groupId, navigate, showJoinedModal]);

  useEffect(() => {
    // Not until we know who you are: a member would otherwise see "Join" before the
    // redirect to the log.
    if (isSuccessGroup && group?.members && !userLoading && !currentUserIsMember) {
      setShowInviteModal(true);
    }
  }, [currentUserIsMember, isSuccessGroup, group?.members, userLoading]);

  if (isError) return <LogNotFound />;

  return (
    <>
      {isSuccessGroup && group && groupId && (
        <Group group={group} groupId={groupId} isSpectator={true} />
      )}
      {isSuccessGroup && group && groupId && !currentUserIsMember && (
        <Modal isOpen={showInviteModal}>
          <Modal.Header>
            {group.members.length < group.max_participants ? (
              <>
                Welcome to <span className="keep-case">{group.title}</span>
              </>
            ) : (
              "Group full"
            )}
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
                variant="primary"
                text="Join"
                loading={isProcessingJoin}
              />
            )}
            {group.members.length >= group.max_participants && (
              <Button onClick={() => navigate("/")} variant="secondary" text="Back" />
            )}
          </Modal.Actions>
        </Modal>
      )}
      {group && (
        <Modal isOpen={showJoinedModal} onClose={() => setShowJoinedModal(false)}>
          <Modal.Header>
            You have joined <span className="keep-case">{group.title}</span>!
          </Modal.Header>
          <Modal.Body>
            <p>Please set up your user profile.</p>
          </Modal.Body>
          <Modal.Actions>
            <Button onClick={() => navigate("/me")} variant="primary" text="Set up my profile" />
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
};
