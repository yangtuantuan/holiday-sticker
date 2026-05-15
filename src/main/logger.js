const fs = require('fs')
const path = require('path')
const { app } = require('electron')

class Logger {
  constructor() {
    this._logPath = null
  }

  _ensurePath() {
    if (!this._logPath) {
      const userData = app.getPath('userData')
      this._logPath = path.join(userData, 'error.log')
    }
    return this._logPath
  }

  _write(level, msg, err) {
    const ts = new Date().toISOString()
    const errInfo = err ? `\n${err.stack || err.message || err}` : ''
    const line = `[${ts}] [${level}] ${msg}${errInfo}\n`
    console.error(line.trim())
    try {
      fs.appendFileSync(this._ensurePath(), line, 'utf-8')
    } catch {}
  }

  info(msg) { this._write('INFO', msg) }
  warn(msg, err) { this._write('WARN', msg, err) }
  error(msg, err) { this._write('ERROR', msg, err) }
}

module.exports = new Logger()
