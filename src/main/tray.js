const { app, Tray, Menu, nativeImage, Notification } = require('electron')
const path = require('path')
const logger = require('./logger')

class TrayManager {
  constructor(mainWindow, settingsWindow, store) {
    this.mainWindow = mainWindow
    this.settingsWindow = settingsWindow
    this.store = store
    this.tray = null
  }

  create() {
    this._defaultIcon = nativeImage.createFromPath(
      path.join(__dirname, '..', '..', 'assets', 'icon.png')
    ).resize({ width: 16, height: 16 })
    this.tray = new Tray(this._defaultIcon)
    this.tray.setToolTip('Holiday Sticker')
    this.tray.on('double-click', () => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide()
      } else {
        this.mainWindow.show()
      }
    })
    this.mainWindow.on('show', () => this._updateMenu())
    this.mainWindow.on('hide', () => this._updateMenu())
    this.mainWindow.on('always-on-top-changed', () => this._updateMenu())
    this._updateMenu()
  }

  _updateMenu() {
    const isVisible = this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? '隐藏贴纸' : '显示贴纸',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          if (this.mainWindow.isVisible()) {
            this.mainWindow.hide()
          } else {
            this.mainWindow.show()
          }
        }
      },
      {
        label: this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isAlwaysOnTop() ? '取消置顶' : '置顶',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          const v = !this.mainWindow.isAlwaysOnTop()
          this.mainWindow.setAlwaysOnTop(v)
          this.store.updateSettings({ pinOnTop: v })
          this.mainWindow.webContents.send('ontop-changed', v)
        }
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => {
          if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            this.settingsWindow.show()
          }
        }
      },
      {
        label: '刷新节日数据',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          this.mainWindow.webContents.send('refresh-holidays')
        }
      },
      { type: 'separator' },
      {
        label: '检查更新',
        click: () => this._checkUpdate()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit()
      }
    ])
    this.tray.setContextMenu(contextMenu)
  }

  async _checkUpdate() {
    try {
      const currentVersion = app.getVersion()
      const notification = new Notification({
        title: 'Holiday Sticker',
        body: `当前版本: ${currentVersion}，已是最新版`
      })
      notification.show()
    } catch (err) {
      logger.error('检查更新失败', err)
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

module.exports = TrayManager
