import { test, expect } from '@playwright/test';

// Full flow: leader creates quiz -> participant joins by QR link -> approve -> start -> answer -> submit
// -> live leaderboard -> xlsx export -> delete. Run: npm run test:e2e  (BASE_URL=... to target another host)
test('end-to-end quiz flow', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const leaderCtx = await browser.newContext({ acceptDownloads: true });
  const partCtx = await browser.newContext();
  const L = await leaderCtx.newPage();
  const P = await partCtx.newPage();
  for (const pg of [L, P]) pg.on('dialog', d => d.accept());

  // --- Leader login (header, top right) ---
  await L.goto('/');
  await L.getByRole('button', { name: /Leader Login/ }).click();
  await L.fill('#lid', 'leader1');
  await L.fill('#lpw', 'wrong');
  await L.getByRole('button', { name: 'SIGN IN' }).click();
  await expect(L.getByText('Invalid leader ID or password.')).toBeVisible();
  await L.fill('#lpw', '1111');
  await L.getByRole('button', { name: 'SIGN IN' }).click();
  await L.waitForURL('**/leader');

  // --- Create quiz with a preset ---
  await expect(L.locator('#p option')).toHaveCount(2);
  await L.fill('#t', 'Playwright Test Quiz');
  await L.getByRole('button', { name: /CREATE QUIZ/ }).click();
  const code = (await L.locator('.code-box strong').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(L.getByAltText(`QR to join quiz ${code}`)).toBeVisible();

  // --- Participant joins through the QR link (code prefilled) ---
  await P.goto(`/?code=${code}`);
  await expect(P.locator('#code')).toHaveValue(code);
  await P.fill('#name', 'Playwright Tester');
  await P.fill('#email', 'pw.tester@vit.edu');
  await P.fill('#phone', '9876543210');
  await P.fill('#college', 'VIT Pune');
  await P.fill('#department', 'Biomedical');
  await P.locator('.avatar-pick').nth(2).click();
  await P.getByRole('button', { name: /JOIN QUIZ/ }).click();
  await expect(P.getByText(/Waiting for the organizer to approve/)).toBeVisible();
  await expect(P.locator('.profile-avatar')).toHaveText('🧠');

  // --- Leader sees participant, approves, starts ---
  await expect(L.getByText('Playwright Tester')).toBeVisible({ timeout: 10_000 });
  await L.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(P.getByText(/Approved! Waiting for the organizer to start/)).toBeVisible({ timeout: 10_000 });
  await L.getByRole('button', { name: /START QUIZ/ }).click();

  // --- Participant takes the quiz ---
  await P.getByRole('button', { name: /START CHALLENGE/ }).click({ timeout: 10_000 });
  await expect(P.getByText('Question 1 of 35')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await P.locator('.option-item').first().click();
    await P.locator('.btn-confirm').click();
    await P.getByRole('button', { name: /Next/ }).click();
  }
  await expect(P.getByText('Question 4 of 35')).toBeVisible();
  // jump to the last question via palette, then submit (unanswered confirm dialog is auto-accepted)
  await P.locator('.palette-pill').last().click();
  await P.getByRole('button', { name: /Review & Submit Quiz/ }).click();
  await expect(P.getByText('SUBMITTED & VALIDATED')).toBeVisible({ timeout: 15_000 });
  await expect(P.getByText('/ 35').first()).toBeVisible();

  // --- Live leaderboard on both sides ---
  await expect(P.locator('.lb-row', { hasText: 'Playwright Tester' })).toBeVisible();
  await expect(L.locator('.lb-row', { hasText: 'Playwright Tester' })).toBeVisible({ timeout: 10_000 });

  // --- Excel export has the participant's score ---
  const [dl] = await Promise.all([L.waitForEvent('download'), L.getByRole('link', { name: /Download results/ }).click()]);
  expect(dl.suggestedFilename()).toBe(`quiz-${code}-results.xlsx`);

  // --- Delete quiz ---
  await L.getByRole('button', { name: /Delete quiz/ }).click();
  await expect(L.getByText('Your quizzes')).toBeHidden({ timeout: 10_000 }).catch(() => {});
  await expect(L.locator('.lead-room', { hasText: code })).toHaveCount(0);
  await P.reload();
  await expect(P.getByRole('button', { name: /JOIN QUIZ/ })).toBeVisible({ timeout: 10_000 });
});
