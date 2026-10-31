/**
 * Seedable random numbers (a linear congruential generator).
 * Every random choice in the game goes through one of these, so a run is reproducible from its seed
 * and the same seed gives the same levels in any language port.
 */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = (seed >>> 0) % 4294967296;
  }
  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }
  /** Uniform in [-1, 1). */
  signed(): number {
    return this.next() * 2 - 1;
  }
  /** Standard normal (Box-Muller). */
  gauss(): number {
    return Math.sqrt(-2 * Math.log(1 - this.next())) * Math.cos(Math.PI * 2 * this.next());
  }
  /** Fisher-Yates shuffle in place, using this generator. */
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/** A tiny stateless-looking generator for fixed decorative patterns (stars, sparks): same seed, same sequence. */
export function srng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
