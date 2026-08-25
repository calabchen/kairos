import { useEffect, useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Archive, Check, CircleHelp, Grid2X2, Pin, Plus, Repeat2, Search, Settings, Square, Trash2, X } from "lucide-react";
import {
  fromDatetimeLocal,
  formatLocalDateTime,
  isOverdue,
  parseLocalDateTime,
  quadrantFor,
  reminderOffsets,
  sortCompletedTasks,
  sortTasks,
  toDatetimeLocal,
  type QuadrantKey,
  type RecurrenceRule,
  type TaskInstance,
} from "../shared/task";
import type { ImportChoice, ImportPreview } from "../shared/ipc";
import type { WindowMode } from "../shared/windowMode";
import { useTaskStore } from "./stores/taskStore";
import { WidgetShell } from "./WidgetShell";

const quadrants: Array<{ key: QuadrantKey; label: string; hint: string; accent: string; number: string }> = [
  { key: "do-now", label: "立即处理", hint: "重要 · 紧急", accent: "coral", number: "01" },
  { key: "schedule", label: "计划处理", hint: "重要 · 不紧急", accent: "saffron", number: "02" },
  { key: "delegate", label: "尽快处理", hint: "不重要 · 紧急", accent: "lake", number: "03" },
  { key: "eliminate", label: "减少或删除", hint: "不重要 · 不紧急", accent: "slate", number: "04" },
];

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "七"];
type View = "board" | "trash" | "settings";
type Filter = "all" | "overdue" | "recurring";

const ui = {
  button: "inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40 disabled:cursor-not-allowed disabled:opacity-50",
  primaryButton: "bg-ink text-panel shadow-soft hover:bg-ink/90",
  secondaryButton: "border border-line bg-panel text-ink hover:bg-canvas",
  quietButton: "text-muted hover:bg-canvas hover:text-ink",
  iconButton: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-lg leading-none text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40",
  input: "h-10 rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-moss focus:ring-2 focus:ring-moss/15",
  label: "text-xs font-medium text-muted",
  card: "rounded-xl border border-line bg-panel p-4 shadow-card",
  meta: "font-mono text-[11px] leading-4 text-muted",
} as const;

