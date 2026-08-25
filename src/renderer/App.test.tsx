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
    } satisfies Window["kairos"],
  });
});

afterEach(() => cleanup());

describe("App", () => {
  it("shows the first-use guide and all four quadrants", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "欢迎来到 Kairos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "立即处理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "计划处理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "尽快处理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "减少或删除" })).toBeInTheDocument();

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
    expect(screen.queryByRole("heading", { name: "立即处理" })).not.toBeInTheDocument();
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
});
