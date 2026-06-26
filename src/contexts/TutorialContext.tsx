import { createContext, useContext, PropsWithChildren, useState } from "react";

const STORAGE_KEY = "ML__tutorial_complete";

type TutorialContextValue = {
  isTutorialActive: boolean;
  showNewEntryTip: boolean;
  editorTipsActive: boolean;
  isTipDismissed: (key: string) => boolean;
  onNewEntryClicked: () => void;
  dismissNewEntryTip: () => void;
  dismissTip: (key: string) => void;
  completeTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const TutorialProvider = ({ children }: PropsWithChildren) => {
  const [complete, setComplete] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [newEntryTipDismissed, setNewEntryTipDismissed] = useState(false);
  const [editorTipsActive, setEditorTipsActive] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

  const isTutorialActive = !complete;
  const showNewEntryTip = isTutorialActive && !newEntryTipDismissed;

  const dismissNewEntryTip = () => setNewEntryTipDismissed(true);

  const onNewEntryClicked = () => {
    setNewEntryTipDismissed(true);
    if (!complete) setEditorTipsActive(true);
  };

  const dismissTip = (key: string) => setDismissedTips((prev) => new Set([...prev, key]));

  const completeTutorial = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setComplete(true);
    setEditorTipsActive(false);
  };

  const isTipDismissed = (key: string) => dismissedTips.has(key);

  return (
    <TutorialContext.Provider
      value={{
        isTutorialActive,
        showNewEntryTip,
        editorTipsActive,
        isTipDismissed,
        onNewEntryClicked,
        dismissNewEntryTip,
        dismissTip,
        completeTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
};
