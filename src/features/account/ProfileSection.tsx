import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { useMutation } from "@/hooks/useFirebase";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useReadTracking } from "@/hooks/useReadTracking";

import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import CurrencySelect from "@/components/CurrencySelect";
import TimezoneSelect from "@/components/TimezoneSelect";
import { Currency } from "@/types/user";
import { ledgerStartCurrency } from "@/utils/currency";

/** Display name, location and timezone. */
export const ProfileSection = () => {
  const { showToast } = useToastContext();
  const { trackUserAction } = useReadTracking();
  const { user } = useCurrentUser();
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDisplayLocation, setNewDisplayLocation] = useState("");
  const [newTimezone, setNewTimezone] = useState<string>();
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
    if (user?.defaultCurrency) {
      setNewDefaultCurrency(user.defaultCurrency);
    }
  }, [user]);

  const handleUpdateUserInfo = async () => {
    if (!user?.userId || !newTimezone) return;

    try {
      await updateUserInfo({
        userId: user?.id,
        displayName: newDisplayName,
        displayLocation: newDisplayLocation ?? undefined,
        timezone: newTimezone,
        defaultCurrency: newDefaultCurrency,
      });

      showToast("Profile updated", "success");
    } catch (err) {
      console.error("Failed to update user info:", err);
      showToast("Failed to update profile. Please try again.");
    }
  };

  return (
    <>
      <div className="UserSettings__form">
        <ControlledInput
          onChange={(e) => setNewDisplayName((e.target as HTMLInputElement).value)}
          label="Display name"
          value={newDisplayName}
        />

        <ControlledInput
          onChange={(e) => setNewDisplayLocation((e.target as HTMLInputElement).value)}
          label="Display location"
          value={newDisplayLocation}
        />

        {newDisplayName.length > 0 && (
          <p>
            Your name will display as{" "}
            <strong>
              {newDisplayName} {newDisplayLocation.length > 0 && <>({newDisplayLocation})</>}
            </strong>
          </p>
        )}

        <TimezoneSelect label="My timezone is" value={newTimezone} onChange={setNewTimezone} />

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
          size="lg"
          buttonStyle="primary-border"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={handleUpdateUserInfo}
        />
      </div>
    </>
  );
};

export default ProfileSection;
