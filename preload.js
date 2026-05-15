// 预加载脚本：在渲染进程和主进程之间建立安全的 IPC 通信桥
// contextBridge.exposeInMainWorld 把 API 暴露给渲染进程的 window.holidayAPI
// 这样渲染进程只能通过这里定义的方法和主进程通信，不能直接访问 Node.js API

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('holidayAPI', {
  // 节日数据
  getHolidays: () => ipcRenderer.invoke('get-holidays'),

  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (s) => ipcRenderer.invoke('update-settings', s),

  // 自定义提醒 CRUD
  getCustomReminders: () => ipcRenderer.invoke('get-custom-reminders'),
  addCustomReminder: (r) => ipcRenderer.invoke('add-custom-reminder', r),
  updateCustomReminder: (id, r) => ipcRenderer.invoke('update-custom-reminder', id, r),
  removeCustomReminder: (id) => ipcRenderer.invoke('remove-custom-reminder', id),

  // 监听主进程事件（如刷新节日数据）
  onRefresh: (cb) => ipcRenderer.on('refresh-holidays', cb)
})
