import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { useMutation } from "@/hooks/useFirebase";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useReadTracking } from "@/hooks/useReadTracking";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import CopyTextArea from "@/features/layout/components/CopyTextArea";
import CurrencySelect from "@/components/CurrencySelect";
import PlacePicker from "@/components/PlacePicker";
import { Currency } from "@/types/user";
import { nextDisplayLocation, Place, placeLabel } from "@/utils/citySearch";
import { ledgerStartCurrency } from "@/utils/currency";
import { reportError } from "@/utils/reportError";
import { shareUrl } from "@/utils/shareUrl";

import AvatarEditorModal from "./avatar/AvatarEditorModal";

/** Avatar, display name, location and timezone. */
export const ProfileSection = () => {
  const { showToast } = useToastContext();
  const { trackUserAction } = useReadTracking();
  const { user } = useCurrentUser();
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDisplayLocation, setNewDisplayLocation] = useState("");
  const [newTimezone, setNewTimezone] = useState<string>();
  const [newTimezonePlace, setNewTimezonePlace] = useState<string>();
  // The display location we last filled in from a pick, so later picks keep it in step
  // until the user writes their own.
  const [suggestedLocation, setSuggestedLocation] = useState<string>();
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [newDefaultCurrency, setNewDefaultCurrency] = useState<Currency>(() =>
    ledgerStartCurrency(user),
  );

  const isSubmittable = useMemo(() => {
    return !!user?.userId && !!newTimezone;
  }, [user?.userId, newTimezone]);

  const { updateUserProfile } = useUserQuery();

  const { mutate: updateUserInfo, isLoading: createPending } = useMutation(
    async (userData: {
      userId: string;
      displayName: string;
      displayLocation?: string;
      timezone: string;
      timezonePlace?: string;
      defaultCurrency: Currency;
    }) => {
      await updateUserProfile.mutate(userData);

      trackUserAction("update_user_profile", {
        user_id: user?.id,
      });
    },
  );

  useEffect(() => {
    if (user?.displayName) {
      setNewDisplayName(user?.displayName);
    }
    if (user?.displayLocation) {
      setNewDisplayLocation(user?.displayLocation);
    }
    if (user?.timezone) {
      setNewTimezone(user?.timezone);
    }
    setNewTimezonePlace(user?.timezonePlace);
    if (user?.defaultCurrency) {
      setNewDefaultCurrency(user.defaultCurrency);
    }
  }, [user]);

  const handlePickPlace = (place: Place) => {
    setNewTimezone(place.timezone);
    setNewTimezonePlace(place.kind === "city" ? placeLabel(place) : undefined);
    const next = nextDisplayLocation(newDisplayLocation, suggestedLocation, place);
    if (next !== newDisplayLocation) {
      setNewDisplayLocation(next);
      setSuggestedLocation(next);
    }
  };

  const handleUpdateUserInfo = async () => {
    if (!user?.userId || !newTimezone) return;

    try {
      await updateUserInfo({
        userId: user?.id,
        displayName: newDisplayName,
        displayLocation: newDisplayLocation ?? undefined,
        timezone: newTimezone,
        timezonePlace: newTimezonePlace,
        defaultCurrency: newDefaultCurrency,
      });

      showToast("Profile updated", "success");
    } catch (err) {
      reportError(err, { feature: "profile", action: "update_profile" });
      showToast("Failed to update profile. Please try again.");
    }
  };

  return (
    <>
      <div className="UserSettings__avatar">
        <Avatar avatar={user?.avatar} name={user?.displayName} size={60} />
        <Button
          text={user?.avatar ? "Edit avatar" : "Draw avatar"}
          size="sm"
          variant="secondary"
          onClick={() => setEditingAvatar(true)}
        />
      </div>
      {user?.id && (
        <div className="UserSettings__profileLink">
          <p>
            Your profile link. Send it to people you'd like to add as friends, or{" "}
            <Link to={`/u/${user.id}`}>see your profile</Link>.
          </p>
          <CopyTextArea value={shareUrl(`/u/${user.id}`)} />
        </div>
      )}
      {editingAvatar && <AvatarEditorModal isOpen onClose={() => setEditingAvatar(false)} />}

      <div className="UserSettings__form">
        <ControlledInput
          onChange={(e) => setNewDisplayName((e.target as HTMLInputElement).value)}
          label="Display name"
          value={newDisplayName}
        />

        <PlacePicker
          label="I'm based in"
          timezone={newTimezone}
          place={newTimezonePlace}
          onChange={handlePickPlace}
        />

        <ControlledInput
          onChange={(e) => setNewDisplayLocation((e.target as HTMLInputElement).value)}
          label="Show my location as"
          value={newDisplayLocation}
        />
        <p className="ProfileFields__hint">
          Picking a place fills this in. Write your own, or clear it to show nothing.
        </p>

        {newDisplayName.length > 0 && (
          <p>
            Your name will display as{" "}
            <strong>
              {newDisplayName} {newDisplayLocation.length > 0 && <>({newDisplayLocation})</>}
            </strong>
          </p>
        )}

        <CurrencySelect
          id="profile-default-currency"
          label="Default currency"
          value={newDefaultCurrency}
          onChange={setNewDefaultCurrency}
        />
      </div>

      <div className="Menu">
        <Button
          text="Set my user profile"
          variant="primary"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={handleUpdateUserInfo}
        />
      </div>
    </>
  );
};

export default ProfileSection;
