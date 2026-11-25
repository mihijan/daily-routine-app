import { contextBridge } from 'electron'

// API bridge — to be expanded with typed IPC methods during Data Modeling / Bootstrap tasks
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('[preload] contextBridge error:', err)
  }
}
