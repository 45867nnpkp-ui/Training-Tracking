// Signal am Ende der Pause: Vibration (Android) und kurzer Ton (auch iPhone,
// sobald der Ton einmal durch ein Antippen freigeschaltet wurde).

let ctx: AudioContext | null = null;

/** Muss aus einem Tipp-Ereignis aufgerufen werden (iOS-Vorgabe für Audio). */
export function primeSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function beep(at: number, freq: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.3);
}

export function restFinishedAlert(): void {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    // nicht unterstützt (z. B. iPhone)
  }
  if (ctx && ctx.state === "running") {
    beep(ctx.currentTime, 880);
    beep(ctx.currentTime + 0.35, 1175);
  }
}
