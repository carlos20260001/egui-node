/**
 * Port of `emath/src/history.rs`.
 *
 * Rust generic bounds (`T: Sum`, `T: Div<f32>`) have no direct TypeScript
 * equivalent. `History<T>` is generic and `sum`/`average`/`velocity` expect a
 * numeric `T`; non-numeric instantiations simply don't call them.
 */

/** A time/value pair, as stored by {@link History}. */
export interface Timed<T> {
  time: number;
  value: T;
}

/** The Rust `core::ops::Range<usize>` passed to {@link History.new}. */
export interface LengthRange {
  /** In elements, i.e. of `values.length`. */
  start: number;
  /** In elements, i.e. of `values.length`. */
  end: number;
}

/**
 * This class tracks recent values of some time series.
 *
 * It can be used as a smoothing filter for e.g. latency, fps etc, or to show a
 * log or graph of recent events.
 *
 * It has a minimum and maximum length, as well as a maximum storage time.
 * * The minimum length is to ensure you have enough data for an estimate.
 * * The maximum length is to make sure the history doesn't take up too much space.
 * * The maximum age is to make sure the estimate isn't outdated.
 *
 * Time difference between values can be zero, but never negative.
 *
 * This can be used for things like smoothed averages (for e.g. FPS) or for
 * smoothed velocity (e.g. mouse pointer speed). All times are in seconds.
 */
export class History<T> {
  /**
   * In elements, i.e. of `values.length`.
   * The length is initially zero, but once past `min_len` will not shrink below it.
   */
  private readonly min_len: number;

  /** In elements, i.e. of `values.length`. */
  private readonly max_len_: number;

  /** In seconds. */
  private readonly max_age: number;

  /** Total number of elements seen ever. */
  private total_count_: bigint;

  /** (time, value) pairs, oldest front, newest back. */
  private readonly values_: Timed<T>[];

  constructor(length_range: LengthRange, max_age: number) {
    this.min_len = length_range.start;
    this.max_len_ = length_range.end;
    this.max_age = max_age;
    this.total_count_ = 0n;
    this.values_ = [];
  }

  max_len(): number {
    return this.max_len_;
  }

  max_age_seconds(): number {
    return this.max_age;
  }

  is_empty(): boolean {
    return this.values_.length === 0;
  }

  /** Current number of values kept in history. */
  len(): number {
    return this.values_.length;
  }

  /** Total number of values seen. Includes those discarded due to `max_len` or `max_age`. */
  total_count(): bigint {
    return this.total_count_;
  }

  latest(): T | undefined {
    return this.values_[this.values_.length - 1]?.value;
  }

  /** Mutate the latest value in place, if any. */
  latest_mut(fn: (value: T) => void): void {
    const last = this.values_[this.values_.length - 1];
    if (last !== undefined) {
      fn(last.value);
    }
  }

  /** Amount of time contained from start to end in this {@link History}. */
  duration(): number {
    const first = this.values_[0];
    const last = this.values_[this.values_.length - 1];
    if (first !== undefined && last !== undefined) {
      return last.time - first.time;
    }
    return 0.0;
  }

  /**
   * `(time, value)` pairs.
   * Time difference between values can be zero, but never negative.
   */
  iter(): Timed<T>[] {
    return this.values_;
  }

  /** Just the values, in insertion order. */
  values(): T[] {
    return this.values_.map((tv) => tv.value);
  }

  clear(): void {
    this.values_.length = 0;
  }

  /** Values must be added with a monotonically increasing time, or at least not decreasing. */
  add(now: number, value: T): void {
    const last = this.values_[this.values_.length - 1];
    if (last !== undefined && last.time > now) {
      throw new Error(
        `History: time shouldn't move backwards. Last time: ${last.time}, new time: ${now}`,
      );
    }
    this.total_count_ += 1n;
    this.values_.push({ time: now, value });
    this.flush(now);
  }

  /** Mean time difference between values in this {@link History}. */
  mean_time_interval(): number | undefined {
    const first = this.values_[0];
    const last = this.values_[this.values_.length - 1];
    if (first !== undefined && last !== undefined) {
      const n = this.len();
      if (n >= 2) {
        return (last.time - first.time) / (n - 1);
      }
      return undefined;
    }
    return undefined;
  }

  /** Mean number of events per second. */
  rate(): number | undefined {
    const time = this.mean_time_interval();
    return time === undefined ? undefined : 1.0 / time;
  }

  /** Remove samples that are too old. */
  flush(now: number): void {
    while (this.values_.length > this.max_len_) {
      this.values_.shift();
    }
    const oldest_allowed_time = now - this.max_age;
    while (
      this.min_len < this.values_.length &&
      this.values_[0]!.time < oldest_allowed_time
    ) {
      // Keep popping while the oldest sample is too old.
      this.values_.shift();
    }
  }

  /** Sum of all values. Requires numeric `T`. */
  sum(): number {
    let total = 0;
    for (const tv of this.values_) {
      total += tv.value as unknown as number;
    }
    return total;
  }

  /** Mean of all values, or `undefined` if empty. Requires numeric `T`. */
  average(): number | undefined {
    const num = this.len();
    if (num > 0) {
      return this.sum() / num;
    }
    return undefined;
  }

  /**
   * Average times rate.
   * If you are keeping track of individual sizes of things (e.g. bytes), this
   * will estimate the bandwidth (bytes per second).
   */
  bandwidth(): number | undefined {
    const avg = this.average();
    const r = this.rate();
    if (avg === undefined || r === undefined) {
      return undefined;
    }
    return avg * r;
  }

  /**
   * Calculate a smooth velocity (per second) over the entire time span,
   * as the last value minus the first value over the elapsed time between them.
   */
  velocity(): number | undefined {
    const first = this.values_[0];
    const last = this.values_[this.values_.length - 1];
    if (first !== undefined && last !== undefined) {
      const dt = last.time - first.time;
      if (dt > 0.0) {
        return ((last.value as unknown as number) - (first.value as unknown as number)) / dt;
      }
      return undefined;
    }
    return undefined;
  }
}