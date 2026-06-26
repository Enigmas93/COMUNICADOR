import { expect, test } from "@playwright/test";

test("landing exibe proposta do produto e atalhos principais", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Comunicacao em tempo real/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrar no dashboard/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver fluxo de login/i })).toBeVisible();
});

test("login expoe email, google e magic link", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("form").getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Magic link" })).toBeVisible();
});

test("dashboard sem sessao redireciona para login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByText("Cadastre-se, gere o par de chaves e entre na sala")).toBeVisible();
});

test("rota de criacao de sala exibe configuracao inicial", async ({ page }) => {
  await page.goto("/rooms/new");
  await expect(page).toHaveURL(/rooms\/new/);
  await expect(page.getByRole("heading", { name: /Configure o espaco e gere a chave localmente/i })).toBeVisible();
});
