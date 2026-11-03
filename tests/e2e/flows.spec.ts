import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Abrir menu" }).isVisible())
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("produto → entrada → saída → histórico → persistência → arquivamento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page
    .getByRole("button", { name: "Cadastrar produto", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Nome do produto").fill("SSD teste");
  await modal.getByLabel("Código interno").fill("TEST-SSD");
  await modal.getByLabel("Categoria").selectOption("Armazenamento");
  await modal.getByLabel("Quantidade inicial").fill("3");
  await modal.getByRole("button", { name: "Salvar produto" }).click();
  await expect(modal).not.toBeVisible();
  await nav(page, "Produtos");
  await page.getByRole("button", { name: "SSD teste TEST-SSD" }).click();
  await expect(modal.getByText("3 unidades em estoque")).toBeVisible();
  await modal.getByRole("button", { name: "Entrada", exact: true }).click();
  await modal.getByLabel("Quantidade").fill("2");
  await modal.getByRole("button", { name: "Confirmar movimentação" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "SSD teste TEST-SSD" }).click();
  await modal.getByRole("button", { name: "Saída", exact: true }).click();
  await modal.getByLabel("Quantidade").fill("6");
  await expect(modal.getByRole("alert")).toContainText("Estoque insuficiente");
  await expect(
    modal.getByRole("button", { name: "Confirmar movimentação" }),
  ).toBeDisabled();
  await modal.getByLabel("Quantidade").fill("1");
  await modal.getByRole("button", { name: "Confirmar movimentação" }).click();
  await expect(modal).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await nav(page, "Produtos");
  await page.getByRole("button", { name: "SSD teste TEST-SSD" }).click();
  await expect(modal.getByText("4 unidades em estoque")).toBeVisible();
  await expect(modal.getByRole("row")).toHaveCount(4);
  await modal.getByRole("button", { name: "Arquivar", exact: true }).click();
  await modal.getByRole("button", { name: "Confirmar arquivamento" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByLabel("Situação do estoque").selectOption("archived");
  await expect(
    page.getByRole("button", { name: "SSD teste TEST-SSD" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("ordem de serviço registra situação e entrega sem mudar estoque", async ({
  page,
}) => {
  await demo(page);
  const before = await page.locator(".stat-card").nth(1).innerText();
  await page
    .getByRole("button", { name: "Nova ordem de serviço", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Identificação do equipamento").fill("Notebook teste");
  await modal.getByLabel("Problema relatado").fill("Não liga");
  await modal.getByRole("button", { name: "Criar ordem de serviço" }).click();
  await expect(modal).not.toBeVisible();
  await nav(page, "Ordens de serviço");
  await page.getByRole("button").filter({ hasText: "Notebook teste" }).click();
  await modal.getByLabel("Atualizar situação").selectOption("Em manutenção");
  await modal
    .getByRole("button", { name: "Atualizar situação", exact: true })
    .click();
  await expect(modal.locator(".timeline li")).toHaveCount(2);
  await modal
    .getByLabel("Atualizar situação")
    .selectOption("Aguardando devolução");
  await modal
    .getByRole("button", { name: "Atualizar situação", exact: true })
    .click();
  await expect(modal.locator(".timeline li")).toHaveCount(3);
  await modal.getByLabel("Atualizar situação").selectOption("Entregue");
  await modal.getByRole("button", { name: "Registrar entrega" }).click();
  await expect(modal.locator(".timeline li")).toHaveCount(4);
  await expect(modal.getByText("Entregue em", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Fechar", exact: true }).click();
  await nav(page, "Visão geral");
  expect(await page.locator(".stat-card").nth(1).innerText()).toEqual(before);
});
test("alertas abrem detalhes e layout cabe no dispositivo", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: /Atenção à validade/ }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pasta térmica 4 g COMP-PT/ }).click();
  await expect(
    page.getByRole("dialog").getByText(/Vence em 20 dias/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Visão geral");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("visao-geral.png"),
    fullPage: true,
  });
});
test("API recusa acesso não autenticado", async ({ request }) => {
  const get = await request.get("/api/store");
  expect(get.status()).toBe(401);
  const post = await request.post("/api/store", { data: {} });
  expect(post.status()).toBe(401);
});
