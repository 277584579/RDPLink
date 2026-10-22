/**
 * 表单校验工具函数。
 */
import type { ConnectionConfig } from '@shared/types'

/** 主机地址格式：IP / 主机名，可带 :端口 */
const HOST_RE = /^[a-zA-Z0-9._-]+(:\d+)?$/

/** 校验结果 */
export interface ValidationResult {
  ok: boolean
  error?: string
}

/** 校验连接表单，返回第一个不通过的字段；全部通过返回 { ok: true } */
export function validateConnection(form: {
  name: string
  host: string
  username: string
  port: number
}): ValidationResult {
  if (!form.name.trim()) return { ok: false, error: '请填写连接名称' }
  if (!form.host.trim()) return { ok: false, error: '请填写服务器地址' }
  if (!HOST_RE.test(form.host.trim())) {
    return { ok: false, error: '地址格式不正确（可用 IP / 主机名，可带 :端口）' }
  }
  if (!form.username.trim()) return { ok: false, error: '请填写账号' }
  return { ok: true }
}

/** 按 host:port:username 生成去重用的唯一键 */
export function connectionKey(c: Pick<ConnectionConfig, 'host' | 'port' | 'username'>): string {
  return `${c.host}:${c.port}:${c.username}`
}
