"use client";

import { useState } from "react";
import { Moon, Sun, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { clearStorage } from "@/lib/storage";
import { workspaceActions } from "@/lib/workspace-store";
import { useIde } from "./ide-context";
import { LocaleLinks } from "./locale-links";

export function SettingsDialog() {
  const t = useTranslations("settings");
  const { settingsOpen, setSettingsOpen } = useIde();
  const { theme, persistInputs } = useWorkspace();
  const [cleared, setCleared] = useState(false);

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(open) => {
        setSettingsOpen(open);
        if (!open) setCleared(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t("theme")}</h3>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("theme")}>
              {(["dark", "light"] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={theme === v}
                  variant={theme === v ? "secondary" : "outline"}
                  className={theme === v ? "ring-1 ring-primary" : undefined}
                  onClick={() => workspaceActions.setTheme(v)}
                >
                  {v === "dark" ? <Moon aria-hidden /> : <Sun aria-hidden />}
                  {t(v)}
                </Button>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t("language")}</h3>
            <LocaleLinks className="grid-cols-2" onNavigate={() => setSettingsOpen(false)} />
          </section>
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="persist-inputs">{t("persist")}</Label>
                <p className="text-xs leading-5 text-muted-foreground">{t("persistHint")}</p>
              </div>
              <Switch
                id="persist-inputs"
                checked={persistInputs}
                onCheckedChange={(v) => workspaceActions.setPersistInputs(v)}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                clearStorage();
                workspaceActions.reset();
                setCleared(true);
              }}
            >
              <Trash2 aria-hidden />
              {cleared ? t("cleared") : t("clearData")}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
