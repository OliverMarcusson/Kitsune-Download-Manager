/// <reference types="vite/client" />

import type { KitsuneApi } from '../../preload'

declare global {
  interface Window {
    kitsune: KitsuneApi
  }
}

export {}
