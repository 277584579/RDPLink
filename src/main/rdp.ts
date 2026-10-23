/**
 * RDP 连接执行：生成 .rdp 文件、注入/清理 cmdkey 凭据、启动 mstsc.exe。
 */
import { app, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import type { ConnectionConfig, LaunchResult } from '@shared/types'
import { decryptPassword } from './crypto'
import { loadConnections, saveConnections, updateConnection } from './store'

/** 运行 cmdkey.exe，无论成功失败都 resolve */
function runCmdkey(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const p = spawn('cmdkey.exe', args, { windowsHide: true })
    p.on('close', () => resolve())
    p.on('error', () => resolve())
  })
}

/** 为指定主机注入凭据，返回已注入的 TERMSRV target 列表（用于后续清理） */
async function injectCredential(host: string, port: number, user: string, password: string): Promise<string[]> {
  const targets = new Set<string>([`TERMSRV/${host}`])
  if (port && port !== 3389) targets.add(`TERMSRV/${host}:${port}`)
  for (const t of targets) {
    await runCmdkey(['/generic:' + t, '/user:' + user, '/pass:' + password])
  }
  return [...targets]
}

/** 清理已注入的凭据 */
async function removeCredentials(targets: string[]): Promise<void> {
  for (const t of targets) await runCmdkey(['/delete:' + t])
}

/** 根据连接配置生成 .rdp 文件内容（CRLF 换行，符合 RDP 文件规范） */
export function buildRdp(c: ConnectionConfig): string {
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
    // 磁盘重定向：指定盘符时用 drivestoredirect 精确控制；否则全开/全关
    'redirectdrives:i:' + (c.redirectDrives && !(c.redirectDrivesList && c.redirectDrivesList.length) ? 1 : 0),
    c.redirectDrives && c.redirectDrivesList && c.redirectDrivesList.length
      ? 'drivestoredirect:s:' + c.redirectDrivesList.map((d) => `${d}:\\`).join(';')
      : '',
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

/** 活跃连接的清理函数表，退出时统一调用 */
const activeCleanups = new Map<string, () => void>()

/** 退出前清理所有残留凭据与临时 .rdp 文件 */
export function cleanupAllConnections(): void {
  for (const cleanup of activeCleanups.values()) cleanup()
}

/**
 * 发起一次 RDP 连接：
 * 1. 解密密码 → 注入 cmdkey 凭据
 * 2. 生成 .rdp 文件 → 启动 mstsc（全屏附加 /f）
 * 3. 记录连接时间
 * 4. mstsc 退出时自动清理临时文件与凭据
 */
export async function launchConnection(c: ConnectionConfig): Promise<LaunchResult> {
  try {
    const password = decryptPassword(c.passwordEnc)
    let credTargets: string[] = []
    if (c.username && password) {
      credTargets = await injectCredential(
        c.host,
        c.port,
        c.domain ? `${c.domain}\\${c.username}` : c.username,
        password
      )
    }
    const rdpPath = join(app.getPath('temp'), `rdp-assistant-${c.id}.rdp`)
    writeFileSync(rdpPath, buildRdp(c), 'utf-8')

    const mstsc = spawn('mstsc.exe', c.fullscreen ? [rdpPath, '/f'] : [rdpPath], {
      windowsHide: false,
      detached: false
    })

    // 记录连接历史
    updateConnection(c.id, { lastConnectedAt: Date.now() })

    const cleanup = () => {
      try {
        unlinkSync(rdpPath)
      } catch {
        /* ignore */
      }
      if (credTargets.length) void removeCredentials(credTargets)
      activeCleanups.delete(c.id)
    }
    mstsc.on('close', cleanup)
    mstsc.on('error', () => {
      cleanup()
      dialog.showErrorBox(
        '连接失败',
        '无法启动 mstsc.exe，请确认系统为 Windows 且已启用远程桌面功能。'
      )
    })
    activeCleanups.set(c.id, cleanup)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
