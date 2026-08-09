import { createServer, type Server } from 'node:net'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ipcPortPath } from './paths'

/**
 * Localhost socket the browser native-messaging shim uses to hand URLs to a
 * already-running instance, bypassing xdg-open and the single-instance path.
 *
 * The wire format is unchanged from the Tauri build: bind an ephemeral port,
 * write it to `<config>/kitsune-dm/ipc.port`, and treat everything a client
 * sends before EOF as a single URL. kitsune-shim is therefore unmodified by the
 * Electron migration.
 */
export class ShimBridge {
  private server: Server | null = null

  start(onUrl: (url: string) => void): void {
    const server = createServer((socket) => {
      const chunks: Buffer[] = []
      // No encoding is set on the socket, so `data` is always a Buffer here.
      socket.on('data', (chunk: Buffer) => chunks.push(chunk))
      socket.on('end', () => {
        const url = Buffer.concat(chunks).toString('utf8').trim()
        if (url) onUrl(url)
      })
      socket.on('error', (err) => console.error('[shim-bridge] socket error:', err.message))
    })

    server.on('error', (err) => console.error('[shim-bridge] server error:', err.message))

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') return

      const portFile = ipcPortPath()
      try {
        mkdirSync(dirname(portFile), { recursive: true })
        writeFileSync(portFile, String(address.port))
        console.log(`[shim-bridge] listening on 127.0.0.1:${address.port}`)
      } catch (err) {
        console.error('[shim-bridge] could not write port file:', err)
      }
    })

    this.server = server
  }

  /**
   * Remove the port file on shutdown. A stale file makes the shim dial a dead
   * port and fail with ECONNREFUSED instead of falling back to launching the app.
   */
  stop(): void {
    this.server?.close()
    this.server = null
    try {
      rmSync(ipcPortPath(), { force: true })
    } catch {
      /* best effort */
    }
  }
}
