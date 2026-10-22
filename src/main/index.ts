import { app, BrowserWindow, ipcMain, safeStorage, dialog, Menu } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

// ---------- 类型 ----------
export interface ConnectionConfig {
  id: string
  name: string
  host: string // 支持-host 或 host:port
  port: number
  username: string
  domain?: string
  passwordEnc?: string // safeStorage 加密后的 base64
  fullscreen: boolean
  width: number
  height: number
  redirectClipboard: boolean
  redirectDrives: boolean
  audioMode: 0 | 1 | 2 // 0=本地播放 1=不播放 2=远程播放
  lastConnectedAt?: number // 上次成功发起连接的时间
  createdAt: number
  updatedAt: number
}

// ---------- 便携存储：打包后配置存在 exe 同级目录 ----------
function dataDir(): string {
  if (app.isPackaged) {
    // portable 版每次运行会解压到随机临时目录，process.execPath 指向临时目录，
    // 必须用 PORTABLE_EXECUTABLE_DIR（exe 原始所在目录）才能让数据持久保留
    const portableDir = process.env['PORTABLE_EXECUTABLE_DIR']
    if (portableDir) return portableDir
    return dirname(process.execPath)
  }
  return app.getPath('userData')
}
const storeFile = () => join(dataDir(), 'connections.json')

function loadConnections(): ConnectionConfig[] {
  try {
    if (!existsSync(storeFile())) return []
    let text = readFileSync(storeFile(), 'utf-8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 容错：去掉 UTF-8 BOM
    const data = JSON.parse(text)
    // 容错：必须是数组且每项有 host/username
    if (!Array.isArray(data)) return []
    return data.filter((c) => c && typeof c.host === 'string' && typeof c.username === 'string')
  } catch {
    return []
  }
}
function saveConnections(list: ConnectionConfig[]): void {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(storeFile(), JSON.stringify(list, null, 2), 'utf-8')
}

// ---------- 密码加密 ----------
function encryptPassword(plain: string): string | undefined {
  if (!plain) return undefined
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plain).toString('base64')
  }
  // 退化为 base64（仅提示用，不安全）
  return 'plain:' + Buffer.from(plain, 'utf-8').toString('base64')
}
function decryptPassword(enc?: string): string {
  if (!enc) return ''
  if (enc.startsWith('plain:')) {
    return Buffer.from(enc.slice(6), 'base64').toString('utf-8')
  }
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return ''
  }
}

// ---------- cmdkey 凭据注入/清理 ----------
function runCmdkey(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const p = spawn('cmdkey.exe', args, { windowsHide: true })
    p.on('close', () => resolve())
    p.on('error', () => resolve())
  })
}
async function injectCredential(host: string, port: number, user: string, password: string) {
  const targets = new Set<string>([`TERMSRV/${host}`])
  if (port && port !== 3389) targets.add(`TERMSRV/${host}:${port}`)
  for (const t of targets) {
    await runCmdkey(['/generic:' + t, '/user:' + user, '/pass:' + password])
  }
  return [...targets]
}
async function removeCredentials(targets: string[]) {
  for (const t of targets) await runCmdkey(['/delete:' + t])
}

// ---------- 生成 .rdp 并启动 mstsc ----------
function buildRdp(c: ConnectionConfig): string {
  const lines = [
    'screen mode id:i:' + (c.fullscreen ? 2 : 1),
    'use multimon:i:0',
    // 智能缩放：窗口模式下拖动改变窗口大小 / 最大化时，远程画面自动跟随缩放
    'smart sizing:i:1',
    `desktopwidth:i:${c.width || 1440}`,
    `desktopheight:i:${c.height || 900}`,
    'session bpp:i:32',
    `full address:s:${c.host}${c.port && c.port !== 3389 ? ':' + c.port : ''}`,
    'username:s:' + c.username,
    c.domain ? 'domain:s:' + c.domain : '',
    'prompt for credentials:i:0',
    'enablecredsspsupport:i:1',
    'authentication level:i:2',
    'redirectclipboard:i:' + (c.redirectClipboard ? 1 : 0),
    'redirectdrives:i:' + (c.redirectDrives ? 1 : 0),
    'audiomode:i:' + c.audioMode,
    'redirectprinters:i:0',
    'redirectsmartcards:i:0',
    'disable themes:i:0',
    'bitmapcachepersistenable:i:1',
    'compression:i:1',
    'keyboardhook:i:2',
    'audiocapturemode:i:0',
    'videoplaybackmode:i:1',
    'connection type:i:7',
    'networkautodetect:i:1',
    'bandwidthautodetect:i:1',
    'displayconnectionbar:i:1',
    'disable wall paper:i:0',
    'allow font smoothing:i:1',
    'allow desktop composition:i:1',
    'disable full window drag:i:0',
    'disable menu anims:i:0',
    'disable cursor setting:i:0'
  ]
  return lines.filter((l) => l !== '').join('\r\n') + '\r\n'
}

