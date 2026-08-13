import { FolderOpen, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { Settings } from "@/hooks/useSettings"

const CONNECTION_CHOICES = [1, 2, 4, 8, 16]

function Row({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

interface SettingsViewProps {
  settings: Settings
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  onReset: () => void
}

export function SettingsView({ settings, onUpdate, onReset }: SettingsViewProps) {
  const chooseDirectory = async () => {
    const selected = await window.kitsune.pickDirectory("Choose default download folder")
    if (selected) {
      onUpdate("saveDirectory", selected)
      toast.success("Default folder updated")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defaults applied to every new download.
        </p>
      </div>

      <Card className="divide-y divide-border">
        <div className="space-y-3 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Default connections</p>
            <p className="text-xs text-muted-foreground">
              How many parts a file is split into. More is usually faster, up to a point.
            </p>
          </div>
          <div className="flex gap-1.5">
            {CONNECTION_CHOICES.map((n) => (
              <button
                key={n}
                onClick={() => onUpdate("defaultConnections", n)}
                className={cn(
                  "flex-1 rounded-md border py-2 text-sm font-medium tabular-nums transition-colors",
                  settings.defaultConnections === n
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Download folder</p>
            <p className="text-xs text-muted-foreground">
              Leave empty to use the system Downloads folder.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={settings.saveDirectory ?? ""}
              placeholder="System Downloads folder"
              onChange={(e) => onUpdate("saveDirectory", e.target.value.trim() || null)}
              className="flex-1 font-mono text-xs"
            />
            <Button variant="secondary" size="icon" onClick={() => void chooseDirectory()}>
              <FolderOpen />
              <span className="sr-only">Browse</span>
            </Button>
          </div>
        </div>

        <Row
          title="Fetch details automatically"
          description="Look up filename and size as soon as a link arrives from the browser."
        >
          <Switch
            checked={settings.autoFetchMetadata}
            onCheckedChange={(checked) => onUpdate("autoFetchMetadata", checked)}
          />
        </Row>

        <Row
          title="Confirm before deleting files"
          description="Ask first when a removal would erase data from disk."
        >
          <Switch
            checked={settings.confirmDelete}
            onCheckedChange={(checked) => onUpdate("confirmDelete", checked)}
          />
        </Row>
      </Card>

      <Separator />

      <div className="flex items-center justify-between gap-6">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Reset settings</p>
          <p className="text-xs text-muted-foreground">
            Restore every preference above to its default.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            onReset()
            toast.success("Settings reset")
          }}
        >
          <RotateCcw />
          Reset
        </Button>
      </div>
    </div>
  )
}
