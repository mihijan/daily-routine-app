// IPC handlers — registers all ipcMain.handle(...) endpoints.
// Validates incoming payloads, verifies sender, calls AppStateRepository,
// and triggers Scheduler.reconcile() after mutations.
// Will be implemented during Bootstrap / Data Modeling tasks.

export function registerIpcHandlers(): void {
  // TODO: register handlers for getState, savePermanentSchedule,
  //       saveDailyOverride, resetDailyOverride, setPaused, quit
}
