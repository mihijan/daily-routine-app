// Scheduler — polling loop (tick) and reconciliation.
// Responsible for notification dispatch decisions, deduplication, and pause checks.
// Will be implemented during Scheduler Design.

export class Scheduler {
  start(): void {
    // TODO: start 1-second setInterval + initial reconcile
  }

  stop(): void {
    // TODO: clear setInterval
  }

  reconcile(): void {
    // TODO: recalculate reference point, push computed state via onStateChange callback
  }
}
