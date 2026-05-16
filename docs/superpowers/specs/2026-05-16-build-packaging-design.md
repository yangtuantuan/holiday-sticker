# 构建打包方案设计

## 概述

为 Holiday Sticker Electron 应用配置构建打包，产出 Windows 安装版（NSIS）和便携版（ZIP），
支持 x64 和 arm64 两种架构。

## 构建产物

执行 `npm run dist` 后输出至 `dist/` 目录：

| 文件 | 说明 |
|------|------|
| `Holiday Sticker Setup 1.0.0 x64.exe` | NSIS 安装包 (x64) |
| `Holiday Sticker Setup 1.0.0 arm64.exe` | NSIS 安装包 (arm64) |
| `Holiday Sticker 1.0.0 x64.zip` | 便携版 (x64) |
| `Holiday Sticker 1.0.0 arm64.zip` | 便携版 (arm64) |

## electron-builder 配置

```json
"build": {
  "appId": "com.holiday-sticker.app",
  "productName": "Holiday Sticker",
  "directories": {
    "output": "dist"
  },
  "win": {
    "icon": "build/icon.png",
    "target": [
      { "target": "nsis", "arch": ["x64", "arm64"] },
      { "target": "zip", "arch": ["x64", "arm64"] }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "deleteAppDataOnUninstall": false
  }
}
```

## 图标处理

`assets/icon.png` 复制到 `build/` 目录，electron-builder 自动转换为 `.ico` 用于安装包。

## 构建脚本

```json
"scripts": {
  "dist": "electron-builder",
  "dist:x64": "electron-builder --x64",
  "dist:arm64": "electron-builder --arm64"
}
```

- `npm run dist` — 构建 x64 + arm64 全部 4 个产物
- `npm run dist:x64` — 仅构建 x64（2 个产物）
- `npm run dist:arm64` — 仅构建 arm64（2 个产物）

## 不包含（YAGNI）

- 不添加文件关联
- 不配置自动更新
- 不做代码签名
- 不添加 ia32 架构支持
