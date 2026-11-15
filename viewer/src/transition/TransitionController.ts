import type { WorldId } from "../core/types";

export type TransitionState =
  | "idle"
  | "arming"
  | "intent"
  | "phase"
  | "arrival"
  | "cooldown";

export interface TransitionInfo {
  state: TransitionState;
  direction: WorldId;
  progress: number;
}

export interface StartOptions {
  targetId?: string;
  targetWorld?: WorldId;
  immediate?: boolean;
}

export interface TransitionCallbacks {
  getWorld: () => WorldId;
  onState: (info: TransitionInfo) => void;
  onSwap: (targetWorld: WorldId, targetId?: string) => void;
  onVeil: (active: boolean, label: string) => void;
  onProgress: (value: number) => void;
}

const TIMING = {
  arming: 200,
  intent: 150,
  phase: 550,
  arrival: 300,
  cooldown: 500,
} as const;

function otherWorld(world: WorldId): WorldId {
  return world === "M" ? "R" : "M";
}

export class TransitionController {
  private readonly callbacks: TransitionCallbacks;
  private state: TransitionState = "idle";
  private stateStart = 0;
  private direction: WorldId = "R";
  private targetId?: string;
  private holding = false;
  private swapDone = false;
  private veilActive = false;
  private reducedMotion = false;

  constructor(callbacks: TransitionCallbacks) {
    this.callbacks = callbacks;
  }

  get currentState(): TransitionState {
    return this.state;
  }

  get isActive(): boolean {
    return this.state !== "idle";
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  press(options: StartOptions = {}): void {
    if (!this.canStart()) return;
    this.begin(options, false);
  }

  release(): void {
    if (this.state !== "arming" || !this.holding) return;
    this.holding = false;
    this.cancel();
  }

  start(options: StartOptions = {}): void {
    if (!this.canStart()) return;
    this.begin(options, true);
  }

  update(now: number): void {
    if (this.state === "idle") return;
    const elapsed = now - this.stateStart;

    if (this.state === "arming") {
      const progress = Math.min(1, elapsed / TIMING.arming);
      this.callbacks.onProgress(progress);
      if (elapsed >= TIMING.arming) {
        this.completeArming(now);
      }
      return;
    }

    if (this.state === "intent") {
      if (elapsed >= TIMING.intent) {
        this.setState("phase", now);
      }
      return;
    }

    if (this.state === "phase") {
      if (!this.veilActive) {
        this.veilActive = true;
        this.callbacks.onVeil(true, `${this.direction === "R" ? "M" : "R"} → ${this.direction}`);
      }
      if (!this.swapDone && elapsed >= TIMING.phase / 2) {
        this.swapDone = true;
        this.callbacks.onSwap(this.direction, this.targetId);
      }
      if (elapsed >= TIMING.phase) {
        this.veilActive = false;
        this.callbacks.onVeil(false, "");
        this.setState("arrival", now);
      }
      return;
    }

    if (this.state === "arrival" && elapsed >= TIMING.arrival) {
      this.setState("cooldown", now);
      return;
    }

    if (this.state === "cooldown" && elapsed >= TIMING.cooldown) {
      this.setState("idle", now);
      this.callbacks.onProgress(0);
    }
  }

  private begin(options: StartOptions, immediate: boolean): void {
    const now = performance.now();
    this.holding = !immediate;
    this.swapDone = false;
    this.veilActive = false;
    this.targetId = options.targetId;
    this.direction = options.targetWorld ?? otherWorld(this.callbacks.getWorld());

    if (immediate) {
      this.setState("intent", now);
      return;
    }

    this.setState("arming", now);
    this.callbacks.onProgress(0);
  }

  private completeArming(now: number): void {
    this.callbacks.onProgress(1);
    if (this.reducedMotion) {
      this.callbacks.onSwap(this.direction, this.targetId);
      this.swapDone = true;
      this.setState("arrival", now);
      return;
    }
    this.setState("intent", now);
  }

  private setState(state: TransitionState, now: number): void {
    this.state = state;
    this.stateStart = now;
    this.callbacks.onState({
      state,
      direction: this.direction,
      progress: state === "arming" ? 0 : 1,
    });
  }

  private cancel(): void {
    this.state = "idle";
    this.veilActive = false;
    this.callbacks.onVeil(false, "");
    this.callbacks.onProgress(0);
    this.callbacks.onState({
      state: "idle",
      direction: this.direction,
      progress: 0,
    });
  }

  private canStart(): boolean {
    return this.state === "idle";
  }
}
