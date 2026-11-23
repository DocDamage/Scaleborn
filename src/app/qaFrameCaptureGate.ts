/**
 * Controls a single fully rendered WebGL frame during DEV screenshot QA.
 * The renderer can be very slow under software WebGL; holding the completed
 * frame keeps Playwright's compositor capture from competing with the next
 * continuous terrain/forest draw. Live gameplay never calls these methods.
 */
export class QaFrameCaptureGate {
  private pending: Promise<void> | null = null;
  private notify: (() => void) | null = null;
  private held = false;

  get isHeld(): boolean { return this.held; }

  holdAfterNextFrame(): Promise<void> {
    if (this.pending) return this.pending;
    this.held = false;
    this.pending = new Promise<void>(resolve => { this.notify = resolve; });
    return this.pending;
  }

  didRenderFrame(): void {
    if (!this.notify) return;
    const notify = this.notify;
    this.notify = null;
    this.pending = null;
    this.held = true;
    notify();
  }

  resume(): void {
    this.held = false;
  }
}
