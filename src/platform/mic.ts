type AudioCtor = typeof AudioContext;
const audioCtor = (): AudioCtor | undefined =>
  window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

/** The microphone as a trigger: any loud sound holds "fire" down. */
export class Mic {
  private active = false;
  private isHeld = false;
  private hold = 0;
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private an: AnalyserNode | null = null;
  private buf: Float32Array | null = null;
  private ownCtx: AudioContext | null = null;

  constructor(private getAudioContext: () => AudioContext | null) {}

  get on(): boolean { return this.active; }
  get held(): boolean { return this.isHeld; }

  async enable(): Promise<"on" | "blocked" | "unavailable"> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "unavailable";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      let ctx = this.getAudioContext();
      if (!ctx) { const AC = audioCtor(); if (!AC) { stream.getTracks().forEach((t) => t.stop()); return "unavailable"; } ctx = this.ownCtx = new AC(); }
      if (ctx.state === "suspended") void ctx.resume();
      this.src = ctx.createMediaStreamSource(stream);
      this.an = ctx.createAnalyser(); this.an.fftSize = 512; this.src.connect(this.an);
      this.buf = new Float32Array(512); this.stream = stream; this.active = true;
      return "on";
    } catch { return "blocked"; }
  }

  disable(): void {
    this.active = false; this.isHeld = false; this.hold = 0;
    if (this.stream) this.stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ended */ } });
    if (this.src) try { this.src.disconnect(); } catch { /* gone */ }
    this.stream = null; this.src = null; this.an = null; this.buf = null;
  }

  /** Call once a frame. `ignoreInput` is true while the game's own voice speaks: that is not you. */
  update(dt: number, ignoreInput: boolean): void {
    if (!this.active || !this.an || !this.buf) return;
    this.an.getFloatTimeDomainData(this.buf as Float32Array<ArrayBuffer>);
    let m = 0;
    for (let i = 0; i < this.buf.length; i++) m = Math.max(m, Math.abs(this.buf[i]));
    if (ignoreInput) m = 0;
    if (m > 0.05) { this.isHeld = true; this.hold = 0.12; }
    else { this.hold -= dt; if (m < 0.02 && this.hold <= 0) this.isHeld = false; }
  }

  destroy(): void {
    this.disable();
    if (this.ownCtx) { void this.ownCtx.close().catch(() => undefined); this.ownCtx = null; }
  }
}
