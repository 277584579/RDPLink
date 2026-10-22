/**
 * 密码加解密：基于 Electron safeStorage（Windows 上底层为 DPAPI）。
 *
 * - 加密：明文 → base64 密文；safeStorage 不可用时退化为 `plain:` 前缀的 base64（不安全，仅提示用）
 * - 解密：密文 → 明文；退化形式直接 base64 解码，DPAPI 解密失败返回空串
 */
import { safeStorage } from 'electron'

/** 加密明文密码，返回 base64 密文（或 `plain:` 前缀的退化形式）；空串返回 undefined */
export function encryptPassword(plain: string): string | undefined {
  if (!plain) return undefined
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plain).toString('base64')
  }
  return 'plain:' + Buffer.from(plain, 'utf-8').toString('base64')
}

/** 解密密码，返回明文；无密文返回空串 */
export function decryptPassword(enc?: string): string {
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
