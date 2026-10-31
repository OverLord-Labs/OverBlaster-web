import { AUDIO_CLIPS } from "../assets/manifest";
import type { SoundEvent } from "../core/events";

type AudioCtor = typeof AudioContext;
const audioCtor = (): AudioCtor | undefined =>
  window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

export interface AudioOptions {
  /** Where the clips live, ending in a slash: clips are fetched from `${baseUrl}${name}.m4a`. */
  baseUrl: string;
  musicVolume?: number;
}

interface Loop { s: AudioBufferSourceNode; g: GainNode }

/** WebAudio playback of the game's sound events: samples, a few synthesised effects, the voice, and the music. */
export class AudioEngine {
  loading = false;
  ready = false;
  muted = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private voiceG!: GainNode;
  private bufs: Record<string, AudioBuffer> = {};
  private noiseBuf: AudioBuffer | null = null;
  private music: Loop | null = null;
  private musicName: string | null = null;
  private voiceSrc: AudioBufferSourceNode[] = [];
  private voiceEnd = 0;
  private riser: AudioBufferSourceNode | null = null;
  private al: { g: GainNode; o: OscillatorNode[] } | null = null;
  private dr: { g: GainNode; o: OscillatorNode[] } | null = null;
  private timers = new Set<number>();
  private initP: Promise<void> | null = null;
  private readonly baseUrl: string;
  private readonly musicVol: number;

  constructor(opts: AudioOptions) {
    this.baseUrl = opts.baseUrl;
    this.musicVol = opts.musicVolume ?? 0.3;
  }

  get context(): AudioContext | null { return this.ctx; }

