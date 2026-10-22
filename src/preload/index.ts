import { contextBridge, ipcRenderer } from 'electron'

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  domain?: string
  passwordEnc?: string
  fullscreen: boolean
  width: number
  height: number
  redirectClipboard: boolean
  redirectDrives: boolean
  audioMode: 0 | 1 | 2
  createdAt: number
  updatedAt: number
}

const api = {
  listConnections: (): Promise<ConnectionConfig[]> => ipcRenderer.invoke('connections:list'),
  saveConnection: (cfg: ConnectionConfig): Promise<ConnectionConfig> => ipcRenderer.invoke('connections:save', cfg),
  deleteConnection: (id: string): Promise<boolean> => ipcRenderer.invoke('connections:delete', id),
  encryptPassword: (plain: string): Promise<string | undefined> => ipcRenderer.invoke('connections:encrypt', plain),
  revealPassword: (id: string): Promise<string> => ipcRenderer.invoke('connections:reveal', id),
  launchConnection: (cfg: ConnectionConfig): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('connection:launch', cfg),
  exportConnections: (): Promise<{ ok: boolean; count?: number; canceled?: boolean }> =>
    ipcRenderer.invoke('connections:export'),
  importConnections: (): Promise<{ ok: boolean; count?: number; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke('connections:import'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
