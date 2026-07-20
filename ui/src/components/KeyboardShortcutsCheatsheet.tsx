import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

interface ShortcutEntry {
  keys: string[];
  label: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  "then" sequence. */
  combo?: boolean;
}

// Platform-appropriate label for the Cmd/Ctrl modifier so the cheatsheet shows
// the same key the user actually presses (re-pointed in the collapsible sidebar
// work — Cmd/Ctrl+B toggles the rail).
function getPlatformLabel() {
  if (typeof navigator === "undefined") return "";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.userAgent || "";
}

const META_KEY = /Mac|iPhone|iPad|iPod/.test(getPlatformLabel()) ? "⌘" : "Ctrl";

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-line-border)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  const { t } = useTranslation();
  const sections: ShortcutSection[] = [
    {
      title: t("ui.keyboardShortcuts.sections.inbox"),
      shortcuts: [
        { keys: ["j"], label: t("ui.keyboardShortcuts.actions.moveDown") },
        { keys: ["↓"], label: t("ui.keyboardShortcuts.actions.moveDown") },
        { keys: ["k"], label: t("ui.keyboardShortcuts.actions.moveUp") },
        { keys: ["↑"], label: t("ui.keyboardShortcuts.actions.moveUp") },
        { keys: ["←"], label: t("ui.keyboardShortcuts.actions.collapseSelectedGroup") },
        { keys: ["→"], label: t("ui.keyboardShortcuts.actions.expandSelectedGroup") },
        { keys: ["Enter"], label: t("ui.keyboardShortcuts.actions.openSelectedItem") },
        { keys: ["a"], label: t("ui.keyboardShortcuts.actions.archiveItem") },
        { keys: ["y"], label: t("ui.keyboardShortcuts.actions.archiveItem") },
        { keys: ["r"], label: t("ui.keyboardShortcuts.actions.markAsRead") },
        { keys: ["U"], label: t("ui.keyboardShortcuts.actions.markAsUnread") },
      ],
    },
    {
      title: t("ui.keyboardShortcuts.sections.taskDetail"),
      shortcuts: [
        { keys: ["y"], label: t("ui.keyboardShortcuts.actions.quickArchiveBackToInbox") },
        { keys: ["g", "i"], label: t("ui.keyboardShortcuts.actions.goToInbox") },
        { keys: ["g", "c"], label: t("ui.keyboardShortcuts.actions.focusCommentComposer") },
      ],
    },
    {
      title: t("ui.keyboardShortcuts.sections.decisions"),
      shortcuts: [
        { keys: ["j"], label: t("ui.keyboardShortcuts.actions.moveDown") },
        { keys: ["↓"], label: t("ui.keyboardShortcuts.actions.moveDown") },
        { keys: ["k"], label: t("ui.keyboardShortcuts.actions.moveUp") },
        { keys: ["↑"], label: t("ui.keyboardShortcuts.actions.moveUp") },
        { keys: ["Enter"], label: t("ui.keyboardShortcuts.actions.openOrCloseDecision") },
        { keys: ["x"], label: t("ui.keyboardShortcuts.actions.dismissDecision") },
      ],
    },
    {
      title: t("ui.keyboardShortcuts.sections.global"),
      shortcuts: [
        { keys: ["/"], label: t("ui.keyboardShortcuts.actions.searchCurrentPage") },
        { keys: ["c"], label: t("ui.keyboardShortcuts.actions.newTask") },
        { keys: ["["], label: t("ui.keyboardShortcuts.actions.toggleSidebar") },
        { keys: [META_KEY, "B"], label: t("ui.keyboardShortcuts.actions.collapseOrExpandSidebar"), combo: true },
        { keys: ["]"], label: t("ui.keyboardShortcuts.actions.togglePanel") },
        { keys: ["?"], label: t("ui.keyboardShortcuts.actions.showKeyboardShortcuts") },
      ],
    },
  ];
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : t("ui.keyboardShortcuts.then")}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {t("ui.keyboardShortcuts.press")} <KeyCap>Esc</KeyCap> {t("ui.keyboardShortcuts.toClose")} &middot; {t("ui.keyboardShortcuts.disabledInTextFields")}
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t("ui.keyboardShortcuts.title")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
