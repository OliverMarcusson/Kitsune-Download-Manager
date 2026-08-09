import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Mirrors the Rust `dirs::config_dir()` used by kitsune-shim and by the previous
 * Tauri app. We deliberately do NOT use Electron's `app.getPath('userData')`:
 * that resolves to a product-named directory, and the shim looks for
 * `<config>/kitsune-dm/ipc.port` at a fixed location. Diverging here would
 * silently break the browser integration and orphan existing state.json files.
 */
export function configDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support')
  }
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

export function kitsuneConfigDir(): string {
  return join(configDir(), 'kitsune-dm')
}

export function ipcPortPath(): string {
  return join(kitsuneConfigDir(), 'ipc.port')
}

export function stateFilePath(): string {
  return join(kitsuneConfigDir(), 'state.json')
}
