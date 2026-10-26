/**
 * 连接配置的持久化存储。
 *
 * 存储位置按打包形态区分，确保覆盖安装不丢数据：
 *  - nsis 安装版：固定存到 %APPDATA%\远程助手（userData），与安装目录无关，
 *    覆盖安装/卸载都不会丢连接记录。
 *  - portable 便携版：存到 exe 同目录（PORTABLE_EXECUTABLE_DIR），否则解压到
 *    随机临时目录数据无法持久。
 *  - 开发模式：使用 Electron 的 userData 目录。
 *
 * 首次启动时若发现旧版本存放在 exe 同目录的数据，会自动迁移到 userData。
 */
import { app } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { ConnectionConfig } from '@shared/types'

/**
 * 返回配置文件应存放的目录。
 * - portable 版（有 PORTABLE_EXECUTABLE_DIR 环境变量）→ exe 原始所在目录
 * - 其他打包形态（nsis 安装版）→ %APPDATA%\远程助手（userData），与安装目录解耦
 * - 开发模式 → userData
 */
export function dataDir(): string {
  // portable 版特有环境变量，指向 exe 原始所在目录（非解压临时目录）
  const portableDir = process.env['PORTABLE_EXECUTABLE_DIR']
  if (portableDir) return portableDir
  // nsis 安装版 + 开发模式：用 userData，覆盖安装不丢数据
  return app.getPath('userData')
}

/** 配置文件完整路径 */
export const storeFile = (): string => join(dataDir(), 'connections.json')

/** 迁移：旧版把数据存在 exe 同目录，首次启动时搬到用户目录 */
export function migrateLegacyStore(): void {
  try {
    if (existsSync(storeFile())) return
    const legacyDirs = [process.env['PORTABLE_EXECUTABLE_DIR'], dirname(process.execPath)].filter(
      (d): d is string => !!d
    )
    for (const dir of legacyDirs) {
      const legacyFile = join(dir, 'connections.json')
      if (existsSync(legacyFile)) {
        if (!existsSync(dataDir())) mkdirSync(dataDir(), { recursive: true })
        writeFileSync(storeFile(), readFileSync(legacyFile, 'utf-8'), 'utf-8')
        return
      }
    }
  } catch {
    /* 迁移失败不影响启动 */
  }
}

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
