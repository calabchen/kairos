import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始使用" }).click();
});

async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: /新建任务/ }).click();
  await page.getByLabel("任务标题").fill(title);
  await page.getByLabel("截止时间").fill("2099-12-31T10:00");
  await page.getByRole("button", { name: "保存任务" }).click();
}

async function createRecurringTask(page: Page, title: string) {
  await page.getByRole("button", { name: /新建任务/ }).click();
  await page.getByLabel("任务标题").fill(title);
  await page.getByLabel("截止时间").fill("2099-12-31T10:00");
  await page.getByLabel("重复").selectOption("daily");
  await page.getByRole("button", { name: "保存任务" }).click();
}

test("creates a task in the board and completes it into the trash", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight && document.body.scrollHeight <= document.body.clientHeight)).toBe(true);
  await createTask(page, "Playwright 核心任务");
  const card = page.getByTestId("task-card").filter({ hasText: "Playwright 核心任务" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: /回收站/ }).click();
  await expect(page.getByText("Playwright 核心任务")).toBeVisible();
});

test("switches to the pinned widget and keeps direct task actions available", async ({ page }) => {
  await page.getByRole("button", { name: "Pin 小组件" }).click();
  await expect(page.getByRole("main", { name: "Kairos 小组件" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建任务" })).toBeVisible();
  await page.getByRole("button", { name: "新建任务" }).click();
  await page.getByLabel("任务标题").fill("小组件任务");
  await page.getByLabel("截止时间").fill("2099-12-31T10:00");
  await page.getByRole("button", { name: "保存任务" }).click();
  const card = page.getByTestId("widget-task-card").filter({ hasText: "小组件任务" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "完成" }).click();
  await expect(card).not.toBeVisible();
  await page.getByRole("button", { name: "取消 Pin" }).click();
  await expect(page.getByRole("button", { name: "Pin 小组件" })).toBeVisible();
});

test("search filters visible tasks without removing them", async ({ page }) => {
  await createTask(page, "可搜索任务");
  await createTask(page, "另一件事情");
  await page.getByLabel("搜索任务").fill("搜索");
  await expect(page.getByText("可搜索任务")).toBeVisible();
  await expect(page.getByText("另一件事情")).not.toBeVisible();
  await page.getByLabel("搜索任务").fill("");
  await expect(page.getByText("另一件事情")).toBeVisible();
  await page.getByTestId("task-card").filter({ hasText: "可搜索任务" }).getByRole("button", { name: "完成" }).click();
  await page.getByLabel("搜索任务").fill("可搜索任务");
  await expect(page.getByRole("status")).toContainText("找到 1 条（当前视图 0 条）");
  await page.getByRole("button", { name: /回收站/ }).click();
  await expect(page.getByText("可搜索任务")).toBeVisible();
  await page.getByRole("button", { name: /四象限/ }).click();
  await page.getByLabel("搜索任务").fill("不存在的任务");
  await expect(page.getByText("没有找到匹配任务，请换个关键词。")).toBeVisible();
});

test("moves a task by drag and drop and keeps the new quadrant after reload", async ({ page }) => {
  await createTask(page, "拖拽后保留");
  await page.evaluate(() => {
    const source = [...document.querySelectorAll<HTMLElement>("[data-testid='quadrant-do-now'] [data-testid='task-card']")].find((element) => element.textContent?.includes("拖拽后保留"));
    const target = document.querySelector<HTMLElement>("[data-testid='quadrant-eliminate']");
    if (!source || !target) throw new Error("找不到拖拽源或目标");
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
  });
  await expect(page.getByTestId("quadrant-eliminate").getByTestId("task-card").filter({ hasText: "拖拽后保留" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("quadrant-eliminate").getByTestId("task-card").filter({ hasText: "拖拽后保留" })).toBeVisible();
});

test("completes, edits and stops a recurring sequence without changing history", async ({ page }) => {
  await createRecurringTask(page, "重复任务");
  const card = page.getByTestId("task-card").filter({ hasText: "重复任务" });
  await expect(card.getByRole("button", { name: "停止重复" })).toBeVisible();
  await card.getByRole("button", { name: "完成" }).click();
  await expect(page.getByTestId("quadrant-do-now").getByTestId("task-card").filter({ hasText: "重复任务" })).toBeVisible();

  const activeCard = page.getByTestId("quadrant-do-now").getByTestId("task-card").filter({ hasText: "重复任务" });
  await activeCard.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("任务标题").fill("整个序列的新标题");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.getByRole("heading", { name: "应用到哪里？" }).waitFor();
  await page.getByRole("button", { name: "整个序列" }).click();
  await expect(page.getByTestId("quadrant-do-now").getByTestId("task-card").filter({ hasText: "整个序列的新标题" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("quadrant-do-now").getByTestId("task-card").filter({ hasText: "整个序列的新标题" }).getByRole("button", { name: "停止重复" }).click();
  await expect(page.getByTestId("quadrant-do-now").getByTestId("task-card").filter({ hasText: "整个序列的新标题" }).getByRole("button", { name: "停止重复" })).not.toBeVisible();

  await page.getByRole("button", { name: /回收站/ }).click();
  await expect(page.getByText("重复任务")).toBeVisible();
  await expect(page.getByText("整个序列的新标题")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /回收站/ }).click();
  await expect(page.getByText("重复任务")).toBeVisible();
});

test("wires export and interactive import conflict handling", async ({ page }) => {
  await page.addInitScript(() => {
    const current = {
      id: "current-task",
      title: "当前任务",
      important: true,
      urgent: true,
      dueAt: "2099-12-31T10:00",
      reminder: "none",
      recurrence: { type: "none" },
      completed: false,
      createdAt: "2099-12-01T00:00:00.000Z",
      updatedAt: "2099-12-01T00:00:00.000Z",
    };
    const file = () => JSON.parse(localStorage.getItem("e2e.file") ?? JSON.stringify({ version: 1, tasks: [] }));
    (window as any).kairos = {
      platform: "darwin",
      loadTasks: async () => file(),
      saveTasks: async (tasks: unknown[]) => localStorage.setItem("e2e.file", JSON.stringify({ version: 1, tasks })),
      getStartupSettings: async () => ({ openAtLogin: false }),
      setStartup: async () => ({ openAtLogin: false }),
      getNotificationStatus: async () => ({ supported: true }),
      requestNotification: async () => ({ supported: true, attempted: true }),
      exportTasks: async () => ({ canceled: false, count: file().tasks.length }),
      prepareImport: async () => ({
        canceled: false,
        token: "e2e-import",
        added: [],
        conflicts: [{ key: "id:current-task", reason: "id", current, incoming: { ...current, title: "导入任务" } }],
      }),
      resolveImport: async () => ({ canceled: false, added: 1, overwritten: 0, kept: 0, skipped: 0, duplicated: 0 }),
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "导出任务" }).click();
  await expect(page.getByRole("status")).toContainText("已导出");
  await page.getByRole("button", { name: "导入任务" }).click();
  await expect(page.getByRole("heading", { name: "选择如何处理重复任务" })).toBeVisible();
  await page.getByRole("button", { name: "全部导入覆盖" }).click();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByRole("status")).toContainText("跳过 0 条");
});
