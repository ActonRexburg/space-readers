import { expect, type Page } from '@playwright/test';

/** Read the Parent Zone math prompt and type the answer on the keypad. */
export async function solveMathGate(page: Page) {
  await page.waitForTimeout(400);
  const question = await page.getByTestId('parent-gate-question').innerText();
  const mul = question.match(/(\d+)\s*×\s*(\d+)/);
  const add = question.match(/(\d+)\s*\+\s*(\d+)/);
  expect(mul || add, `math question parseable: ${question}`).toBeTruthy();
  const answer = mul
    ? String(Number(mul[1]) * Number(mul[2]))
    : String(Number(add![1]) + Number(add![2]));
  for (const digit of answer) {
    await page.locator(`[data-testid="parent-gate-key-${digit}"]`).click();
  }
  await page.locator('[data-testid="parent-gate-key-✓"]').click();
  await expect(page.locator('[data-testid="parent-dashboard"]')).toBeVisible();
}
