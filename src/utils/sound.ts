class ChessAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private woodTap(freq: number, duration: number, gainLevel: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, freq * 0.42), now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(1.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public playMove() {
    this.woodTap(210, 0.085, 0.22);
  }

  public playCapture() {
    this.woodTap(310, 0.07, 0.26, 0);
    this.woodTap(165, 0.11, 0.24, 0.025);
  }

  public playCastle() {
    this.woodTap(215, 0.08, 0.2, 0);
    this.woodTap(245, 0.085, 0.22, 0.095);
  }

  public playCheck() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.woodTap(230, 0.08, 0.2);

    const now = ctx.currentTime + 0.03;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playGameOver(isVictory: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = isVictory ? [392, 493.88, 587.33, 783.99] : [392, 349.23, 311.13];
    notes.forEach((freq, index) => {
      const now = ctx.currentTime + index * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }
}

export const soundEngine = new ChessAudioEngine();
