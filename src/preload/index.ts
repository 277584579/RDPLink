import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionConfig, LaunchResult, ExportResult, ImportResult } from '@shared/types'

export type { ConnectionConfig } from '../shared/types'

const api = {
  listConnections: (): Promise<ConnectionConfig[]> => ipcRenderer.invoke('connections:list'),
  saveConnection: (cfg: ConnectionConfig): Promise<ConnectionConfig> => ipcRenderer.invoke('connections:save', cfg),
  deleteConnection: (id: string): Promise<boolean> => ipcRenderer.invoke('connections:delete', id),
  encryptPassword: (plain: string): Promise<string | undefined> => ipcRenderer.invoke('connections:encrypt', plain),
  revealPassword: (id: string): Promise<string> => ipcRenderer.invoke('connections:reveal', id),
  launchConnection: (cfg: ConnectionConfig): Promise<LaunchResult> =>
    ipcRenderer.invoke('connection:launch', cfg),
  exportConnections: (): Promise<ExportResult> =>
    ipcRenderer.invoke('connections:export'),
  importConnections: (): Promise<ImportResult> =>
    ipcRenderer.invoke('connections:import'),
  listDrives: (): Promise<{ letter: string; label: string }[]> => ipcRenderer.invoke('drives:list'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
