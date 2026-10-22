/**
 * 主进程入口：单实例锁、窗口创建、生命周期管理。
 * 业务逻辑已拆分到：
 *   - store.ts   连接配置持久化
 *   - crypto.ts  密码加解密（DPAPI）
 *   - rdp.ts     .rdp 生成 / cmdkey 凭据 / mstsc 启动
 *   - ipc.ts     IPC handler 注册
 */
import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { cleanupAllConnections } from './rdp'

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

  // 注册 IPC handler
  registerIpc()

  // 启动加速：先以最小可见状态创建并显示窗口，让用户立刻看到界面，
  // 再在事件循环空闲时加载页面，避免冷启动时长时间白屏。
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: '远程助手',
    icon: join(__dirname, '../../build/icon.png'),
    show: false, // 先不显示，等 ready-to-show 或加载完成再显示，避免白屏闪烁
    backgroundColor: '#1e1e2e', // 与应用背景色一致，减少白屏感
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow = win
  win.on('closed', () => (mainWindow = null))

  // 显示窗口：加载完成即显示；若加载超过 800ms 也强制显示（带 loading 背景）
  let shown = false
  const showWin = () => {
    if (!shown) {
      shown = true
      win.show()
    }
  }
  win.once('ready-to-show', showWin)
  setTimeout(showWin, 800) // 兜底：超时也显示，避免长时间无响应

  // 加载页面（开发模式走 HMR URL，否则加载本地文件）
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
})

app.on('window-all-closed', () => {
  // 退出前清理残留凭据与临时 .rdp 文件
  cleanupAllConnections()
  app.quit()
})
