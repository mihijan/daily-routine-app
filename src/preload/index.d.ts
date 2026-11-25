// Type declarations for the contextBridge API exposed to the Renderer.
// Will be expanded with typed methods during Data Modeling / Bootstrap tasks.

declare global {
  interface Window {
    api: Record<string, never>
  }
}

export {}
