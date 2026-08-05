import { useEffect, useState } from "react";
import { BellRing, Play, Upload, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  defaultPrefs,
  ensureNotificationPermission,
  playRingtone,
  readPrefs,
  unlockAudio,
  writePrefs,
  type RingtonePrefs,
} from "@/lib/ringtone";

const MAX_RINGTONE_BYTES = 512 * 1024;

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<RingtonePrefs>(defaultPrefs);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPrefs(readPrefs());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const update = (patch: Partial<RingtonePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writePrefs(next);
    return next;
  };

  const enableSound = async () => {
    const next = update({ enabled: true });
    const ok = await unlockAudio(next);
    const granted = await ensureNotificationPermission();
    setPermission(granted);
    if (ok) {
      playRingtone(next, 2);
      toast.success("Notification sound enabled on this device");
    } else {
      toast.error("This browser blocked audio playback");
    }
  };

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Pick an audio file (mp3, wav or ogg)");
      return;
    }
    if (file.size > MAX_RINGTONE_BYTES) {
      toast.error("Keep the ringtone under 512 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const next = update({ customSrc: String(reader.result), customName: file.name });
      void unlockAudio(next);
      toast.success(`Ringtone set to ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking alerts</CardTitle>
        <CardDescription>
          Play an audible ringtone on this device when a new booking request arrives. Browsers require a
          one-time tap before sound can play.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!prefs.enabled ? (
          <Button onClick={enableSound} className="w-full sm:w-auto">
            <BellRing className="size-4" /> Enable notification sound
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="mute">Mute during busy hours</Label>
                <p className="text-xs text-muted-foreground">
                  Banners and the badge count keep working while muted.
                </p>
              </div>
              <Switch
                id="mute"
                checked={prefs.muted}
                onCheckedChange={(checked) => update({ muted: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Volume — {Math.round(prefs.volume * 100)}%</Label>
              <Slider
                value={[prefs.volume * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) => update({ volume: (value ?? 0) / 100 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ringtone">Ringtone</Label>
              <p className="text-xs text-muted-foreground">
                {prefs.customName ?? "Built-in chime"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="ringtone" className="cursor-pointer">
                    <Upload className="size-4" /> Upload
                    <input
                      id="ringtone"
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onUpload(file);
                      }}
                    />
                  </label>
                </Button>
                {prefs.customSrc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ customSrc: null, customName: null })}
                  >
                    <VolumeX className="size-4" /> Use built-in chime
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => playRingtone({ ...prefs, muted: false }, 2)}>
                  <Play className="size-4" /> Test
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              System notifications: <span className="font-medium">{permission}</span>
              {permission !== "granted" && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="underline"
                    onClick={async () => setPermission(await ensureNotificationPermission())}
                  >
                    allow banners
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
