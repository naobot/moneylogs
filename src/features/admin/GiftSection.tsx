import { useMemo, useState } from "react";

import Button from "@/components/Button";
import { useMutation } from "@/hooks/useFirebase";
import { useToastContext } from "@/hooks/useToastContext";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { KNICK_KNACKS, KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";
import { reportError } from "@/utils/reportError";

import { AdminGiftMode, adminErrorMessage, adminGift, isExpectedAdminError } from "./adminApi";
import { grantableItemGroups, inventoryRows } from "./adminItems";

/** Mirrors MAX_GIFT_COUNT in functions/src/adminPlan.ts. */
const MAX_COUNT: Record<AdminGiftMode, number> = { spirit: 20, grant: 200 };

/** The catalogue is static, so the picker's groups are built once. */
const groups = grantableItemGroups();

type GiftSectionProps = {
  userDocId: string;
  inventory: Record<string, number>;
  onChanged: () => void;
};

export const GiftSection = ({ userDocId, inventory, onChanged }: GiftSectionProps) => {
  const rows = useMemo(() => inventoryRows(inventory), [inventory]);
  const [item, setItem] = useState<KnickKnackId>(groups[0].items[0]);
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToastContext();
  const gift = useMutation(async (mode: AdminGiftMode) =>
    adminGift({ userDocId, item, count, mode }),
  );

  const send = async (mode: AdminGiftMode) => {
    setError(null);
    try {
      const { data } = await gift.mutate(mode);
      const what = `${count} × ${KNICK_KNACKS[item].name}`;
      showToast(
        mode === "spirit"
          ? `Sent ${what} from a forest spirit${data.notified ? "" : " (notifications off)"}`
          : `Granted ${what}`,
        "success",
      );
      onChanged();
    } catch (err) {
      if (!isExpectedAdminError(err)) {
        reportError(err, { feature: "admin", action: "gift", tags: { mode } });
      }
      setError(adminErrorMessage(err));
    }
  };

  const countOk = (mode: AdminGiftMode) =>
    Number.isInteger(count) && count >= 1 && count <= MAX_COUNT[mode];

  return (
    <section className="Admin__section" aria-label="knick-knacks">
      <h3>knick-knacks</h3>
      {rows.length ? (
        <ul className="Admin__inventory">
          {rows.map((row) => (
            <li key={row.id}>
              <KnickKnack id={row.id} size={32} />
              <span>
                {row.name} ×{row.count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="Admin__muted">none yet.</p>
      )}

      <div className="Admin__giftForm">
        <KnickKnack id={item} size={64} />
        <div className="Admin__giftFields">
          <label>
            <span>item</span>
            <select value={item} onChange={(e) => setItem(e.target.value as KnickKnackId)}>
              {groups.map((group) => (
                <optgroup key={group.rarity} label={group.label}>
                  {group.items.map((id) => (
                    <option key={id} value={id}>
                      {KNICK_KNACKS[id].name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>how many</span>
            <input
              className="LineInput Admin__count"
              type="number"
              min={1}
              max={MAX_COUNT.grant}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
        </div>
      </div>
      <p className="Admin__muted">
        Grant: already kept, straight into their drawer. Forest spirit: wrapped, with a gift
        notification (up to {MAX_COUNT.spirit}).
      </p>
      <div className="Admin__actions">
        <Button
          text="Grant (kept)"
          size="sm"
          variant="secondary"
          loading={gift.isLoading}
          disabled={!countOk("grant")}
          onClick={() => void send("grant")}
        />
        <Button
          text="Send from forest spirit"
          size="sm"
          loading={gift.isLoading}
          disabled={!countOk("spirit")}
          onClick={() => void send("spirit")}
        />
      </div>
      {error && <p className="error-message">{error}</p>}
    </section>
  );
};
