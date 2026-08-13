import { useCallback, useEffect, useState } from "react"

/**
 * User preferences. These live in the renderer's localStorage rather than in
 * state.json: they are UI defaults only, and nothing in the main process or the
 * sidecar needs to read them.
 */
export interface Settings {
  /** Connection count pre-selected for a new download. */
  defaultConnections: number
  /** Overrides the OS downloads folder when set. */
  saveDirectory: string | null
  /** Fetch metadata as soon as a URL arrives, instead of waiting for "Fetch". */
  autoFetchMetadata: boolean
  /** Ask before the destructive "delete files" removal. */
  confirmDelete: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  defaultConnections: 8,
  saveDirectory: null,
  autoFetchMetadata: true,
  confirmDelete: true,
}

const STORAGE_KEY = "kitsune.settings"

function readSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    // Spread over the defaults so a settings file written by an older build
    // still gets sane values for keys added since.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(readSettings)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* Storage being unavailable must not take the UI down. */
    }
  }, [settings])

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  return { settings, updateSetting, resetSettings }
}
