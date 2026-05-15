# Vue + TypeScript 迁移设计文档

## 概述

将 Holiday Sticker Electron 桌面应用从原生 JS 迁移到 Vue 3 + TypeScript，实现组件化架构和类型安全。

## 范围

- 渲染进程：贴纸窗口（sticker）和设置窗口（settings）全部用 Vue 3 + TS 重构
- 主进程：转换为 TypeScript，IPC handlers 按领域拆分
- 预加载脚本：TypeScript 重写，类型安全
- 构建工具：引入 electron-vite

## 技术选型

| 项 | 选择 |
|----|------|
| 构建工具 | electron-vite |
| 渲染框架 | Vue 3 (Composition API + `<script setup>`) |
| 语言 | TypeScript (strict) |
| 状态管理 | 无 Pinia，直接通过 IPC 通信 |
| 样式 | 全局 CSS + 组件 Scoped 样式 |
| 包管理器 | yarn |

## 目录结构

```
holiday-sticker/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts               # Electron 应用入口
│   │   ├── store.ts               # electron-store 封装
│   │   ├── api.ts                 # Nager.Date API
│   │   ├── lunar.ts               # 农历转换
│   │   ├── scheduler.ts           # 定时调度器
│   │   ├── tray.ts                # 系统托盘
│   │   ├── logger.ts              # 日志
│   │   └── ipc/
│   │       ├── index.ts           # 注册所有 handlers
│   │       ├── holiday.ts         # 节日数据
│   │       ├── settings.ts        # 设置
│   │       ├── reminder.ts        # 自定义提醒
│   │       └── window.ts          # 窗口操作
│   ├── preload/
│   │   └── index.ts               # contextBridge API
│   ├── renderer/
│   │   ├── sticker/
│   │   │   ├── index.html
│   │   │   ├── App.vue
│   │   │   ├── components/ (NextHoliday, HolidayList, HolidayItem, CustomReminderList, Footer)
│   │   │   └── styles/main.css
│   │   └── settings/
│   │       ├── index.html
│   │       ├── App.vue
│   │       ├── components/ (SettingsSidebar, GeneralTab, ReminderTab, CustomReminderTab, ReminderForm)
│   │       └── styles/main.css
│   └── shared/
│       └── types.ts
├── assets/icon.png
└── tests/
```

## 组件结构

### 贴纸窗口

```
App.vue
├── NextHoliday.vue          — 下一个节日（倒计时、农历）
├── HolidayList.vue          — 节日列表
│   └── HolidayItem.vue      — 单项（名称、倒计时、日期）
├── CustomReminderList.vue   — 自定义提醒
└── Footer.vue               — 今日日期
```

### 设置窗口

```
App.vue
├── SettingsSidebar.vue       — tab 导航
├── GeneralTab.vue            — 通用设置
├── ReminderTab.vue           — 提醒设置
└── CustomReminderTab.vue     — 自定义提醒管理
    └── ReminderForm.vue      — 添加/编辑表单
```

## 主进程 IPC 拆分

原 `main.js` 的 IPC handlers 按领域拆分：

- `ipc/holiday.ts`: get-holidays, get-lunar-date
- `ipc/settings.ts`: get-settings, update-settings
- `ipc/reminder.ts`: CRUD 自定义提醒
- `ipc/window.ts`: ontop, opacity, open-settings, check-update

`src/main/index.ts` 只保留窗口创建、调度器启动、IPC 注册和托盘创建。

## 数据流

渲染进程通过 `window.holidayAPI`（类型安全）调用 IPC → 主进程 handler 处理 → electron-store 读写 → 返回结果。主进程主动推送事件（onRefresh、onOpacityChanged、onOnTopChanged）通过 `webContents.send` 实现。

## 类型共享

`src/shared/types.ts` 定义 Holiday, Reminder, Settings, HolidayAPI 等接口，主进程和渲染进程共用。
