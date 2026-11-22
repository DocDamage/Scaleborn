export interface ResolutionPolicy {
  min: number;
  max: number;
  starting: number;
}

/**
 * Hysteretic internal render-resolution controller. Keeps materials and
 * world geometry intact, preventing low FPS from making flight unresponsive.
 * No external APIs or timers; deterministic from measured FPS samples.
 */
export class AdaptiveResolution {
  private readonly policy: ResolutionPolicy;
  private ratio: number;
  private slowSamples=0;
  private fastSamples=0;
  private cooldown=0;

  constructor(policy: ResolutionPolicy) {
    if (!(policy.min>0 && policy.min<=policy.starting
      && policy.starting<=policy.max && policy.max<=3)) {
      throw new Error('Invalid adaptive-resolution policy');
    }
    this.policy=policy;
    this.ratio=policy.starting;
  }

  get pixelRatio():number { return this.ratio; }

  /** Return changed ratio only after sustained evidence, not one bad frame. */
  recordFps(fps: number): number | null {
    if (!Number.isFinite(fps) || fps<1 || fps>1000) return null;
    if(this.cooldown>0) this.cooldown--;
    if(fps<28) {
      this.slowSamples++;
      this.fastSamples=0;
    } else if(fps>56) {
      this.fastSamples++;
      this.slowSamples=0;
    } else {
      this.slowSamples=0;
      this.fastSamples=0;
    }
    if(this.cooldown>0)return null;
    if(this.slowSamples>=3 && this.ratio>this.policy.min+.005) {
      this.ratio=Math.max(this.policy.min,
        Math.round((this.ratio-.10)*100)/100);
      this.slowSamples=0;
      this.cooldown=5;
      return this.ratio;
    }
    if(this.fastSamples>=8 && this.ratio<this.policy.max-.005) {
      this.ratio=Math.min(this.policy.max,
        Math.round((this.ratio+.05)*100)/100);
      this.fastSamples=0;
      this.cooldown=8;
      return this.ratio;
    }
    return null;
  }
}
