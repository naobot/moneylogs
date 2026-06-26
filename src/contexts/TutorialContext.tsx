import { createContext, useContext, PropsWithChildren, useState } from "react";

const STORAGE_KEY = "ML__tutorial_complete";

export const EDITOR_TIP_KEYS = ["date", "timezone", "body", "currency", "submit"] as const;

type TutorialContextValue = {
  isTutorialActive: boolean;
  showNewEntryTip: boolean;
  editorTipsActive: boolean;
  activeEditorTip: string | null;
  onNewEntryClicked: () => void;
  dismissNewEntryTip: () => void;
  dismissTip: () => void;
  completeTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const TutorialProvider = ({ children }: PropsWithChildren) => {
  const [complete, setComplete] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [newEntryTipDismissed, setNewEntryTipDismissed] = useState(false);
  const [editorTipsActive, setEditorTipsActive] = useState(false);
  const [editorStep, setEditorStep] = useState(0);

  const isTutorialActive = !complete;
  const showNewEntryTip = isTutorialActive && !newEntryTipDismissed;
  const activeEditorTip =
    editorTipsActive && editorStep < EDITOR_TIP_KEYS.length ? EDITOR_TIP_KEYS[editorStep] : null;

  const dismissNewEntryTip = () => setNewEntryTipDismissed(true);

  const onNewEntryClicked = () => {
    setNewEntryTipDismissed(true);
    if (!complete) {
      setEditorStep(0);
      setEditorTipsActive(true);
    }
  };

  const dismissTip = () => setEditorStep((prev) => prev + 1);

  const completeTutorial = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setComplete(true);
    setEditorTipsActive(false);
  };

  return (
    <TutorialContext.Provider
      value={{
        isTutorialActive,
        showNewEntryTip,
        editorTipsActive,
        activeEditorTip,
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
