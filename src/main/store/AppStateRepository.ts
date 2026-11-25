// AppStateRepository — electron-store wrapper with in-memory cache.
// Owns: permanentSchedule, dailyOverride, pauseState, notificationLog, schemaVersion.
// All reads after init() use the in-memory cache (no disk I/O per tick).
// Will be implemented during Data Modeling.

export class AppStateRepository {
  async init(): Promise<void> {
    // TODO: load state from electron-store into memory
  }
}