const quadrantStyles: Record<QuadrantKey, { surface: string; border: string; dot: string }> = {
  "do-now": { surface: "bg-coral", border: "border-coralLine", dot: "bg-[#f25022]" },
  schedule: { surface: "bg-lake", border: "border-lakeLine", dot: "bg-[#00a4ef]" },
  delegate: { surface: "bg-saffron", border: "border-saffronLine", dot: "bg-[#ffb900]" },
  eliminate: { surface: "bg-slate", border: "border-slateLine", dot: "bg-[#7fba00]" },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDue(localDateTime: string) {
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime) ? parseLocalDateTime(localDateTime) : new Date(localDateTime);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function newTaskTemplate(): TaskInstance {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60, 0, 0);
  return {
    id: crypto.randomUUID(),
    title: "",
    important: true,
    urgent: true,
    dueAt: formatLocalDateTime(now),
    reminder: "none",
    recurrence: { type: "none" },
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function matchesFilter(task: TaskInstance, filter: Filter) {
  if (filter === "overdue") return isOverdue(task);
  if (filter === "recurring") return task.recurrence.type !== "none";
  return true;
}

function TaskCard({ task, onEdit, onComplete, onDelete, onStopSeries, onDragStart }: {
  task: TaskInstance;
  onEdit: () => void;
  onComplete?: () => void;
  onDelete: () => void;
  onStopSeries?: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const overdue = isOverdue(task);
  return <div data-testid="task-card" className={cn("group mt-2 rounded-lg border border-line bg-panel/90 p-3 shadow-card", overdue && "border-danger/30")} draggable={!task.completed} onDragStart={onDragStart}>
    <div className="flex items-start justify-between gap-3"><p className="min-w-0 flex-1 truncate text-sm leading-5 text-ink">{task.title}</p>{!task.completed && <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><button className="grid h-7 w-7 place-items-center rounded-md text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40" type="button" onClick={onEdit} aria-label="编辑" title="编辑"><Settings aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button><button className="grid h-7 w-7 place-items-center rounded-md text-green-700 transition-colors hover:bg-green-100 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40" type="button" onClick={onComplete} aria-label="完成" title="完成"><Check aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button>{onStopSeries && <button className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40" type="button" onClick={onStopSeries} aria-label="停止重复" title="停止重复"><Square aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button>}<button className="grid h-7 w-7 place-items-center rounded-md text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40" type="button" onClick={onDelete} aria-label="删除" title="删除"><Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div>}</div>
    <div className="mt-2 flex items-center gap-2"><span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-[#a2ad9a]", overdue && "bg-danger")} /><span className={cn("min-w-0 flex-1 truncate", ui.meta, overdue && "text-danger")}>{task.completed ? `完成于 ${formatDue(task.completedAt!)}` : `截止 ${formatDue(task.dueAt)}`}</span>{task.recurrence.type !== "none" && <span aria-label="重复任务" className="flex h-4 w-4 shrink-0 text-muted" title="重复任务"><Repeat2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></span>}</div>
  </div>;
}

function TaskModal({ task, onClose, onSave }: { task: TaskInstance; onClose: () => void; onSave: (task: TaskInstance) => void }) {
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState("");
  const recurrence = draft.recurrence;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return setError("请先写下任务标题");
    if (!draft.dueAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.dueAt) || Number.isNaN(parseLocalDateTime(draft.dueAt).getTime())) return setError("请设置有效的截止日期和时间");
    onSave({ ...draft, title: draft.title.trim() });
  }

  return <div className="fixed inset-0 z-10 grid place-items-center bg-ink/20 p-6 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-soft" onSubmit={save}>
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-xs uppercase tracking-[.14em] text-muted">{task.title ? "调整安排" : "一件新事情"}</p><h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{task.title ? "编辑任务" : "新建任务"}</h2></div><button className={ui.iconButton} type="button" onClick={onClose} aria-label="关闭"><X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div>
      <label className="mb-4 block"><span className={cn("mb-2 block", ui.label)}>任务标题</span><input className={cn("w-full", ui.input)} autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：准备周五的演示" /></label>
      <label className="mb-4 block"><span className={cn("mb-2 block", ui.label)}>截止时间</span><input className={cn("w-full", ui.input)} type="datetime-local" value={toDatetimeLocal(draft.dueAt)} onChange={(event) => setDraft({ ...draft, dueAt: fromDatetimeLocal(event.target.value) })} /></label>
      <div className="mb-4"><span className={cn("mb-2 block", ui.label)}>放入象限</span><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{quadrants.map((quadrant) => <button key={quadrant.key} type="button" className={cn(ui.button, "border", quadrantFor(draft) === quadrant.key ? "border-moss bg-moss text-panel" : "border-line bg-panel text-muted hover:bg-canvas")} onClick={() => setDraft({ ...draft, important: quadrant.key === "do-now" || quadrant.key === "schedule", urgent: quadrant.key === "do-now" || quadrant.key === "delegate" })}>{quadrant.label}</button>)}</div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={cn("mb-2 block", ui.label)}>提醒</span><select className={cn("w-full", ui.input)} value={draft.reminder} onChange={(event) => setDraft({ ...draft, reminder: event.target.value as TaskInstance["reminder"] })}>{reminderOffsets.map((offset) => <option key={offset} value={offset}>{({ none: "不提醒", "one-day": "提前一天", "one-hour": "提前一小时", "thirty-minutes": "提前30分钟", "fifteen-minutes": "提前15分钟", "at-time": "到点提醒" } as Record<string, string>)[offset]}</option>)}</select></label>
        <label className="block"><span className={cn("mb-2 block", ui.label)}>重复</span><select className={cn("w-full", ui.input)} value={recurrence.type} onChange={(event) => { const type = event.target.value as RecurrenceRule["type"]; setDraft({ ...draft, recurrence: type === "weekly" ? { type, weekdays: [new Date(draft.dueAt).getDay()] } : type === "monthly" ? { type, dayOfMonth: Math.min(new Date(draft.dueAt).getDate(), 30) } : { type } }); }}>{["none", "daily", "weekly", "monthly"].map((type) => <option key={type} value={type}>{({ none: "不重复", daily: "每天", weekly: "每周指定日期", monthly: "每月固定日期" } as Record<string, string>)[type]}</option>)}</select></label>
      </div>
      {recurrence.type === "weekly" && <div className="mt-4"><span className={cn("mb-2 block", ui.label)}>每周重复日</span><div className="flex gap-2">{weekdayLabels.map((label, displayDay) => { const day = (displayDay + 1) % 7; return <label key={day} className={cn("grid h-9 w-9 cursor-pointer place-items-center rounded-full border text-xs", recurrence.weekdays.includes(day) ? "border-moss bg-moss text-panel" : "border-line bg-panel text-muted hover:bg-canvas")}><input className="sr-only" type="checkbox" checked={recurrence.weekdays.includes(day)} onChange={() => { const weekdays = recurrence.weekdays.includes(day) ? recurrence.weekdays.filter((item) => item !== day) : [...recurrence.weekdays, day]; setDraft({ ...draft, recurrence: { type: "weekly", weekdays: weekdays.length ? weekdays : [day] } }); }} />{label}</label>; })}</div></div>}
      {recurrence.type === "monthly" && <label className="mt-4 block"><span className={cn("mb-2 block", ui.label)}>每月几号</span><input className={cn("w-full", ui.input)} type="number" min="1" max="30" value={recurrence.dayOfMonth} onChange={(event) => setDraft({ ...draft, recurrence: { type: "monthly", dayOfMonth: Math.max(1, Math.min(30, Number(event.target.value))) } })} /></label>}
      {error && <p className="mt-4 rounded-lg bg-coralSoft px-3 py-2 text-xs text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4"><button className={cn(ui.button, ui.quietButton)} type="button" onClick={onClose}>取消</button><button className={cn(ui.button, ui.primaryButton)} type="submit">保存任务</button></div>
    </form>
  </div>;
}

function DialogFrame({ children, onClose, labelledBy }: { children: ReactNode; onClose?: () => void; labelledBy?: string }) {
  return <div className="fixed inset-0 z-10 grid place-items-center bg-ink/20 p-6 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
    <div className="max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-soft" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
  </div>;
}

export function App() {
  const { tasks, hydrated, error, hydrate, addTask, updateTask, updateSeries, stopSeries, removeTask, removeSeries, completeTask, clearCompleted } = useTaskStore();
  const [view, setView] = useState<View>("board");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modalTask, setModalTask] = useState<TaskInstance | null>(null);
  const [welcome, setWelcome] = useState(() => localStorage.getItem("kairos.welcome.v1") !== "done");
  const [scopeTask, setScopeTask] = useState<TaskInstance | null>(null);
  const [notice, setNotice] = useState("");
  const [startup, setStartup] = useState<boolean | null>(null);
  const [notificationsSupported, setNotificationsSupported] = useState<boolean | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importChoices, setImportChoices] = useState<Record<string, ImportChoice>>({});
  const [deleteTarget, setDeleteTarget] = useState<TaskInstance | null>(null);
  const [windowMode, setWindowMode] = useState<WindowMode>("normal");

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => { void window.kairos?.getWindowPreferences?.().then((preferences) => setWindowMode(preferences.mode)).catch(() => undefined); }, []);
  useEffect(() => window.kairos?.onTasksChanged?.(() => { void hydrate(); }), [hydrate]);
  useEffect(() => { void window.kairos?.getStartupSettings?.().then((settings) => setStartup(settings.openAtLogin)).catch(() => undefined); }, []);
  useEffect(() => { void window.kairos?.getNotificationStatus?.().then((status) => setNotificationsSupported(status.supported)).catch(() => undefined); }, []);
  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((task) => task.completed)), [tasks]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchMatches = useMemo(() => normalizedQuery ? tasks.filter((task) => task.title.toLocaleLowerCase().includes(normalizedQuery)) : tasks, [normalizedQuery, tasks]);
  const visibleTasks = (view === "board" ? activeTasks : completedTasks).filter((task) => matchesFilter(task, filter) && (!normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery)));
  const currentSearchMatches = view === "board" ? searchMatches.filter((task) => !task.completed) : searchMatches.filter((task) => task.completed);

  function moveTask(event: DragEvent<HTMLElement>, quadrant: QuadrantKey) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/kairos-task");
    if (!id) return;
    updateTask(id, { important: quadrant === "do-now" || quadrant === "schedule", urgent: quadrant === "do-now" || quadrant === "delegate" });
  }

  function saveTask(task: TaskInstance) {
    const exists = tasks.some((item) => item.id === task.id);
    if (!exists) {
      void addTask(task.recurrence.type === "none" ? task : { ...task, seriesId: task.seriesId ?? task.id });
    } else if (task.recurrence.type !== "none" && task.seriesId) {
      setScopeTask(task);
      return;
    } else {
      void updateTask(task.id, task);
    }
    setModalTask(null);
  }

  function deleteTask(task: TaskInstance) {
    setDeleteTarget(task);
  }

  function confirmDelete(task: TaskInstance, wholeSeries = false) {
    if (task.recurrence.type !== "none" && task.seriesId) {
      void (wholeSeries ? removeSeries(task.seriesId) : removeTask(task.id));
    } else {
      void removeTask(task.id);
    }
    setDeleteTarget(null);
  }

  function stopTaskSeries(task: TaskInstance) {
    if (!task.seriesId || task.recurrence.type === "none") return;
    if (window.confirm("停止重复后，已生成的未完成实例会保留为一次性任务。确定停止吗？")) void stopSeries(task.seriesId);
  }

  function moveWidgetTask(event: DragEvent<HTMLElement>, quadrant: QuadrantKey) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/kairos-task");
    if (id) void updateTask(id, { important: quadrant === "do-now" || quadrant === "schedule", urgent: quadrant === "do-now" || quadrant === "delegate" });
  }

  async function toggleWindowMode() {
    const nextMode: WindowMode = windowMode === "normal" ? "widget" : "normal";
    try {
      const preferences = await window.kairos?.setWindowMode?.(nextMode);
      setWindowMode(preferences?.mode ?? nextMode);
    } catch {
      setNotice("窗口模式切换失败，请重试");
    }
  }

  if (!hydrated) return <main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">正在打开 Kairos…</main>;
  const openImport = () => void window.kairos?.prepareImport().then((preview) => { if (preview.canceled) return; setImportChoices({}); setImportPreview(preview); }).catch(() => setNotice("导入文件无效，当前数据未修改"));
  const openExport = () => void window.kairos?.exportTasks().then((result) => !result.canceled && setNotice(`已导出 ${result.count} 条任务`)).catch(() => setNotice("导出失败，请重试"));
  const toggleStartup = () => void window.kairos?.setStartup(!startup).then((settings) => setStartup(settings.openAtLogin)).catch(() => setNotice("开机启动设置失败，请重试"));
  const requestNotification = () => void window.kairos?.requestNotification().then((result) => setNotice(result.supported ? "已发送测试通知；如未显示，请在系统设置中允许 Kairos" : "当前系统不支持通知")).catch(() => setNotice("通知权限请求失败，请在系统设置中允许 Kairos"));

  if (windowMode === "widget") return <><WidgetShell tasks={tasks} onAdd={() => setModalTask(newTaskTemplate())} onComplete={(id) => void completeTask(id)} onExit={() => void toggleWindowMode()} onDropTask={moveWidgetTask} />{modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} onSave={saveTask} />}</>;

  return <main className="flex h-screen min-w-[960px] overflow-hidden bg-canvas text-ink">
    <aside className="flex w-48 shrink-0 flex-col border-r border-line bg-panel px-3 py-5" aria-label="主导航">
      <div className="flex items-center gap-2 px-2 pb-7"><span className="grid h-9 w-9 place-items-center rounded-full bg-ink font-display text-xl text-panel">K</span><strong className="font-display text-base font-semibold">Kairos</strong></div>
      <nav className="grid gap-1">
        <button className={cn("grid h-10 grid-cols-[20px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40", view === "board" ? "bg-ink text-panel shadow-soft" : "text-muted hover:bg-panel hover:text-ink")} type="button" onClick={() => setView("board")}><Grid2X2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /><span>四象限</span><b className="font-mono text-[11px] font-normal opacity-70">{activeTasks.length}</b></button>
        <button className={cn("grid h-10 grid-cols-[20px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40", view === "trash" ? "bg-ink text-panel shadow-soft" : "text-muted hover:bg-panel hover:text-ink")} type="button" onClick={() => setView("trash")}><Archive aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /><span>回收站</span><b className="font-mono text-[11px] font-normal opacity-70">{completedTasks.length}</b></button>
        <button className={cn("grid h-10 grid-cols-[20px_1fr_auto] items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40", view === "settings" ? "bg-ink text-panel shadow-soft" : "text-muted hover:bg-panel hover:text-ink")} type="button" onClick={() => setView("settings")}><Settings aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /><span>设置</span></button>
      </nav>
    </aside>
    <section className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden px-9 py-6">
      <header className="flex min-h-[68px] items-center justify-between gap-3"><div className="min-w-0 flex-1"><h1 className="whitespace-nowrap font-display text-lg font-semibold leading-tight tracking-tight">{view === "board" ? "把重要的事，放在恰当的时机。" : view === "trash" ? "已经完成的事情，也值得被看见。" : "让 Kairos 按你的方式工作。"}</h1></div><div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{view !== "settings" && <><label className="relative flex h-10 w-36 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-muted focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/15"><Search aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部任务" aria-label="搜索任务" /></label><select className={cn(ui.input, "w-28")} value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="筛选任务"><option value="all">全部任务</option><option value="overdue">只看逾期</option><option value="recurring">只看重复</option></select><button className={cn(ui.button, ui.primaryButton, "px-3")} type="button" onClick={() => setModalTask(newTaskTemplate())}><Plus aria-hidden="true" className="mr-2 h-4 w-4" strokeWidth={1.8} />新建任务</button></>}{<button className={ui.iconButton} type="button" onClick={() => void toggleWindowMode()} aria-label="Pin 小组件" title="切换小组件模式"><Pin aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button>}</div></header>
      {error && <div className="mb-3 flex items-center justify-between rounded-lg border border-danger/20 bg-coralSoft px-3 py-2 text-xs text-danger" role="alert"><span>{error}</span><button className="underline underline-offset-2" type="button" onClick={() => void hydrate()}>重新读取</button></div>}
      {notice && <div className="mb-3 rounded-lg border border-moss/20 bg-mossSoft px-3 py-2 text-xs text-moss" role="status">{notice}</div>}
      {view === "settings" ? <section className="min-h-0 flex-1 overflow-auto pt-5" aria-label="应用设置">
        <div className={cn(ui.card, "flex items-center gap-4 border-moss/20 bg-mossSoft")}><button className={ui.iconButton} type="button" onClick={() => setWelcome(true)} aria-label="查看使用说明"><CircleHelp aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button><div><p className="mb-1 font-mono text-xs uppercase tracking-[.14em] text-muted">帮助与数据</p><h2 className="font-display text-lg font-semibold">把控制权留在手边</h2><p className="mt-1 text-xs leading-5 text-muted">点击问号重新查看使用说明。</p></div></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3"><section className={ui.card}><div className="flex items-start justify-between"><div><p className="mb-1 font-mono text-xs uppercase tracking-[.14em] text-muted">备份与迁移</p><h2 className="font-display text-lg font-semibold">导入 / 导出</h2></div><span className={ui.meta}>01</span></div><p className="mt-3 text-xs leading-5 text-muted">使用带版本信息的 JSON 文件备份或迁移全部任务。</p><div className="mt-5 flex gap-2"><button className={cn(ui.button, ui.primaryButton)} type="button" onClick={openExport}>导出任务</button><button className={cn(ui.button, ui.secondaryButton)} type="button" onClick={openImport}>导入任务</button></div></section>
          <section className={ui.card}><div className="flex items-start justify-between"><div><p className="mb-1 font-mono text-xs uppercase tracking-[.14em] text-muted">系统行为</p><h2 className="font-display text-lg font-semibold">开机启动</h2></div><span className={ui.meta}>02</span></div><p className="mt-3 text-xs leading-5 text-muted">登录 macOS 后在后台驻留托盘，不自动打开主窗口。</p>{startup !== null && <button className="mt-5 flex h-9 items-center gap-2 text-xs text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40" type="button" onClick={toggleStartup}><span className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", startup ? "bg-moss" : "bg-line")}><i className={cn("h-4 w-4 rounded-full bg-panel shadow-sm transition-transform", startup && "translate-x-4")} /></span><span>{startup ? "已开启开机启动" : "开启开机启动"}</span></button>}</section>
          <section className={ui.card}><div className="flex items-start justify-between"><div><p className="mb-1 font-mono text-xs uppercase tracking-[.14em] text-muted">系统通知</p><h2 className="font-display text-lg font-semibold">通知权限</h2></div><span className={ui.meta}>03</span></div><p className="mt-3 text-xs leading-5 text-muted">发送一条测试通知，确认系统权限和提醒链路正常。</p>{notificationsSupported !== null && <button className={cn(ui.button, ui.secondaryButton, "mt-5")} type="button" onClick={requestNotification}>{notificationsSupported ? "测试 / 重新请求通知" : "通知不可用"}</button>}</section></div>
      </section> : <>
        {normalizedQuery && <div className="mb-3 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted" role="status">搜索范围：全部任务 · 找到 {searchMatches.length} 条（当前视图 {currentSearchMatches.length} 条）</div>}
        {normalizedQuery && searchMatches.length === 0 ? <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-dashed border-line text-sm text-muted" role="status">没有找到匹配任务，请换个关键词。</div> : view === "board" ? <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3" aria-label="四象限任务看板">{quadrants.map((quadrant) => { const quadrantTasks = sortTasks(visibleTasks.filter((task) => quadrantFor(task) === quadrant.key)); const palette = quadrantStyles[quadrant.key]; return <article key={quadrant.key} aria-label={`${quadrant.label}：${quadrant.hint}`} data-testid={`quadrant-${quadrant.key}`} className={cn("min-h-0 overflow-hidden rounded-xl border", palette.surface, palette.border)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveTask(event, quadrant.key)}><header className="flex items-center justify-between px-4 pb-2 pt-3"><p className="text-xs font-semibold text-ink">{quadrant.hint}</p><span className="grid h-7 min-w-7 place-items-center rounded-full border border-white/60 font-mono text-[11px] text-muted">{quadrantTasks.length}</span></header><div className="min-h-0 overflow-y-auto px-2.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{quadrantTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onComplete={() => completeTask(task.id)} onDelete={() => deleteTask(task)} onStopSeries={task.recurrence.type !== "none" && task.seriesId ? () => stopTaskSeries(task) : undefined} onDragStart={(event) => event.dataTransfer.setData("text/kairos-task", task.id)} />)}{quadrantTasks.length === 0 && <div className="pt-8 text-center text-xs leading-6 text-muted">把事情放到这里<br /><span className="text-muted/70">拖入任务，或新建一件事</span></div>}</div></article>; })}</section> : <section className="min-h-0 flex-1 overflow-auto pt-5"><div className="mb-4 flex items-end justify-between"><div><p className="mb-1 font-mono text-xs uppercase tracking-[.14em] text-muted">完成记录</p><h2 className="font-display text-2xl font-semibold">已完成的事情</h2></div>{completedTasks.length > 0 && <button className={cn(ui.button, ui.quietButton)} type="button" onClick={clearCompleted}>清空回收站</button>}</div>{visibleTasks.length === 0 ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">这里还没有完成记录。</div> : <div className="grid gap-2 sm:grid-cols-2">{visibleTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onDelete={() => undefined} onDragStart={() => undefined} />)}</div>}</section>}
      </>}
    </section>
    {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} onSave={saveTask} />}
    {scopeTask && <DialogFrame onClose={() => setScopeTask(null)} labelledBy="scope-dialog-title"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-xs uppercase tracking-[.14em] text-muted">重复任务</p><h2 id="scope-dialog-title" className="font-display text-2xl font-semibold text-ink">应用到哪里？</h2></div><button className={ui.iconButton} type="button" onClick={() => setScopeTask(null)} aria-label="关闭"><X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div><p className="text-sm leading-6 text-muted">只修改当前实例，还是修改这个序列中所有未完成实例？</p><div className="mt-6 flex justify-end gap-2 border-t border-line pt-4"><button className={cn(ui.button, ui.quietButton)} type="button" onClick={() => { void updateTask(scopeTask.id, scopeTask); setScopeTask(null); setModalTask(null); }}>当前实例</button><button className={cn(ui.button, ui.primaryButton)} type="button" onClick={() => { void updateSeries(scopeTask.seriesId!, scopeTask); setScopeTask(null); setModalTask(null); }}>整个序列</button></div></DialogFrame>}
    {importPreview?.token && <DialogFrame onClose={() => setImportPreview(null)} labelledBy="import-dialog-title"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-xs uppercase tracking-[.14em] text-muted">导入冲突</p><h2 id="import-dialog-title" className="font-display text-2xl font-semibold text-ink">选择如何处理重复任务</h2></div><button className={ui.iconButton} type="button" onClick={() => setImportPreview(null)} aria-label="取消"><X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div><p className="text-sm leading-6 text-muted">没有冲突的任务会直接新增。以下冲突可以逐条处理，也可以统一选择。</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "keep-current"]))) }>全部保留当前</button><button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "overwrite"]))) }>全部导入覆盖</button><button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "duplicate"]))) }>全部保留两者</button></div><div className="mt-4 space-y-3">{importPreview.conflicts.map((conflict) => <label className="block" key={conflict.key}><span className={cn("mb-2 block", ui.label)}>{conflict.reason === "id" ? "ID 冲突" : "内容冲突"}：{conflict.incoming.title}</span><select className={cn("w-full", ui.input)} value={importChoices[conflict.key] ?? "keep-current"} onChange={(event) => setImportChoices({ ...importChoices, [conflict.key]: event.target.value as ImportChoice })}><option value="keep-current">保留当前</option><option value="overwrite">导入覆盖</option><option value="duplicate">两者保留并生成新 ID</option></select></label>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-line pt-4"><button className={cn(ui.button, ui.quietButton)} type="button" onClick={() => setImportPreview(null)}>取消导入</button><button className={cn(ui.button, ui.primaryButton)} type="button" onClick={() => void window.kairos.resolveImport(importPreview.token!, importChoices).then((result) => { setImportPreview(null); setNotice(`导入完成：新增 ${result.added} 条，覆盖 ${result.overwritten} 条，保留 ${result.kept} 条，跳过 ${result.skipped} 条，复制 ${result.duplicated} 条`); return hydrate(); }).catch(() => setNotice("导入失败，当前数据未修改"))}>确认导入</button></div></DialogFrame>}
    {deleteTarget && <DialogFrame onClose={() => setDeleteTarget(null)} labelledBy="delete-dialog-title"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-xs uppercase tracking-[.14em] text-danger">删除确认</p><h2 id="delete-dialog-title" className="font-display text-2xl font-semibold text-ink">确定删除这个任务吗？</h2></div><button className={ui.iconButton} type="button" onClick={() => setDeleteTarget(null)} aria-label="取消"><X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div>{deleteTarget.seriesId && deleteTarget.recurrence.type !== "none" ? <><p className="text-sm leading-6 text-muted">这是重复任务，请选择删除范围。已完成的历史记录不会被删除。</p><div className="mt-6 flex justify-end gap-2 border-t border-line pt-4"><button className={cn(ui.button, ui.quietButton)} type="button" onClick={() => setDeleteTarget(null)}>取消</button><button className={cn(ui.button, ui.secondaryButton)} type="button" onClick={() => confirmDelete(deleteTarget)}>仅当前实例</button><button className={cn(ui.button, "bg-red-600 text-white hover:bg-red-700")} type="button" onClick={() => confirmDelete(deleteTarget, true)}>整个序列</button></div></> : <><p className="text-sm leading-6 text-muted">删除后无法恢复，确定继续吗？</p><div className="mt-6 flex justify-end gap-2 border-t border-line pt-4"><button className={cn(ui.button, ui.quietButton)} type="button" onClick={() => setDeleteTarget(null)}>取消</button><button className={cn(ui.button, "bg-red-600 text-white hover:bg-red-700")} type="button" onClick={() => confirmDelete(deleteTarget)}>删除任务</button></div></>}</DialogFrame>}
    {welcome && <DialogFrame labelledBy="welcome-dialog-title"><div className="mb-6"><p className="mb-2 font-mono text-xs uppercase tracking-[.14em] text-muted">第一次使用</p><h2 id="welcome-dialog-title" className="font-display text-2xl font-semibold text-ink">欢迎来到 Kairos</h2></div><p className="text-sm leading-6 text-muted">四象限帮助你区分重要与紧急：先处理重要且紧急的事，再安排重要但不紧急的事，其余事情可以委托或减少。</p><p className="mt-3 text-sm leading-6 text-muted">点击“新建任务”填写标题和截止时间，也可以把任务拖到不同象限。关闭窗口时 Kairos 会继续驻留托盘并发送提醒。</p><div className="mt-6 flex justify-end border-t border-line pt-4"><button className={cn(ui.button, ui.primaryButton)} type="button" onClick={() => { localStorage.setItem("kairos.welcome.v1", "done"); setWelcome(false); }}>开始使用</button></div></DialogFrame>}
  </main>;
}
