// 设置窗口的渲染进程脚本
// 通过 window.holidayAPI 与主进程通信

const api = window.holidayAPI

// ===== 标签切换 =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')
  }
})

// ===== 通用设置 =====
async function loadSettings() {
  const settings = await api.getSettings()
  document.getElementById('sticker-position').value = settings.stickerPosition
  document.getElementById('auto-start').checked = settings.autoStart
  document.getElementById('reminder-enabled').checked = settings.reminderEnabled
  document.getElementById('daily-reminder-time').value = settings.dailyReminderTime

  // 加载提前提醒天数预设选项
  document.querySelectorAll('#advance-presets input').forEach(cb => {
    cb.checked = settings.advanceReminderPresets.includes(Number(cb.value))
  })
  document.getElementById('custom-advance-days').value = (settings.customAdvanceReminderDays || []).join(', ')
}

document.getElementById('save-general').onclick = async () => {
  await api.updateSettings({
    stickerPosition: document.getElementById('sticker-position').value,
    autoStart: document.getElementById('auto-start').checked,
    reminderEnabled: document.getElementById('reminder-enabled').checked
  })
  document.getElementById('general-status').textContent = '✓ 已保存'
  setTimeout(() => document.getElementById('general-status').textContent = '', 2000)
}

document.getElementById('save-reminders').onclick = async () => {
  const presets = []
  document.querySelectorAll('#advance-presets input:checked').forEach(cb => presets.push(Number(cb.value)))
  const custom = document.getElementById('custom-advance-days').value
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => !isNaN(n) && n > 0)

  await api.updateSettings({
    dailyReminderTime: document.getElementById('daily-reminder-time').value,
    advanceReminderPresets: presets,
    customAdvanceReminderDays: custom
  })
  document.getElementById('reminders-status').textContent = '✓ 已保存'
  setTimeout(() => document.getElementById('reminders-status').textContent = '', 2000)
}

// ===== 自定义提醒 CRUD =====
let editingId = null

async function loadReminderList() {
  const reminders = await api.getCustomReminders()
  const list = document.getElementById('custom-reminder-list')
  list.innerHTML = reminders.map(r => `
    <div class="reminder-item">
      <div>
        <div class="title">${r.title}</div>
        <div class="meta">${r.type} · ${r.date} ${r.time || ''}</div>
      </div>
      <div class="actions">
        <button onclick="editReminder('${r.id}')">✏️</button>
        <button onclick="deleteReminder('${r.id}')">🗑️</button>
      </div>
    </div>
  `).join('')
}

// 点击"添加提醒"按钮，显示表单
document.getElementById('add-reminder-btn').onclick = () => {
  editingId = null
  document.getElementById('reminder-id').value = ''
  document.getElementById('reminder-title').value = ''
  document.getElementById('reminder-type').value = 'once'
  document.getElementById('reminder-date').value = ''
  document.getElementById('reminder-time').value = '09:00'
  document.getElementById('reminder-advance').value = ''
  document.getElementById('reminder-form').classList.remove('hidden')
}

// 编辑已有提醒（在全局作用域，因为 onclick 在 HTML 中引用）
window.editReminder = async (id) => {
  const reminders = await api.getCustomReminders()
  const r = reminders.find(x => x.id === id)
  if (!r) return
  editingId = id
  document.getElementById('reminder-id').value = id
  document.getElementById('reminder-title').value = r.title
  document.getElementById('reminder-type').value = r.type
  document.getElementById('reminder-date').value = r.date
  document.getElementById('reminder-time').value = r.time || '09:00'
  document.getElementById('reminder-advance').value = (r.advanceReminderDays || []).join(', ')
  document.getElementById('reminder-form').classList.remove('hidden')
}

window.deleteReminder = async (id) => {
  await api.removeCustomReminder(id)
  loadReminderList()
}

// 保存提醒（新增/更新）
document.getElementById('save-reminder').onclick = async () => {
  const data = {
    title: document.getElementById('reminder-title').value,
    type: document.getElementById('reminder-type').value,
    date: document.getElementById('reminder-date').value,
    time: document.getElementById('reminder-time').value,
    advanceReminderDays: document.getElementById('reminder-advance').value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
  }

  if (editingId) {
    await api.updateCustomReminder(editingId, data)
  } else {
    await api.addCustomReminder(data)
  }

  document.getElementById('custom-status').textContent = '✓ 已保存'
  document.getElementById('reminder-form').classList.add('hidden')
  loadReminderList()
  setTimeout(() => document.getElementById('custom-status').textContent = '', 2000)
}

document.getElementById('cancel-reminder').onclick = () => {
  document.getElementById('reminder-form').classList.add('hidden')
}

// ===== 初始化：加载设置和提醒列表 =====
loadSettings()
loadReminderList()
