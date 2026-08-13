import { Plus } from "lucide-react"

import logoUrl from "@/assets/logo.png"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title: string
  description: string
  /** Omitted for the filtered views, where "add a download" is not the fix. */
  onAdd?: () => void
}

export function EmptyState({ title, description, onAdd }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl" />
        <img src={logoUrl} alt="" className="h-20 w-20 object-contain opacity-70" />
      </div>

      <p className="font-medium">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>

      {onAdd && (
        <Button onClick={onAdd} className="mt-5">
          <Plus />
          Add download
        </Button>
      )}
    </div>
  )
}
