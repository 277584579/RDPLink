/**
 * 连接配置的持久化存储。
 *
 * 便携版（Portable）每次运行会解压到随机临时目录，process.execPath 指向临时目录，
 * 必须用 PORTABLE_EXECUTABLE_DIR（exe 原始所在目录）才能让数据持久保留；
 * 开发 / 普通安装版则使用 Electron 的 userData 目录。
 */
import { app } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { ConnectionConfig } from '@shared/types'

/** 返回配置文件应存放的目录 */
export function dataDir(): string {
  if (app.isPackaged) {
    const portableDir = process.env['PORTABLE_EXECUTABLE_DIR']
    if (portableDir) return portableDir
    return dirname(process.execPath)
  }
  return app.getPath('userData')
}

/** 配置文件完整路径 */
export const storeFile = (): string => join(dataDir(), 'connections.json')

/** 读取全部连接（容错：文件不存在 / BOM / 非数组 / 字段缺失都返回空数组） */
export function loadConnections(): ConnectionConfig[] {
  try {
    if (!existsSync(storeFile())) return []
    let text = readFileSync(storeFile(), 'utf-8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 去掉 UTF-8 BOM
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []
    return data.filter(
      (c) => c && typeof c.host === 'string' && typeof c.username === 'string'
    )
  } catch {
    return []
  }
}

/** 写入全部连接（目录不存在则自动创建） */
export function saveConnections(list: ConnectionConfig[]): void {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(storeFile(), JSON.stringify(list, null, 2), 'utf-8')
}

/** 按 id 查找单条连接 */
export function findConnection(id: string): ConnectionConfig | undefined {
  return loadConnections().find((c) => c.id === id)
}

/**
 * 更新单条连接并落盘，返回更新后的数组。
 * 若 id 不存在则不改动，返回原数组。
 */
export function updateConnection(id: string, patch: Partial<ConnectionConfig>): ConnectionConfig[] {
  const list = loadConnections()
  const idx = list.findIndex((c) => c.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch }
    saveConnections(list)
  }
  return list
}
