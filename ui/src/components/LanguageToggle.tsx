import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { i18n, useTranslation } from "@/i18n";

type LanguageToggleVariant = "icon" | "menu-action";

interface LanguageToggleProps {
  className?: string;
  variant?: LanguageToggleVariant;
  onAfterToggle?: () => void;
}

export function LanguageToggle({ className, variant = "icon", onAfterToggle }: LanguageToggleProps) {
  const { t } = useTranslation();
  const isChinese = i18n.resolvedLanguage === "zh-CN";
  const label = isChinese ? t("ui.language.switchToEnglish") : t("ui.language.switchToChinese");

  function handleClick() {
    void i18n.changeLanguage(isChinese ? "en" : "zh-CN");
    onAfterToggle?.();
  }

  if (variant === "menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{t("ui.language.description")}</span>
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground", className)}
    >
      <Languages />
    </Button>
  );
}
