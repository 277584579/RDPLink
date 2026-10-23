/**
 * IPC handler 注册：连接 CRUD、密码加解密、发起连接、导入/导出。
 * 在主窗口创建前调用 registerIpc() 一次性注册全部 handler。
 */
import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { readFileSync, writeFileSync, accessSync } from 'fs'
import { randomUUID } from 'crypto'
import type { ConnectionConfig, ExportResult, ImportResult } from '@shared/types'
import { loadConnections, saveConnections, findConnection } from './store'
import { encryptPassword, decryptPassword } from './crypto'
import { launchConnection } from './rdp'

/** 注册全部 IPC handler（幂等，重复调用无副作用） */
export function registerIpc(): void {
  // ---------- 连接 CRUD ----------
  ipcMain.handle('connections:list', () => loadConnections())

  ipcMain.handle('connections:save', (_e, cfg: ConnectionConfig) => {
    const list = loadConnections()
    const now = Date.now()
    let saved: ConnectionConfig
    if (cfg.id && list.some((x) => x.id === cfg.id)) {
      saved = { ...cfg, passwordEnc: cfg.passwordEnc, updatedAt: now }
      const i = list.findIndex((x) => x.id === cfg.id)
      list[i] = saved
    } else {
      saved = { ...cfg, id: randomUUID(), createdAt: now, updatedAt: now }
      list.push(saved)
    }
    saveConnections(list)
    return saved
  })

  ipcMain.handle('connections:delete', (_e, id: string) => {
    saveConnections(loadConnections().filter((x) => x.id !== id))
    return true
  })

  ipcMain.handle('connections:encrypt', (_e, plain: string) => encryptPassword(plain))

  // 查看已保存的密码（仅本机 DPAPI 可解密）
  ipcMain.handle('connections:reveal', (_e, id: string) => {
    const c = findConnection(id)
    return c ? decryptPassword(c.passwordEnc) : ''
  })

  ipcMain.handle('connection:launch', (_e, cfg: ConnectionConfig) => launchConnection(cfg))

  // ---------- 获取本机可用盘符（供前端选择重定向磁盘）----------
  ipcMain.handle('drives:list', () => listLocalDrives())

  // ---------- 应用信息 ----------
  ipcMain.handle('app:isPackaged', () => app.isPackaged)
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // ---------- 导出 / 导入 ----------
  ipcMain.handle('connections:export', async (e): Promise<ExportResult> => exportConnections(e))
  ipcMain.handle('connections:import', async (e): Promise<ImportResult> => importConnections(e))
}

/** 导出全部连接为 JSON，询问是否含密码 */
async function exportConnections(e: Electron.IpcMainInvokeEvent): Promise<ExportResult> {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return { ok: false }
  const list = loadConnections()
  if (list.length === 0) {
    await dialog.showMessageBox(win, { message: '还没有可导出的连接', buttons: ['确定'] })
    return { ok: false, canceled: true }
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    message: '导出的配置是否包含密码？',
    detail:
      '包含密码：对方导入后可直接连接，但密码在文件中以明文保存，请注意文件安全。\n不含密码：对方导入后需自行输入密码。',
    buttons: ['包含密码', '不含密码', '取消'],
    defaultId: 0,
    cancelId: 2
  })
  if (response === 2) return { ok: false, canceled: true }
  const withPassword = response === 0

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出连接配置',
    defaultPath: '远程助手-配置.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  const data = {
    app: 'rdp-assistant',
    version: 1,
    exportedAt: new Date().toISOString(),
    connections: list.map((c) => ({
      name: c.name,
      host: c.host,
      port: c.port,
      username: c.username,
      domain: c.domain,
      fullscreen: c.fullscreen,
      width: c.width,
      height: c.height,
      redirectClipboard: c.redirectClipboard,
      redirectDrives: c.redirectDrives,
      redirectDrivesList: c.redirectDrivesList,
      audioMode: c.audioMode,
      password: withPassword ? decryptPassword(c.passwordEnc) : ''
    }))
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return { ok: true, count: list.length }
}

/** 从 JSON 导入连接，按 host:port:username 去重后追加 */
async function importConnections(e: Electron.IpcMainInvokeEvent): Promise<ImportResult> {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return { ok: false }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入连接配置',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }

  try {
    const parsed = JSON.parse(readFileSync(filePaths[0], 'utf-8'))
    const incoming = Array.isArray(parsed) ? parsed : parsed.connections
    if (!Array.isArray(incoming)) return { ok: false, error: '文件格式不正确' }

    const list = loadConnections()
    const now = Date.now()
    const existingKeys = new Set(list.map((c) => `${c.host}:${c.port}:${c.username}`))
    let added = 0
    for (const item of incoming) {
      if (!item.host || !item.username) continue
      const key = `${item.host}:${item.port}:${item.username}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      list.push({
        id: randomUUID(),
        name: item.name || item.host,
        host: item.host,
        port: item.port || 3389,
        username: item.username,
        domain: item.domain || undefined,
        passwordEnc: item.password ? encryptPassword(String(item.password)) : undefined,
        fullscreen: !!item.fullscreen,
        width: item.width || 1440,
        height: item.height || 900,
        redirectClipboard: item.redirectClipboard !== false,
        redirectDrives: !!item.redirectDrives,
        redirectDrivesList: Array.isArray(item.redirectDrivesList) ? item.redirectDrivesList : undefined,
        audioMode: (item.audioMode ?? 1) as 0 | 1 | 2,
        createdAt: now,
        updatedAt: now
      })
      added++
    }
    saveConnections(list)
    return { ok: true, count: added }
  } catch (err: any) {
    return { ok: false, error: err?.message || '读取文件失败' }
  }
}

/**
 * 获取本机可用盘符列表。
 * 遍历 A-Z 检测驱动器是否存在，返回盘符 + 类型标签。
 */
function listLocalDrives(): { letter: string; label: string }[] {
  const result: { letter: string; label: string }[] = []
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code)
    const root = `${letter}:\\`
    try {
      // accessSync 在盘符不存在时会抛错
      accessSync(root)
      // 获取卷标（可选，失败则用盘符兜底）
      let label = `${letter}: 盘`
      try {
        // Windows 下 process.env 可读 SystemDrive 等，但卷标需 native API；
        // 这里简单用盘符 + 是否系统盘标识
        if (letter === 'C') label = `${letter}: 系统盘`
      } catch {
        /* ignore */
      }
      result.push({ letter, label })
    } catch {
      /* 盘符不存在，跳过 */
    }
  }
  return result
}
