/** Byte/duration formatting shared by every view that shows download figures. */

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return "0 B"

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  // Bytes are always whole; everything above gets one decimal, GB and up two.
  const decimals = unit === 0 ? 0 : unit >= 3 ? 2 : 1
  return `${value.toFixed(decimals)} ${UNITS[unit]}`
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "—"
  if (seconds < 1) return "< 1s"
  if (seconds < 60) return `${Math.round(seconds)}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** "3 minutes ago" style stamp for the completed/failed rows. */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString()
}

/** Strips the scheme and any path so a long URL still reads as its source. */
export function formatHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
