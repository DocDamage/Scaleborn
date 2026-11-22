import { describe, expect, it } from 'vitest';
import { QaFrameCaptureGate } from '../src/app/qaFrameCaptureGate';

describe('DEV real-frame screenshot gate', () => {
  it('holds only after a real rendered frame and resumes afterwards', async () => {
    const gate = new QaFrameCaptureGate();
    expect(gate.isHeld).toBe(false);
    gate.didRenderFrame();
    expect(gate.isHeld).toBe(false);
    let resolved = false;
    const result = gate.holdAfterNextFrame().then(() => { resolved = true; });
    expect(gate.isHeld).toBe(false);
    expect(resolved).toBe(false);
    gate.didRenderFrame();
    await result;
    expect(resolved).toBe(true);
    expect(gate.isHeld).toBe(true);
    gate.resume();
    expect(gate.isHeld).toBe(false);
    gate.didRenderFrame();
    expect(gate.isHeld).toBe(false);
  });

  it('deduplicates simultaneous screenshot requests without losing a frame', async () => {
    const gate = new QaFrameCaptureGate();
    const one = gate.holdAfterNextFrame();
    const two = gate.holdAfterNextFrame();
    expect(two).toBe(one);
    gate.didRenderFrame();
    await Promise.all([one, two]);
    expect(gate.isHeld).toBe(true);
    const three = gate.holdAfterNextFrame();
    expect(gate.isHeld).toBe(false);
    gate.didRenderFrame();
    await three;
    expect(gate.isHeld).toBe(true);
  });
});
