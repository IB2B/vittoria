import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_MANAGER_EMAIL ?? "admin@alpha.digital";
const ADMIN_PASSWORD = process.env.SEED_MANAGER_PASSWORD ?? "changeme123";

test.describe("Vittoria — happy path", () => {
  test("manager logs in, lands on dashboard, drills into a client", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByText("Vittoria")).toBeVisible();

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /agency overview/i }),
    ).toBeVisible();
    await expect(page.getByText(/total spend/i)).toBeVisible();

    // Drill into the seeded client.
    await page.getByRole("link", { name: /note del chianti/i }).first().click();
    await page.waitForURL(/\/clients\//);
    await expect(page.getByRole("heading", { name: /note del chianti/i })).toBeVisible();
    await expect(page.getByText(/funnel/i).first()).toBeVisible();
    // 8 KPI cards should all be present (Spend / Impressions / Reach / Purchases / Revenue / ROAS / CPA / CTR).
    await expect(page.getByText(/^Spend$/).first()).toBeVisible();
    await expect(page.getByText(/^Impressions$/).first()).toBeVisible();
    await expect(page.getByText(/^Reach$/).first()).toBeVisible();
  });

  test("login rejects bad credentials with a generic error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    // We should stay on /login and see a generic error.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("manager can download a generated .docx", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto("/clients/note-del-chianti/report");
    await expect(page.getByText(/report builder/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download \.docx/i }).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^Report_.*\.docx$/);
  });
});
