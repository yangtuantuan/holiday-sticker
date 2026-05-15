import { appendFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

class Logger {
  private _logPath: string | null = null

  private _ensurePath(): string {
    if (!this._logPath) {
      const userData = app.getPath('userData')
      this._logPath = join(userData, 'error.log')
    }
    return this._logPath
  }

  private _write(level: string, msg: string, err?: unknown): void {
    const ts = new Date().toISOString()
    const errInfo = err ? `\n${err instanceof Error ? err.stack || err.message : String(err)}` : ''
    const line = `[${ts}] [${level}] ${msg}${errInfo}\n`
    console.error(line.trim())
    try {
      appendFileSync(this._ensurePath(), line, 'utf-8')
    } catch {
      // ignore file write errors
    }
  }

  info(msg: string): void { this._write('INFO', msg) }
  warn(msg: string, err?: unknown): void { this._write('WARN', msg, err) }
  error(msg: string, err?: unknown): void { this._write('ERROR', msg, err) }
}

export default new Logger()
