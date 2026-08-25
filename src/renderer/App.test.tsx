import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./stores/taskStore", () => ({
  useTaskStore: () => ({
    tasks: [],
    hydrated: true,
    error: null,
    hydrate: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    updateSeries: vi.fn(),
    stopSeries: vi.fn(),
    removeTask: vi.fn(),
    removeSeries: vi.fn(),
    completeTask: vi.fn(),
    clearCompleted: vi.fn(),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "kairos", {
    configurable: true,
    value: {
      platform: "test",
      getStartupSettings: vi.fn().mockResolvedValue({ openAtLogin: false }),
      getNotificationStatus: vi.fn().mockResolvedValue({ supported: false }),
      prepareImport: vi.fn(),
      resolveImport: vi.fn(),
      exportTasks: vi.fn(),
      requestNotification: vi.fn(),
      setStartup: vi.fn(),
      loadTasks: vi.fn(),
    saveTasks: vi.fn(),
      getWindowPreferences: vi.fn().mockResolvedValue({ mode: "normal" }),
      setWindowMode: vi.fn().mockImplementation(async (mode) => ({ mode })),
      onTasksChanged: vi.fn().mockReturnValue(() => undefined),
    } satisfies Window["kairos"],
  });
});

afterEach(() => cleanup());

describe("App", () => {
  it("shows the first-use guide and all four quadrants", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "欢迎来到 Kairos" })).toBeInTheDocument();
    expect(screen.getByText("重要 · 紧急")).toBeInTheDocument();
    expect(screen.getByText("重要 · 不紧急")).toBeInTheDocument();
    expect(screen.getByText("不重要 · 紧急")).toBeInTheDocument();
    expect(screen.getByText("不重要 · 不紧急")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始使用" }));
    expect(screen.queryByRole("heading", { name: "欢迎来到 Kairos" })).not.toBeInTheDocument();
  });

  it("keeps settings actions in the settings view", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "开始使用" }));
    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("heading", { name: "导入 / 导出" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看使用说明" })).toBeInTheDocument();
    expect(screen.queryByText("重要 · 紧急")).not.toBeInTheDocument();
  });

  it("shows weekly recurrence labels from Monday to Sunday", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "开始使用" }));
    fireEvent.click(screen.getByRole("button", { name: /新建任务/ }));
    fireEvent.change(screen.getByLabelText("重复"), { target: { value: "weekly" } });

    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(screen.getByText("一")).toBeInTheDocument();
    expect(screen.getByText("七")).toBeInTheDocument();
    expect(screen.queryByText("日")).not.toBeInTheDocument();
  });

  it("switches into the compact widget mode from Pin", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "开始使用" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin 小组件" }));

    expect(await screen.findByRole("main", { name: "Kairos 小组件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消 Pin" })).toBeInTheDocument();
    expect(screen.getByTestId("widget-quadrant-do-now")).toBeInTheDocument();
  });
});
