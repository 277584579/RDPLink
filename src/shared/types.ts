/**
 * 主进程 / 预加载 / 渲染层共享的类型定义。
 * 统一从这里导入，避免在多处重复定义 ConnectionConfig 导致字段漂移。
 */

/** 音频重定向模式 */
export type AudioMode = 0 | 1 | 2

/** 一条 RDP 连接配置（持久化在 connections.json 中） */
export interface ConnectionConfig {
  /** 连接 ID（UUID），新建时由主进程生成 */
  id: string
  /** 连接名称（显示用） */
  name: string
  /** 主机地址，支持 `host` 或 `host:port` */
  host: string
  /** RDP 端口 */
  port: number
  /** 登录用户名 */
  username: string
  /** 域（可选，留空表示本地账号） */
  domain?: string
  /** 密码密文（safeStorage/DPAPI 加密后的 base64；或 `plain:` 前缀的退化形式） */
  passwordEnc?: string
  /** 启动即全屏 */
  fullscreen: boolean
  /** 窗口模式分辨率宽 */
  width: number
  /** 窗口模式分辨率高 */
  height: number
  /** 剪贴板重定向 */
  redirectClipboard: boolean
  /** 本地驱动器重定向 */
  redirectDrives: boolean
  /** 音频模式：0=本地播放 1=不播放 2=远程播放 */
  audioMode: AudioMode
  /** 上次成功发起连接的时间戳 */
  lastConnectedAt?: number
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}

/** IPC: 发起连接的返回结果 */
export interface LaunchResult {
  ok: boolean
  error?: string
}

/** IPC: 导入/导出的返回结果 */
export interface ExportResult {
  ok: boolean
  count?: number
  canceled?: boolean
}

export interface ImportResult {
  ok: boolean
  count?: number
  canceled?: boolean
  error?: string
}
