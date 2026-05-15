# 农历日历提醒设计文档

日期: 2026-05-16

## 概述

在自定义提醒中支持农历/公历日历类型选择，用户可创建基于农历日期的提醒，调度器自动将农历日期转换为对应公历日期触发。

## Reminder 类型变更

```typescript
// src/shared/types.ts
export interface Reminder {
  id: string
  title: string
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  date: string
  time: string
  calendar: 'gregorian' | 'lunar'       // 新增，默认 'gregorian'
  advanceReminderDays: number[]
  enabled: boolean
}
```

- `calendar` 缺失时默认 `gregorian`，旧数据完全向后兼容。
- `calendar='lunar'` 时的 `date` 语义：
  - `type='once'` → `"YYYY-M-D"`（农历年月日）
  - `type='yearly'` → `"M-D"`（农历月日，不含年）

## ReminderForm 日期选择 UI

日历类型切换控件：按钮组「公历 / 农历」，位于表单顶部。

**公历模式（下拉框替换原有文本输入）：**

| 提醒类型 | 下拉内容 |
|---------|---------|
| `once` | 年(1900-2100) + 月(1-12) + 日(动态) |
| `yearly` | 月(1-12) + 日(动态) |
| `monthly` | 日(1-31) |
| `weekly` | 星期(1-7) |
| `daily` | 无日期选择 |

**农历模式：**

| 提醒类型 | 下拉内容 |
|---------|---------|
| `once` | 年(1890-2100) + 农历月 + 农历日(动态) |
| `yearly` | 农历月 + 农历日 |
| `monthly/weekly/daily` | 不支持农历，切换时自动切回公历 |

农历月下拉包含「正月~十二月」及可能的闰月，日下拉根据所选月动态生成（大月30天/小月29天）。每次变更后实时生成预览文本如「农历丙午年三月十五」。

## 调度器农历日期转换

`src/main/lunar.ts` 新增函数：

```typescript
export function lunarToSolar(calendar: string, type: string, dateStr: string): string | null
```

`_getNextOccurrence` 中对 `calendar='lunar'` 的 reminder：
- `type='once'`：`createLunarDate({ year, month, day })` → `toGregorian()` 返回公历日期
- `type='yearly'`：以当前年份构造农历日期 → `toGregorian()` → 若已过则试下一年

## IPC

新增 `get-lunar-month-days` handler，接收 `{ year: number, month: number, isLeap: boolean }`，返回该月天数。preload 绑定同名方法。

## 显示层

**设置窗口提醒列表**：农历提醒显示农历原文（用 `formatLunar` 生成）+ `◇农历` 标签。

**贴纸窗口提醒列表**：格式 `📌 生日  +3天  05-01(农历三月十五)`

**新增工具函数** `formatReminderDate(reminder): string`：
- 公历 → 直接返回 `reminder.date`
- 农历 once → `"农历乙巳年三月初五 → 05-01"`
- 农历 yearly → `"每年农历三月初五"`
- 由主进程 `get-lunar-date` IPC 或渲染侧组合实现

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/shared/types.ts` | Reminder 加 `calendar` 字段 |
| `src/renderer/settings/components/ReminderForm.vue` | 日历类型切换 + 下拉日期选择器 |
| `src/renderer/settings/components/CustomReminderTab.vue` | 显示农历标签 |
| `src/renderer/sticker/components/CustomReminderList.vue` | 显示农历原文 |
| `src/main/lunar.ts` | 新增 `lunarToSolar` 函数 |
| `src/main/scheduler.ts` | `_getNextOccurrence` 处理 lunar |
| `src/main/ipc/holiday.ts` | 新增 `get-lunar-month-days` handler |
| `src/preload/index.ts` | 绑定新 IPC 方法 |
| `src/shared/types.ts` | HolidayAPI 接口加新方法 |
