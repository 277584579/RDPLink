/**
 * 格式化工具函数。
 */

/** 把时间戳格式化为「今天 HH:MM」或「YYYY/MM/DD HH:MM」；无值返回空串 */
export function fmtTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `今天 ${hm}` : d.toLocaleDateString('zh-CN') + ' ' + hm
}

/** 把连接配置格式化为显示用地址串，非 3389 端口会带出 */
export function fmtAddress(host: string, port: number): string {
  return port && port !== 3389 ? `${host}:${port}` : host
}

/** 把连接配置格式化为显示用分辨率/全屏标签 */
export function fmtDisplay(fullscreen: boolean, width: number, height: number): string {
  return fullscreen ? '全屏' : `${width}×${height}`
}
