import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Sonner is themed through its `--normal-*` custom properties rather than
 * classNames so the toasts it renders in its own portal still pick up the app
 * palette.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
