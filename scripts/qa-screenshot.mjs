/**
 * Snapshot only a fully rendered game frame, without racing the next costly
 * software-WebGL draw. Repeated screenshots still use the real game scene.
 */
export async function captureQaScreenshot(page, options) {
  await page.evaluate(() => {
    if (typeof window.__scalebornQaHoldNextFrame !== 'function') {
      throw new Error('Real-frame QA capture hook missing');
    }
    return window.__scalebornQaHoldNextFrame();
  });
  try {
    await page.screenshot(options);
  } finally {
    await page.evaluate(() => window.__scalebornQaResumeFrames?.());
  }
}
