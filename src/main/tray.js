// 系统托盘模块
// 在 Windows 右下角系统托盘显示图标，提供右键菜单

const { Tray, Menu, nativeImage } = require('electron')
const path = require('path')

class TrayManager {
  // mainWindow: 贴纸窗口，settingsWindow: 设置窗口
  constructor(mainWindow, settingsWindow) {
    this.mainWindow = mainWindow
    this.settingsWindow = settingsWindow
    this.tray = null
  }

  // 创建系统托盘图标
  create() {
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))
    this.tray.setToolTip('Holiday Sticker')
    this._updateMenu()
  }

  // 构建右键菜单
  _updateMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '设置',
        click: () => this.settingsWindow.show()
      },
      {
        label: '刷新节日数据',
        click: () => {
          // 通知贴纸窗口刷新
          this.mainWindow.webContents.send('refresh-holidays')
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          const { app } = require('electron')
          app.quit()
        }
      }
    ])
    this.tray.setContextMenu(contextMenu)
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

module.exports = TrayManager
