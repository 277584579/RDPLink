/**
 * 连接列表 composable：封装连接的加载、保存、删除、发起连接、导入导出。
 * 组件只需调用这里暴露的方法，无需直接与 window.api 打交道。
 */
import { ref, computed } from 'vue'
import type { ConnectionConfig } from '@shared/types'
import { showToast } from './useToast'

/** 默认分辨率 */
export const DEFAULT_WIDTH = 1440
export const DEFAULT_HEIGHT = 900
export const DEFAULT_PORT = 3389

/** 创建一条空白连接（用于新建表单初始值） */
export function createBlankConnection(): ConnectionConfig {
  return {
    id: '',
    name: '',
    host: '',
    port: DEFAULT_PORT,
    username: '',
    domain: '',
    passwordEnc: undefined,
    fullscreen: true,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    redirectClipboard: true,
    redirectDrives: false,
    audioMode: 1,
    createdAt: 0,
    updatedAt: 0
  }
}

export function useConnections() {
  const list = ref<ConnectionConfig[]>([])
  const launchingId = ref('')

  /** 按最近连接时间排序，连过的排前面（最近在前），没连过的按创建时间排后面 */
  const sortedList = computed(() =>
    [...list.value].sort(
      (a, b) => (b.lastConnectedAt || b.createdAt) - (a.lastConnectedAt || a.createdAt)
    )
  )

  /** 重新加载连接列表 */
  async function refresh(): Promise<void> {
    list.value = await window.api.listConnections()
  }

  /** 保存（新增或更新）一条连接，返回保存后的连接 */
  async function saveConnection(cfg: ConnectionConfig): Promise<ConnectionConfig> {
    const saved = await window.api.saveConnection(cfg)
    await refresh()
    return saved
  }

  /** 删除一条连接（带确认） */
  async function removeConnection(c: ConnectionConfig): Promise<void> {
    if (!confirm(`确定删除「${c.name}」吗？`)) return
    await window.api.deleteConnection(c.id)
    await refresh()
    showToast('已删除')
  }

  /** 发起 RDP 连接 */
  async function launch(c: ConnectionConfig): Promise<void> {
    launchingId.value = c.id
    try {
      // Vue 响应式对象是 Proxy，无法被 IPC 结构化克隆，先转成纯对象
      const plain = JSON.parse(JSON.stringify(c)) as ConnectionConfig
      const r = await window.api.launchConnection(plain)
      if (!r.ok) showToast('连接失败：' + (r.error || '未知错误'))
      else showToast(`正在连接「${c.name}」…`)
    } catch (err: any) {
      showToast('连接异常：' + (err?.message || String(err)))
    } finally {
      launchingId.value = ''
      await refresh() // 刷新"上次连接"时间与排序
    }
  }

  /** 导出全部连接 */
  async function exportAll(): Promise<void> {
    const r = await window.api.exportConnections()
    if (r.ok) showToast(`已导出 ${r.count} 条连接`)
    else if (!r.canceled) showToast('导出失败')
  }

  /** 导入连接 */
  async function importAll(): Promise<void> {
    const r = await window.api.importConnections()
    if (r.ok) {
      await refresh()
      showToast(`已导入 ${r.count} 条连接`)
    } else if (!r.canceled) {
      showToast('导入失败：' + (r.error || '未知错误'))
    }
  }

  return {
    list,
    sortedList,
    launchingId,
    refresh,
    saveConnection,
    removeConnection,
    launch,
    exportAll,
    importAll
  }
}