const activeCleanups = new Map<string, () => void>()

async function launchConnection(c: ConnectionConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const password = decryptPassword(c.passwordEnc)
    let credTargets: string[] = []
    if (c.username && password) {
      credTargets = await injectCredential(c.host, c.port, c.domain ? `${c.domain}\\${c.username}` : c.username, password)
    }
    const rdpPath = join(app.getPath('temp'), `rdp-assistant-${c.id}.rdp`)
    writeFileSync(rdpPath, buildRdp(c), 'utf-8')

    const mstsc = spawn('mstsc.exe', c.fullscreen ? [rdpPath, '/f'] : [rdpPath], { windowsHide: false, detached: false })

    // 记录连接历史
    const list = loadConnections()
    const idx = list.findIndex((x) => x.id === c.id)
    if (idx >= 0) {
      list[idx].lastConnectedAt = Date.now()
      saveConnections(list)
    }
    const cleanup = () => {
      try { unlinkSync(rdpPath) } catch { /* ignore */ }
      if (credTargets.length) void removeCredentials(credTargets)
      activeCleanups.delete(c.id)
    }
    mstsc.on('close', cleanup)
    mstsc.on('error', () => {
      cleanup()
      dialog.showErrorBox('连接失败', '无法启动 mstsc.exe，请确认系统为 Windows 且已启用远程桌面功能。')
    })
    activeCleanups.set(c.id, cleanup)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

// ---------- IPC ----------
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
  const list = loadConnections().filter((x) => x.id !== id)
  saveConnections(list)
  return true
})
ipcMain.handle('connections:encrypt', (_e, plain: string) => encryptPassword(plain))
// 查看已保存的密码（仅本机 DPAPI 可解密，弹系统凭据提示）
ipcMain.handle('connections:reveal', (_e, id: string) => {
  const c = loadConnections().find((x) => x.id === id)
  if (!c) return ''
  return decryptPassword(c.passwordEnc)
})
ipcMain.handle('connection:launch', (_e, cfg: ConnectionConfig) => launchConnection(cfg))
ipcMain.handle('app:isPackaged', () => app.isPackaged)
ipcMain.handle('app:getVersion', () => app.getVersion())

// ---------- 导出 / 导入（用于分享给他人） ----------
ipcMain.handle(
  'connections:export',
  async (e): Promise<{ ok: boolean; count?: number; canceled?: boolean }> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { ok: false }
    const list = loadConnections()
    if (list.length === 0) {
      await dialog.showMessageBox(win, { message: '还没有可导出的连接', buttons: ['确定'] })
      return { ok: false, canceled: true }
    }
    // 询问是否携带明文密码（对方拿到才能直接用）
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
        audioMode: c.audioMode,
        password: withPassword ? decryptPassword(c.passwordEnc) : ''
      }))
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true, count: list.length }
  }
)

ipcMain.handle(
  'connections:import',
  async (e): Promise<{ ok: boolean; count?: number; canceled?: boolean; error?: string }> => {
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
        if (existingKeys.has(key)) continue // 跳过重复
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
)

// ---------- 窗口 ----------
// 单实例锁：二次启动时唤起已有窗口而不是再开一个进程
let mainWindow: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // 去掉默认菜单栏（File/Edit/View 等调试菜单）
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: '远程助手',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow = win
  win.on('closed', () => (mainWindow = null))

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
})

app.on('window-all-closed', () => {
  // 退出前清理残留凭据
  for (const cleanup of activeCleanups.values()) cleanup()
  app.quit()
})
