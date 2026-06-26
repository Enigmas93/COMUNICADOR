import { expect, test } from "@playwright/test";

test("cadastro/login -> dashboard -> nova sala", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("link", { name: "Criar nova sala" }).click();
  await expect(page).toHaveURL(/rooms\/new/);
  await page.getByLabel("Nome da sala").fill("Sala de testes");
  await page.getByLabel("Descricao").fill("Fluxo critico cobrindo criacao de sala com envelope inicial.");
  await page.getByRole("button", { name: "Criar sala" }).click();
});

test("explorar sala publica e abrir preview", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Ver sala" }).first().click();
  await expect(page).toHaveURL(/rooms/);
  await expect(page.getByText("Realtime via Supabase")).toBeVisible();
});

test("convite direciona para aceitacao de acesso", async ({ page }) => {
  await page.goto("/invite/aurora-48h-token");
  await expect(page.getByText("Voce foi convidado para")).toBeVisible();
  await page.getByRole("link", { name: /Acessar e aceitar convite/i }).click();
  await expect(page).toHaveURL(/login/);
});
