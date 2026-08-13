import {
  Archive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  HardDrive,
  Package,
  type LucideIcon,
} from "lucide-react"

/**
 * Maps a filename to the icon and tint used on its row. Purely cosmetic — an
 * unknown extension falls through to the neutral Package icon.
 */
interface FileKind {
  icon: LucideIcon
  /** Tailwind classes for the icon tile: text colour plus a matching wash. */
  className: string
}

const KINDS: Array<{ extensions: string[]; kind: FileKind }> = [
  {
    extensions: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst"],
    kind: { icon: Archive, className: "text-amber-400 bg-amber-400/10" },
  },
  {
    extensions: ["mp4", "mkv", "avi", "mov", "webm", "flv", "m4v"],
    kind: { icon: FileVideo, className: "text-rose-400 bg-rose-400/10" },
  },
  {
    extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"],
    kind: { icon: FileAudio, className: "text-fuchsia-400 bg-fuchsia-400/10" },
  },
  {
    extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"],
    kind: { icon: FileImage, className: "text-emerald-400 bg-emerald-400/10" },
  },
  {
    extensions: ["pdf", "doc", "docx", "txt", "md", "epub", "odt"],
    kind: { icon: FileText, className: "text-sky-400 bg-sky-400/10" },
  },
  {
    extensions: ["iso", "img", "dmg", "vdi", "qcow2"],
    kind: { icon: HardDrive, className: "text-cyan-400 bg-cyan-400/10" },
  },
  {
    extensions: ["exe", "msi", "deb", "rpm", "appimage", "pkg", "apk", "snap"],
    kind: { icon: Package, className: "text-violet-400 bg-violet-400/10" },
  },
  {
    extensions: ["js", "ts", "json", "xml", "html", "css", "py", "rs", "sh", "yml", "yaml"],
    kind: { icon: FileCode, className: "text-teal-400 bg-teal-400/10" },
  },
]

const FALLBACK: FileKind = { icon: Package, className: "text-muted-foreground bg-muted" }

export function fileKind(filename: string): FileKind {
  const extension = filename.split(".").pop()?.toLowerCase() ?? ""
  if (!extension) return FALLBACK

  return KINDS.find((entry) => entry.extensions.includes(extension))?.kind ?? FALLBACK
}