  init(): Promise<void> {
    if (this.initP) return this.initP;
    this.loading = true;
    const AC = audioCtor();
    try { if (!AC) throw new Error("no WebAudio"); this.ctx = new AC(); } catch { this.ctx = null; this.loading = false; this.initP = Promise.resolve(); return this.initP; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
    this.musicG = c.createGain(); this.musicG.gain.value = this.musicVol; this.musicG.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.gain.value = 0.8; this.sfxG.connect(this.master);
    this.voiceG = c.createGain(); this.voiceG.gain.value = 1; this.voiceG.connect(this.master);
    if (c.state === "suspended") void c.resume();
    this.initP = Promise.all(AUDIO_CLIPS.map((n) => this.load(c, n))).then(() => { this.ready = true; this.loading = false; });
    return this.initP;
  }

  // a missing or undecodable clip is silently skipped: the game still runs
  private async load(c: AudioContext, name: string): Promise<void> {
    try {
      const r = await fetch(`${this.baseUrl}${name}.m4a`);
      if (!r.ok) return;
      this.bufs[name] = await c.decodeAudioData(await r.arrayBuffer());
    } catch { /* skip */ }
  }

  handle(e: SoundEvent): void {
    switch (e.type) {
      case "sfx": { const s = this.sfx(e.name, e.gain, e.offset); if (e.tag === "riser") this.riser = s || null; break; }
      case "stopRiser": if (this.riser) { try { this.riser.stop(); } catch { /* already stopped */ } this.riser = null; } break;
      case "zap": this.zap(e.kind); break;
      case "say": this.say(e.keys); break;
      case "music": this.setMusic(e.name); break;
      case "alarm": this.setAlarm(e.on); break;
      case "drone": this.setDrone(e.on); break;
    }
  }

  isSpeaking(): boolean { return !!this.ctx && this.ctx.currentTime < this.voiceEnd; }
  /** Duck the music while the voice talks. Call once a frame. */
  tick(): void {
    if (!this.ready || !this.ctx) return;
    this.musicG.gain.setTargetAtTime(this.isSpeaking() ? this.musicVol * 0.35 : this.musicVol, this.ctx.currentTime, 0.15);
  }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  private sfx(name: string, gain?: number, offset?: number): AudioBufferSourceNode | undefined {
    if (!this.ready || !this.ctx) return undefined;
    const b = this.bufs["sfx_" + name];
    if (!b) return undefined;
    const s = this.ctx.createBufferSource(); s.buffer = b;
    const g = this.ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    s.connect(g); g.connect(this.sfxG); s.start(0, offset || 0);
    return s;
  }

  private zap(kind: "eject" | "bad" | "pop"): void {
    if (!this.ready || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, out = c.createGain();
    out.connect(this.sfxG);
    const osc = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay?: number) => {
      const o = c.createOscillator(), og = c.createGain(), s0 = t + (delay || 0);
      o.type = type; o.frequency.setValueAtTime(f0, s0); o.frequency.exponentialRampToValueAtTime(f1, s0 + dur);
      og.gain.setValueAtTime(vol, s0); og.gain.exponentialRampToValueAtTime(0.001, s0 + dur);
      o.connect(og); og.connect(out); o.start(s0); o.stop(s0 + dur + 0.02);
    };
    const noise = (dur: number, vol: number, delay?: number) => {
      if (!this.noiseBuf) { this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const n = c.createBufferSource(), ng = c.createGain(), hp = c.createBiquadFilter(), s0 = t + (delay || 0);
      n.buffer = this.noiseBuf; hp.type = "highpass"; hp.frequency.value = 1500;
      ng.gain.setValueAtTime(vol, s0); ng.gain.exponentialRampToValueAtTime(0.001, s0 + dur);
      n.connect(hp); hp.connect(ng); ng.connect(out); n.start(s0); n.stop(s0 + dur + 0.02);
    };
    if (kind === "eject") { out.gain.value = 0.5; osc("square", 1000, 620, 0.07, 0.3); osc("square", 1000, 620, 0.07, 0.3, 0.11); noise(0.18, 0.25); }
    else if (kind === "bad") { out.gain.value = 0.9; osc("sawtooth", 760, 40, 1.0, 0.5); osc("square", 190, 38, 1.0, 0.35); osc("square", 95, 30, 0.8, 0.3, 0.15); noise(0.6, 0.45); }
    else { out.gain.value = 0.6; osc("square", 1500, 260, 0.12, 0.3); noise(0.12, 0.3); }
  }

  private setAlarm(on: boolean): void {
    if (this.al) {
      try { this.al.g.gain.cancelScheduledValues(0); this.al.g.gain.value = 0; this.al.o.forEach((o) => { try { o.stop(); } catch { /* stopped */ } }); } catch { /* closed */ }
      this.al = null;
    }
    if (!on || !this.ready || !this.ctx) return;
    const c = this.ctx, g = c.createGain();
    g.gain.value = 0.035; g.connect(this.sfxG);
    const o = c.createOscillator(); o.type = "square"; o.frequency.value = 740;
    const lf = c.createOscillator(); lf.frequency.value = 2.2; lf.type = "square";
    const lg = c.createGain(); lg.gain.value = 0.035; lf.connect(lg); lg.connect(g.gain);
    o.connect(g); o.start(); lf.start();
    this.al = { g, o: [o, lf] };
  }

  private after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  private setDrone(on: boolean): void {
    if (this.dr && this.ctx) {
      const d = this.dr;
      try { d.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } catch { /* closed */ }
      this.after(1500, () => d.o.forEach((o) => { try { o.stop(); } catch { /* stopped */ } }));
      this.dr = null;
    }
    if (!on || !this.ready || !this.ctx) return;
    const c = this.ctx, g = c.createGain();
    g.gain.value = 0; g.connect(this.sfxG);
    const o = [55, 82.4, 110.3].map((f, i) => {
      const x = c.createOscillator(); x.type = i ? "sine" : "triangle"; x.frequency.value = f;
      const og = c.createGain(); og.gain.value = i ? 0.35 : 0.6; x.connect(og); og.connect(g); x.start();
      return x;
    });
    g.gain.setTargetAtTime(0.07, c.currentTime, 1.2);
    this.dr = { g, o };
  }

  private say(keys: string[]): void {
    if (!this.ready || !this.ctx) return;
    this.voiceSrc.forEach((s) => { try { s.stop(); } catch { /* ended */ } });
    this.voiceSrc = [];
    const c = this.ctx;
    let t = c.currentTime + 0.02;
    for (const k of keys) {
      const b = this.bufs["voice_" + k];
      if (!b) continue;
      const s = c.createBufferSource(); s.buffer = b; s.connect(this.voiceG); s.start(t); this.voiceSrc.push(s);
      t += b.duration + 0.06;
    }
    this.voiceEnd = t;
  }

  private setMusic(name: string | null): void {
    if (!this.ready || !this.ctx || name === this.musicName) return;
    this.musicName = name;
    const c = this.ctx, now = c.currentTime;
    if (this.music) {
      const old = this.music;
      old.g.gain.setTargetAtTime(0, now, 0.25);
      this.after(1200, () => { try { old.s.stop(); } catch { /* stopped */ } });
      this.music = null;
    }
    if (!name) return;
    const b = this.bufs["music_" + name];
    if (!b) return;
    const s = c.createBufferSource(); s.buffer = b; s.loop = true;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(g); g.connect(this.musicG); s.start(); g.gain.setTargetAtTime(1, now, 0.4);
    this.music = { s, g };
  }

  destroy(): void {
    this.timers.forEach((id) => clearTimeout(id)); this.timers.clear();
    this.setAlarm(false);
    const stop = (s: AudioScheduledSourceNode | null) => { if (s) try { s.stop(); } catch { /* stopped */ } };
    this.voiceSrc.forEach(stop); this.voiceSrc = [];
    stop(this.riser); this.riser = null;
    if (this.dr) { this.dr.o.forEach(stop); this.dr = null; }
    if (this.music) { stop(this.music.s); this.music = null; }
    this.musicName = null;
    const c = this.ctx;
    this.ctx = null; this.ready = false; this.loading = false; this.initP = null;
    if (c) void c.close().catch(() => undefined);
  }
}
