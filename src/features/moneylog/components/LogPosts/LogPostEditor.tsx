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
import { allTimezones, useTimezoneSelect } from "react-timezone-select";

import { useCurrentUser } from "@/contexts";
import { Currency } from "@/types/user";
import { useLogPostQuery } from "@/hooks/useLogPostQuery";
import { useReadTracking } from "@/hooks/useReadTracking";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToastContext } from "@/hooks/useToastContext";
import TutorialTooltip from "@/components/TutorialTooltip";
import { useTutorial } from "@/contexts/TutorialContext";

import Button from "@/components/Button";
import Icon from "@/components/Icon";

import { CURRENCIES } from "./LogPosts";
import CustomDropdown, { DropdownOption } from "@/components/CustomDropdown";

const DRAFT_KEY = "ML__logPostDraft";

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
      amount = 0,
      timezone = null,
      currency = "JPY" as Currency,
      date = Date.now(),
    }: {
      type: "edit" | "new";
      postId?: string | null;
      groupId: string;
      userId: string;
      isCreateNewEntrySet: Dispatch<SetStateAction<boolean>>;
      setCurrentlyEditingPostId: Dispatch<SetStateAction<string | null>>;
      content?: string | null;
      amount?: number;
      currency?: Currency;
      date?: number;
      isPinned?: boolean;
      timezone?: string | null;
    },
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const { user } = useCurrentUser();

    const [newEntryContent, newEntryContentSet] = useState<string | null>(() => {
      if (type === "new") {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        return savedDraft || "";
      }
      return content;
    });
    const [newEntryAmount, newEntryAmountSet] = useState<number>(amount);
    const [newEntryDate, newEntryDateSet] = useState<number>(date);
    const [selectedCurrency, selectedCurrencySet] = useState<Currency>(currency);
    const [newTimezone, setNewTimezone] = useState<string | null>(
      timezone ?? user?.timezone ?? null,
    );
    const [showTimezone, setShowTimezone] = useState(!!timezone);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorApiRef = useRef<TextAreaTextApi | null>(null);

    const { options, parseTimezone } = useTimezoneSelect({
      labelStyle: "original",
      timezones: allTimezones,
    });

    const { trackUserAction } = useReadTracking();
    const { uploadInlineImage, isUploading } = useImageUpload();
    const { showToast } = useToastContext();
    const { activeEditorTip, dismissTip, completeTutorial } = useTutorial();

    const regexMatcher = useMemo(() => {
      switch (selectedCurrency) {
        case "JPY":
        case "CNY":
          return /-?([¥￥])-?(\d+,)*\d+万?/g;
        case "USD":
        case "CAD":
        case "NTD":
        case "AUD":
          return /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g;
        case "KRW":
          return /-?(₩)-?(\d+,)*\d+k?/g;
        case "EUR":
          return /-?(€)-?(\d+,)*\d+(\.\d\d)?/g;
        case "GBP":
          return /-?(£)-?(\d+,)*\d+(\.\d\d)?/g;
        case "MYR":
          return /-?(\d+,)*\d+(?=\w?RM)/g;
        default:
          return;
      }
    }, [selectedCurrency]);

    const { addNewLogPost, editLogPost } = useLogPostQuery();

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
        console.error("Failed to upload image:", err);
        showToast("Image upload failed. Please try again.");
      }
    };

    const handleSelectCurrency = (e: ChangeEvent<HTMLSelectElement>) => {
      localStorage.setItem("ML__lastCurrency", e.target.value);
      selectedCurrencySet(e.target.value as Currency);
    };

    const handleNewLogPost = async () => {
      if (!selectedCurrency || !newEntryContent) {
        return;
      }

      try {
        await addNewLogPost.mutate({
          groupId,
          userId,
          logData: {
            amount: newEntryAmount,
            currency: selectedCurrency,
            content: newEntryContent,
            postDate: newEntryDate,
            timezone: newTimezone ?? undefined,
          },
        });

        trackUserAction("new_comment", {
          user_id: userId,
          post_id: postId,
        });

        localStorage.removeItem(DRAFT_KEY);
        completeTutorial();

        isCreateNewEntrySet(false);
        newEntryContentSet(null);
        newEntryAmountSet(0);
      } catch (err) {
        console.error("Failed to create log post:", err);
      }
    };

    const handleEditPost = async () => {
      if (!postId || !selectedCurrency || !newEntryContent) {
        return;
      }

      try {
        await editLogPost.mutate({
          postId,
          logData: {
            amount: newEntryAmount,
            currency: selectedCurrency,
            content: newEntryContent,
            postDate: newEntryDate,
            timezone: newTimezone ?? undefined,
          },
        });

        isCreateNewEntrySet(false);
        setCurrentlyEditingPostId(null);
        newEntryContentSet(null);
        newEntryAmountSet(0);
      } catch (err) {
        console.error("Failed to create log post:", err);
      }
    };

    const handleClickCalculator = () => {
      if (newEntryContent && selectedCurrency && regexMatcher) {
        const foundAmounts = newEntryContent.match(regexMatcher);

        const foundTotal = foundAmounts
          ?.map((x) =>
            Number(
              x
                .replaceAll(/[¥￥$₩€£,]/g, "")
                .replaceAll("k", "000")
                .replaceAll("万", "0000"),
            ),
          )
          .reduce((a, b) => a + b)
          .toFixed(2);

        if (foundTotal) {
          newEntryAmountSet(Number(foundTotal));
        }
      }
    };

    const handleEditorChange = (value?: string) => {
      newEntryContentSet(value ?? null);
    };

    const handleClickLocation = (option: DropdownOption) => {
      setNewTimezone(option.value);
      setShowTimezone(true);
    };

    useEffect(() => {
      if (!newTimezone) {
        setShowTimezone(false);
      }
    }, [newTimezone]);

    useEffect(() => {
      if (!timezone) {
        setShowTimezone(false);
        setNewTimezone(null);
      }

      const lastCurrency = localStorage.getItem("ML__lastCurrency") as Currency;

      if (type == "new" && lastCurrency && CURRENCIES.includes(lastCurrency)) {
        selectedCurrencySet(lastCurrency as Currency);
      }
    }, []);

    useEffect(() => {
      if (type === "new" && newEntryContent !== null) {
        if (newEntryContent.trim() === "") {
          localStorage.removeItem(DRAFT_KEY);
        } else {
          localStorage.setItem(DRAFT_KEY, newEntryContent);
        }
      }
    }, [newEntryContent, type]);

    return (
      <div
        className={cx("LogPosts__posts__item LogPosts__posts__item--selected", {
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
        <div className="LogPosts__posts__item__header">
          <div className="LogPosts__posts__item__header__left">
            <div style={{ position: "relative" }}>
              {activeEditorTip === "timezone" && (
                <TutorialTooltip
                  text="Travelling? You can set a timezone specific to this post if it's different from the one set in your profile"
                  onDismiss={dismissTip}
                  position="bottom"
                />
              )}
              <CustomDropdown options={options} onSelect={handleClickLocation}>
                <Icon type={"location"} />
              </CustomDropdown>
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
                text="Enter your total amount spent in this entry here. You can adjust the currency. Hint: If you've consistently formatted expense amounts in your entry, the calculator icon may sum it up for you automatically!"
                onDismiss={dismissTip}
                position="bottom"
              />
            )}
            <input
              type="number"
              onChange={(e) => newEntryAmountSet(Number(e?.target?.value))}
              value={newEntryAmount}
              className="LogPostsCurrency__input"
            />
            <select
              name="currency"
              id="newEntry-currency"
              onChange={handleSelectCurrency}
              value={selectedCurrency}
            >
              {CURRENCIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <Icon type={"calculator"} onClick={handleClickCalculator} />
          </div>
          <div className="LogPosts__posts__item__header__right LogPosts__posts__item__comments">
            <Button
              buttonStyle="primary-border-lite"
              size="sm"
              text={"×"}
              aria-label="Close"
              title="Close"
              onClick={
                type === "new"
                  ? () => isCreateNewEntrySet(false)
                  : () => setCurrentlyEditingPostId(null)
              }
            />
          </div>
        </div>
        {showTimezone && newTimezone && (
          <div className="LogPosts__posts__item__header">
            <div className="LogPosts__posts__item__header__left">
              <div className="TimezoneSetter">{parseTimezone(newTimezone).label}</div>
            </div>
          </div>
        )}
        <div className="LogPosts__posts__item__body" style={{ position: "relative" }}>
          {activeEditorTip === "body" && (
            <TutorialTooltip
              text="Enter your first log here! Some people like to post short logs throughout their day, others like to do a long post at the end of the day. It's up to you!"
              onDismiss={dismissTip}
              position="center"
            />
          )}
          <div className="LogPosts__posts__item__content container" data-color-mode="light">
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
              <MDEditor.Markdown source={newEntryContent ?? ""} />
            </div>
          </div>
        </div>
        <div className="LogPosts__posts__item__footer" style={{ position: "relative" }}>
          {activeEditorTip === "submit" && (
            <TutorialTooltip
              text="Submit your first log entry!"
              onDismiss={dismissTip}
              position="top"
            />
          )}
          <Button
            buttonStyle="primary-border"
            size="sm"
            text="Submit"
            disabled={!selectedCurrency || !newEntryContent || addNewLogPost?.isLoading}
            onClick={type === "new" ? handleNewLogPost : handleEditPost}
          />
        </div>
      </div>
    );
  },
);

export default LogPostEditor;
