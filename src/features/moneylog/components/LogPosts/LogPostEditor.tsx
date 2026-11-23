import cx from "classnames";
import React, {
  ChangeEvent,
  Dispatch,
  forwardRef,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dayjs from "dayjs";
import MDEditor, { commands, type ExecuteState, TextAreaTextApi } from "@uiw/react-md-editor";
import Markdown from "@/components/Markdown";

import { useCurrentUser } from "@/contexts";
import { Currency } from "@/types/user";
import { CurrencyAmounts } from "@/types/ledger";
import { useLogPostQuery } from "@/hooks/useLogPostQuery";
import { track } from "@/utils/analytics";
import { ImageValidationError, useImageUpload } from "@/hooks/useImageUpload";
import { reportError } from "@/utils/reportError";
import { useToastContext } from "@/hooks/useToastContext";
import TutorialTooltip from "@/components/TutorialTooltip";
import { useTutorial } from "@/contexts/TutorialContext";
import { cityFromZone, getAutoPostTimezone, postZoneLabel } from "@/utils/timezone";
import { Place } from "@/utils/citySearch";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import PlacePicker from "@/components/PlacePicker";
import RowButton from "@/components/RowButton";

import { CURRENCIES, LAST_CURRENCY_KEY, postStartCurrency } from "@/utils/currency";
import { AmountRow, amountRows, normaliseAmounts, sameRows } from "@/utils/postAmounts";
import { sumAmountsIn } from "@/utils/postCalculator";
import { appendPulled, mergeIntoRows } from "@/utils/pullLines";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import PullSpendingModal, { PulledSpending } from "./PullSpendingModal";
import { clearPostDraft, readPostDraft, writePostDraft } from "@/utils/postDraft";
import { markdownColorMode, useTheme } from "@/utils/theme";
import { storage } from "@/platform";

const LogPostEditor = forwardRef(
  (
    {
      type,
      postId = null,
      groupId,
      userId,
      isPinned,
      isCreateNewEntrySet,
      setCurrentlyEditingPostId,
      content = "",
      amounts = { JPY: 0 },
      primaryCurrency: savedPrimary,
      timezone = null,
      timezonePlace = null,
      date = Date.now(),
      pulledEntryIds = [],
      alreadyPulled,
    }: {
      type: "edit" | "new";
      postId?: string | null;
      groupId: string;
      userId: string;
      isCreateNewEntrySet: Dispatch<SetStateAction<boolean>>;
      setCurrentlyEditingPostId: Dispatch<SetStateAction<string | null>>;
      content?: string | null;
      /** Spending per currency, in row order (the first is the primary). */
      amounts?: CurrencyAmounts;
      /** The saved post's primary currency, which becomes the first row. */
      primaryCurrency?: Currency;
      date?: number;
      isPinned?: boolean;
      timezone?: string | null;
      timezonePlace?: string | null;
      /** Entries this post already pulled in. */
      pulledEntryIds?: string[];
      /** Entries pulled into any of the author's posts in this log. */
      alreadyPulled?: ReadonlySet<string>;
    },
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const { user } = useCurrentUser();
    // The signed-in author, not `userId`: that's whichever member's tab is showing, and
    // can change for a render while this editor is still open.
    const authUid = user?.userId;

    const theme = useTheme();
    // A new post picks up where an unsent one was left: text, amounts and pulls together.
    const [draft] = useState(() => (type === "new" && authUid ? readPostDraft(authUid) : null));
    const [newEntryContent, newEntryContentSet] = useState<string | null>(() =>
      type === "new" ? (draft?.content ?? "") : content,
    );
    // What the post was opened with, to tell whether the amounts were touched.
    const [initialRows] = useState(() => amountRows(amounts, savedPrimary));
    const [rows, setRows] = useState<AmountRow<Currency>[]>(() => {
      if (draft?.rows) return draft.rows;
      const initial = initialRows;
      return initial.length > 0 ? initial : [{ currency: "JPY", amount: 0 }];
    });
    const [newEntryDate, newEntryDateSet] = useState<number>(date);
    const [pulledIds, setPulledIds] = useState<string[]>(draft?.pulledIds ?? pulledEntryIds);
    const [isPulling, setIsPulling] = useState(false);
    const { ledgers } = useGetMyLedgers();
    const hasLedgers = (ledgers?.length ?? 0) > 0;
    const pulledAnywhere = useMemo(
      () => new Set([...(alreadyPulled ?? []), ...pulledIds]),
      [alreadyPulled, pulledIds],
    );
    const [newTimezone, setNewTimezone] = useState<string | null>(
      timezone ?? user?.timezone ?? null,
    );
    const [newTimezonePlace, setNewTimezonePlace] = useState<string | null>(timezonePlace);
    const [showTimezone, setShowTimezone] = useState(!!timezone);
    const [isAutoTimezone, setIsAutoTimezone] = useState(false);
    const [pickingPlace, setPickingPlace] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorApiRef = useRef<TextAreaTextApi | null>(null);

    const { uploadInlineImage, isUploading } = useImageUpload();
    const { showToast } = useToastContext();
    const { activeEditorTip, dismissTip, completeTutorial } = useTutorial();

    const { addNewLogPost, editLogPost } = useLogPostQuery();
    const isSaving = type === "new" ? addNewLogPost.isLoading : editLogPost.isLoading;

    const imageUploadCommand = useMemo(
      () => ({
        ...commands.image,
        execute: (_state: ExecuteState, api: TextAreaTextApi) => {
          editorApiRef.current = api;
          fileInputRef.current?.click();
        },
      }),
      [],
    );

    const handleInlineImageSelected = async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const api = editorApiRef.current;
      if (!api) return;

      try {
        const url = await uploadInlineImage(file, groupId);
        api.replaceSelection(`![image](${url})`);
      } catch (err) {
        if (!(err instanceof ImageValidationError)) {
          reportError(err, { feature: "log_post", action: "upload_inline_image" });
        }
        showToast(err instanceof Error ? err.message : "Image upload failed. Please try again.");
      }
    };

    const rowCurrencies = rows.map((r) => r.currency);
    const primaryCurrency = rows[0].currency;

    const updateRow = (index: number, patch: Partial<AmountRow<Currency>>) =>
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

    const handleSelectCurrency = (index: number) => (e: ChangeEvent<HTMLSelectElement>) => {
      // The first row is the one new posts start on next time.
      if (index === 0) storage.set(LAST_CURRENCY_KEY, e.target.value);
      updateRow(index, { currency: e.target.value as Currency });
    };

    const unusedCurrency = CURRENCIES.find((c) => !rowCurrencies.includes(c));

    const handleAddRow = () => {
      if (unusedCurrency) setRows((prev) => [...prev, { currency: unusedCurrency, amount: 0 }]);
    };

    const handleRemoveRow = (index: number) =>
      setRows((prev) => prev.filter((_, i) => i !== index));

    const handlePulled = ({ markdown, totals, entryIds, ledgerCount }: PulledSpending) => {
      newEntryContentSet((prev) => appendPulled(prev ?? "", markdown));
      setRows((prev) => mergeIntoRows(prev, totals));
      setPulledIds((prev) => [...new Set([...prev, ...entryIds])]);
      track("pull_ledger_spending", { ledgers: ledgerCount, entries: entryIds.length });
    };

    const resetRows = () => setRows([{ currency: postStartCurrency(user), amount: 0 }]);

    const handleNewLogPost = async () => {
      if (!newEntryContent) {
        return;
      }

      try {
        await addNewLogPost.mutate({
          groupId,
          userId,
          logData: {
            amounts: normaliseAmounts(rows),
            currency: primaryCurrency,
            content: newEntryContent,
            postDate: newEntryDate,
            pulledEntryIds: pulledIds,
            timezone: newTimezone ?? undefined,
            timezonePlace: newTimezone ? newTimezonePlace : null,
          },
        });

        track("add_post", { travelling: !!newTimezone });

        clearPostDraft();
        completeTutorial();

        isCreateNewEntrySet(false);
        newEntryContentSet(null);
        resetRows();
        setPulledIds([]);
      } catch (err) {
        reportError(err, { feature: "log_post", action: "create_post" });
      }
    };

    const handleEditPost = async () => {
      if (!postId || !newEntryContent) {
        return;
      }

      try {
        await editLogPost.mutate({
          postId,
          logData: {
            // Untouched rows aren't written back, so a text-only edit can't change
            // the stored amounts (e.g. by rounding or reordering them).
            amounts: sameRows(rows, initialRows) ? undefined : normaliseAmounts(rows),
            currency: primaryCurrency,
            content: newEntryContent,
            postDate: newEntryDate,
            pulledEntryIds: pulledIds,
            // null clears a travelling zone back to the profile's.
            timezone: newTimezone,
            timezonePlace: newTimezone ? newTimezonePlace : null,
          },
        });

        isCreateNewEntrySet(false);
        setCurrentlyEditingPostId(null);
        newEntryContentSet(null);
        resetRows();
      } catch (err) {
        reportError(err, { feature: "log_post", action: "edit_post" });
      }
    };

    // The post's day where it's filed: its own zone, else the profile's, else this device's.
    const pickerDay = dayjs(newEntryDate)
      .tz(newTimezone ?? user?.timezone ?? dayjs.tz.guess())
      .format("YYYY-MM-DD");

    const handleClickCalculator = (index: number) => {
      if (!newEntryContent) return;
      const total = sumAmountsIn(newEntryContent, rows[index].currency, rowCurrencies);
      if (total !== undefined) updateRow(index, { amount: total });
    };

    const handleEditorChange = (value?: string) => {
      newEntryContentSet(value ?? null);
    };

    const handlePickPlace = (place: Place) => {
      setNewTimezone(place.timezone);
      // Posts show the short city name ("Kyoto · GMT+9").
      setNewTimezonePlace(place.kind === "city" ? place.name : null);
      setShowTimezone(true);
      setIsAutoTimezone(false);
      setPickingPlace(false);
    };

    const handleClearPlace = () => {
      setNewTimezone(null);
      setNewTimezonePlace(null);
      setIsAutoTimezone(false);
      setPickingPlace(false);
    };

    useEffect(() => {
      if (!newTimezone) {
        setShowTimezone(false);
      }
    }, [newTimezone]);

    useEffect(() => {
      if (!timezone) {
        const detectedTimezone =
          type === "new" ? getAutoPostTimezone(user?.timezone, newEntryDate) : null;

        if (detectedTimezone) {
          setNewTimezone(detectedTimezone);
          setNewTimezonePlace(null);
          setShowTimezone(true);
          setIsAutoTimezone(true);
        } else {
          setShowTimezone(false);
          setNewTimezone(null);
        }
      }

      // New posts start on this device's last-used currency, else the user's default,
      // unless they're a restored draft's.
      if (type == "new" && !draft?.rows) {
        setRows([{ currency: postStartCurrency(user), amount: 0 }]);
      }
    }, []);

    useEffect(() => {
      if (type === "new" && newEntryContent !== null && authUid) {
        if (newEntryContent.trim() === "") {
          clearPostDraft();
        } else {
          writePostDraft(authUid, { content: newEntryContent, rows, pulledIds });
        }
      }
    }, [newEntryContent, rows, pulledIds, type, authUid]);

    return (
      <div
        className={cx("LogPostEditor LogPosts__posts__item LogPosts__posts__item--selected", {
          "LogPosts__posts__item--first": isPinned,
          "LogPostEditor--uploading": isUploading,
        })}
        ref={ref}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="LogPostEditor__file-input"
          onChange={handleInlineImageSelected}
        />
        {isPulling && ledgers && authUid && (
          <PullSpendingModal
            ledgers={ledgers}
            uid={authUid}
            authorDocId={user?.id}
            groupId={groupId}
            day={pickerDay}
            alreadyPulled={pulledAnywhere}
            onClose={() => setIsPulling(false)}
            onAdd={handlePulled}
          />
        )}
        <div className="LogPosts__posts__item__header">
          <div className="LogPosts__posts__item__header__left">
            <div style={{ position: "relative" }}>
              {activeEditorTip === "timezone" && (
                <TutorialTooltip
                  text="Travelling? You can set a timezone specific to this post if it's different from the one set in your profile. If your device's timezone differs from your profile, it's set automatically"
                  onDismiss={dismissTip}
                  position="bottom"
                />
              )}
              <button
                type="button"
                className="LogPostEditor__placeToggle"
                aria-label="Set where this post was written"
                aria-expanded={pickingPlace}
                title="Set where this post was written"
                onClick={() => setPickingPlace((v) => !v)}
              >
                <Icon type={"location"} />
              </button>
            </div>
            <div style={{ position: "relative" }}>
              {activeEditorTip === "date" && (
                <TutorialTooltip
                  text="You can set the backdate and time of this log or leave it at the current time as default"
                  onDismiss={dismissTip}
                  position="bottom"
                />
              )}
              <input
                type="datetime-local"
                id="meeting-time"
                name="meeting-time"
                value={dayjs(newEntryDate).format("YYYY-MM-DDTHH:mm")}
                onChange={(e) =>
                  newEntryDateSet(dayjs(e?.target?.value, "YYYY-MM-DDTHH:mm").unix() * 1000)
                }
              />
            </div>
          </div>
          <div
            className="LogPosts__posts__item__header__center LogPosts__posts__item__amount"
            style={{ position: "relative" }}
          >
            {activeEditorTip === "currency" && (
              <TutorialTooltip
                text="Enter your total amount spent in this entry here. You can adjust the currency, and add a row for each other currency you spent in. Hint: If you've consistently formatted expense amounts in your entry (like ¥1,200 or 1,200 JPY), the calculator icon may sum it up for you automatically!"
                onDismiss={dismissTip}
                position="bottom"
              />
            )}
            <div className="LogPostEditor__amounts">
              {rows.map((row, i) => (
                <div className="LogPostEditor__amountRow" key={i}>
                  <input
                    type="number"
                    aria-label={`amount in ${row.currency}`}
                    onChange={(e) => updateRow(i, { amount: Number(e?.target?.value) })}
                    value={row.amount}
                    className="LogPostsCurrency__input"
                  />
                  <select
                    name="currency"
                    id={i === 0 ? "newEntry-currency" : undefined}
                    aria-label="currency"
                    onChange={handleSelectCurrency(i)}
                    value={row.currency}
                  >
                    {CURRENCIES.filter((c) => c === row.currency || !rowCurrencies.includes(c)).map(
                      (x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ),
                    )}
                  </select>
                  <Icon type={"calculator"} onClick={() => handleClickCalculator(i)} />
                  {i > 0 && (
                    <RowButton
                      glyph
                      aria-label={`remove ${row.currency}`}
                      title={`remove ${row.currency}`}
                      onClick={() => handleRemoveRow(i)}
                    >
                      ×
                    </RowButton>
                  )}
                </div>
              ))}
              <div className="LogPostEditor__amountActions">
                {unusedCurrency && <RowButton onClick={handleAddRow}>+ currency</RowButton>}
                {hasLedgers && (
                  <RowButton
                    onClick={() => setIsPulling(true)}
                    title="copy your spending from your financial logs into this post"
                  >
                    pull from logs
                  </RowButton>
                )}
              </div>
            </div>
          </div>
          <div className="LogPosts__posts__item__header__right LogPosts__posts__item__comments">
            <Button
              variant="secondary"
              size="sm"
              text={"×"}
              aria-label="Close"
              title="Close"
              disabled={isSaving}
              onClick={
                type === "new"
                  ? () => isCreateNewEntrySet(false)
                  : () => setCurrentlyEditingPostId(null)
              }
            />
          </div>
        </div>
        {pickingPlace ? (
          <div className="LogPosts__posts__item__header LogPostEditor__place">
            <PlacePicker
              compact
              autoFocus
              label="Written in"
              placeholder="Type a city"
              timezone={newTimezone}
              place={newTimezone ? (newTimezonePlace ?? cityFromZone(newTimezone)) : null}
              onChange={handlePickPlace}
            />
            <RowButton onClick={() => setPickingPlace(false)}>Done</RowButton>
          </div>
        ) : (
          showTimezone &&
          newTimezone && (
            <div className="LogPosts__posts__item__header">
              <div className="LogPosts__posts__item__header__left">
                <div className="TimezoneSetter keep-case">
                  {postZoneLabel(newTimezone, newTimezonePlace, newEntryDate)}
                  {isAutoTimezone && " (auto-detected)"}
                </div>
                <RowButton
                  glyph
                  aria-label="Use my profile timezone"
                  title="Use my profile timezone"
                  onClick={handleClearPlace}
                >
                  ×
                </RowButton>
              </div>
            </div>
          )
        )}
        <div className="LogPosts__posts__item__body" style={{ position: "relative" }}>
          {activeEditorTip === "body" && (
            <TutorialTooltip
              text="Enter your first log here! Some people like to post short logs throughout their day, others like to do a long post at the end of the day. It's up to you!"
              onDismiss={dismissTip}
              position="center"
            />
          )}
          <div
            className="LogPosts__posts__item__content container"
            data-color-mode={markdownColorMode(theme)}
          >
            <div className="LogPosts__posts__item__content__editor">
              <MDEditor
                value={newEntryContent ?? ""}
                onChange={handleEditorChange}
                preview="edit"
                commands={[
                  commands.bold,
                  commands.italic,
                  commands.strikethrough,
                  commands.hr,
                  commands.title,
                  commands.divider,
                  commands.link,
                  commands.quote,
                  commands.code,
                  commands.codeBlock,
                  commands.comment,
                  imageUploadCommand,
                  commands.divider,
                  commands.unorderedListCommand,
                  commands.orderedListCommand,
                  commands.checkedListCommand,
                  commands.divider,
                  commands.help,
                ]}
              />
              <Markdown source={newEntryContent ?? ""} />
            </div>
          </div>
        </div>
        <div className="LogPosts__posts__item__footer" style={{ position: "relative" }}>
          {activeEditorTip === "submit" && (
            <TutorialTooltip
              text="Submit your first log entry!"
              onDismiss={dismissTip}
              position="top"
              pointAt=".Button"
            />
          )}
          <Button
            variant="primary"
            size="sm"
            text="Submit"
            // An image still uploading lands in the text when it's done: wait for it.
            disabled={!newEntryContent || isUploading}
            loading={isSaving}
            onClick={type === "new" ? handleNewLogPost : handleEditPost}
          />
        </div>
      </div>
    );
  },
);

export default LogPostEditor;
