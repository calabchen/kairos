import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
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
import { useTaskStore } from "./stores/taskStore";

const quadrants: Array<{ key: QuadrantKey; label: string; hint: string; accent: string; number: string }> = [
  { key: "do-now", label: "立即处理", hint: "重要 · 紧急", accent: "coral", number: "01" },
  { key: "schedule", label: "计划处理", hint: "重要 · 不紧急", accent: "saffron", number: "02" },
  { key: "delegate", label: "尽快处理", hint: "不重要 · 紧急", accent: "lake", number: "03" },
  { key: "eliminate", label: "减少或删除", hint: "不重要 · 不紧急", accent: "slate", number: "04" },
];

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
type View = "board" | "trash";
type Filter = "all" | "overdue" | "recurring";

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
  return <div className={`task-card ${overdue ? "is-overdue" : ""}`} draggable={!task.completed} onDragStart={onDragStart}>
    <div className="task-card__top"><span className={`task-card__dot ${overdue ? "task-card__dot--late" : ""}`} /><span className="task-card__due">{task.completed ? `完成于 ${formatDue(task.completedAt!)}` : `截止 ${formatDue(task.dueAt)}`}</span>{task.recurrence.type !== "none" && <span className="task-card__repeat" title="重复任务">↻</span>}</div>
    <p className="task-card__title">{task.title}</p>
    {!task.completed && <div className="task-card__actions">{onComplete && <button type="button" onClick={onComplete}>完成</button>}<button type="button" onClick={onEdit}>编辑</button>{onStopSeries && <button type="button" onClick={onStopSeries}>停止重复</button>}<button type="button" className="task-card__delete" onClick={onDelete}>删除</button></div>}
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal" onSubmit={save}>
      <div className="modal__header"><div><p className="eyebrow">{task.title ? "调整安排" : "一件新事情"}</p><h2>{task.title ? "编辑任务" : "新建任务"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <label className="field"><span>任务标题</span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：准备周五的演示" /></label>
      <label className="field"><span>截止时间</span><input type="datetime-local" value={toDatetimeLocal(draft.dueAt)} onChange={(event) => setDraft({ ...draft, dueAt: fromDatetimeLocal(event.target.value) })} /></label>
      <div className="field"><span>放入象限</span><div className="segmented segmented--four">{quadrants.map((quadrant) => <button key={quadrant.key} type="button" className={quadrantFor(draft) === quadrant.key ? "is-selected" : ""} onClick={() => setDraft({ ...draft, important: quadrant.key === "do-now" || quadrant.key === "schedule", urgent: quadrant.key === "do-now" || quadrant.key === "delegate" })}>{quadrant.label}</button>)}</div></div>
      <div className="form-grid">
        <label className="field"><span>提醒</span><select value={draft.reminder} onChange={(event) => setDraft({ ...draft, reminder: event.target.value as TaskInstance["reminder"] })}>{reminderOffsets.map((offset) => <option key={offset} value={offset}>{({ none: "不提醒", "one-day": "提前一天", "one-hour": "提前一小时", "thirty-minutes": "提前30分钟", "fifteen-minutes": "提前15分钟", "at-time": "到点提醒" } as Record<string, string>)[offset]}</option>)}</select></label>
        <label className="field"><span>重复</span><select value={recurrence.type} onChange={(event) => { const type = event.target.value as RecurrenceRule["type"]; setDraft({ ...draft, recurrence: type === "weekly" ? { type, weekdays: [new Date(draft.dueAt).getDay()] } : type === "monthly" ? { type, dayOfMonth: Math.min(new Date(draft.dueAt).getDate(), 30) } : { type } }); }}>{["none", "daily", "weekly", "monthly"].map((type) => <option key={type} value={type}>{({ none: "不重复", daily: "每天", weekly: "每周指定日期", monthly: "每月固定日期" } as Record<string, string>)[type]}</option>)}</select></label>
      </div>
      {recurrence.type === "weekly" && <div className="field"><span>每周重复日</span><div className="weekday-picker">{weekdayLabels.map((label, day) => <label key={day} className={recurrence.weekdays.includes(day) ? "is-selected" : ""}><input type="checkbox" checked={recurrence.weekdays.includes(day)} onChange={() => { const weekdays = recurrence.weekdays.includes(day) ? recurrence.weekdays.filter((item) => item !== day) : [...recurrence.weekdays, day]; setDraft({ ...draft, recurrence: { type: "weekly", weekdays: weekdays.length ? weekdays : [day] } }); }} />{label}</label>)}</div></div>}
      {recurrence.type === "monthly" && <label className="field"><span>每月几号</span><input type="number" min="1" max="30" value={recurrence.dayOfMonth} onChange={(event) => setDraft({ ...draft, recurrence: { type: "monthly", dayOfMonth: Math.max(1, Math.min(30, Number(event.target.value))) } })} /></label>}
      {error && <p className="form-error">{error}</p>}
      <div className="modal__footer"><button className="button button--quiet" type="button" onClick={onClose}>取消</button><button className="button button--dark" type="submit">保存任务</button></div>
    </form>
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

  useEffect(() => { void hydrate(); }, [hydrate]);
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
    if (!window.confirm("确定删除这个任务吗？")) return;
    if (task.recurrence.type !== "none" && task.seriesId) {
      const wholeSeries = window.confirm("这是重复任务。点击“确定”删除整个序列，点击“取消”仅删除当前实例。");
      void (wholeSeries ? removeSeries(task.seriesId) : removeTask(task.id));
      return;
    }
    void removeTask(task.id);
  }

  function stopTaskSeries(task: TaskInstance) {
    if (!task.seriesId || task.recurrence.type === "none") return;
    if (window.confirm("停止重复后，已生成的未完成实例会保留为一次性任务。确定停止吗？")) void stopSeries(task.seriesId);
  }

  if (!hydrated) return <main className="loading-screen">正在打开 Kairos…</main>;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand__mark">K</span><div><p className="eyebrow">Kairos / 今日安排</p><h1>把重要的事，放在恰当的时机。</h1></div></div><div className="topbar__actions"><button className="text-button" type="button" onClick={() => setWelcome(true)}>使用说明</button>{window.kairos?.exportTasks && <><button className="text-button" type="button" onClick={() => void window.kairos.exportTasks().then((result) => !result.canceled && setNotice(`已导出 ${result.count} 条任务`)).catch(() => setNotice("导出失败，请重试"))}>导出</button><button className="text-button" type="button" onClick={() => void window.kairos.prepareImport().then((preview) => { if (preview.canceled) return; setImportChoices({}); setImportPreview(preview); }).catch(() => setNotice("导入文件无效，当前数据未修改"))}>导入</button></>}<button className="button button--dark" type="button" onClick={() => setModalTask(newTaskTemplate())}><span className="button__plus">+</span>新建任务</button></div></header>
    {error && <div className="app-error" role="alert">{error} <button type="button" onClick={() => void hydrate()}>重新读取</button></div>}
    {notice && <div className="app-notice" role="status">{notice}</div>}
    <section className="toolbar"><div className="view-tabs"><button className={view === "board" ? "is-active" : ""} onClick={() => setView("board")} type="button">四象限 <b>{activeTasks.length}</b></button><button className={view === "trash" ? "is-active" : ""} onClick={() => setView("trash")} type="button">回收站 <b>{completedTasks.length}</b></button></div><div className="toolbar__right"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部任务" aria-label="搜索任务" /></label><select className="filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="筛选任务"><option value="all">全部任务</option><option value="overdue">只看逾期</option><option value="recurring">只看重复</option></select></div></section>
    {normalizedQuery && <div className="search-summary" role="status">搜索范围：全部任务 · 找到 {searchMatches.length} 条（当前视图 {currentSearchMatches.length} 条）</div>}
    {normalizedQuery && searchMatches.length === 0 ? <div className="empty-search" role="status">没有找到匹配任务，请换个关键词。</div> : view === "board" ? <section className="quadrant-grid" aria-label="四象限任务看板">{quadrants.map((quadrant) => { const quadrantTasks = sortTasks(visibleTasks.filter((task) => quadrantFor(task) === quadrant.key)); return <article key={quadrant.key} className={`quadrant quadrant--${quadrant.accent}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveTask(event, quadrant.key)}><header className="quadrant__header"><div><span className="quadrant__number">{quadrant.number}</span><h2>{quadrant.label}</h2><p>{quadrant.hint}</p></div><span className="quadrant__count">{quadrantTasks.length}</span></header><div className="quadrant__tasks">{quadrantTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onComplete={() => completeTask(task.id)} onDelete={() => deleteTask(task)} onStopSeries={task.recurrence.type !== "none" && task.seriesId ? () => stopTaskSeries(task) : undefined} onDragStart={(event) => event.dataTransfer.setData("text/kairos-task", task.id)} />)}{quadrantTasks.length === 0 && <div className="empty-quadrant">把事情放到这里<br /><span>拖入任务，或新建一件事</span></div>}</div></article>; })}</section> : <section className="trash-view"><div className="trash-view__heading"><div><span className="eyebrow">完成记录</span><h2>已完成的事情</h2></div>{completedTasks.length > 0 && <button className="text-button" type="button" onClick={clearCompleted}>清空回收站</button>}</div>{visibleTasks.length === 0 ? <div className="empty-trash">这里还没有完成记录。</div> : <div className="trash-list">{visibleTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onDelete={() => undefined} onDragStart={() => undefined} />)}</div>}</section>}
    <footer className="statusbar"><span><i className="status-dot" />数据仅保存在本机</span><span>{startup !== null && window.kairos?.setStartup ? <button className="text-button" type="button" onClick={() => void window.kairos.setStartup(!startup).then((settings) => setStartup(settings.openAtLogin)).catch(() => setNotice("开机启动设置失败，请重试"))}>{startup ? "已开启开机启动" : "开启开机启动"}</button> : null}{notificationsSupported !== null && <button className="text-button" type="button" onClick={() => void window.kairos.requestNotification().then((result) => setNotice(result.supported ? "已发送测试通知；如未显示，请在系统设置中允许 Kairos" : "当前系统不支持通知")).catch(() => setNotice("通知权限请求失败，请在系统设置中允许 Kairos"))}>{notificationsSupported ? "测试/重新请求通知" : "通知不可用"}</button>}</span><span>{activeTasks.filter((task) => isOverdue(task)).length ? `有 ${activeTasks.filter((task) => isOverdue(task)).length} 件逾期` : "今天，稳稳向前"}</span></footer>
    {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} onSave={saveTask} />}
    {scopeTask && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal__header"><div><p className="eyebrow">重复任务</p><h2>应用到哪里？</h2></div><button className="icon-button" type="button" onClick={() => setScopeTask(null)} aria-label="关闭">×</button></div><p>只修改当前实例，还是修改这个序列中所有未完成实例？</p><div className="modal__footer"><button className="button button--quiet" type="button" onClick={() => { void updateTask(scopeTask.id, scopeTask); setScopeTask(null); setModalTask(null); }}>当前实例</button><button className="button button--dark" type="button" onClick={() => { void updateSeries(scopeTask.seriesId!, scopeTask); setScopeTask(null); setModalTask(null); }}>整个序列</button></div></div></div>}
    {importPreview?.token && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal__header"><div><p className="eyebrow">导入冲突</p><h2>选择如何处理重复任务</h2></div><button className="icon-button" type="button" onClick={() => setImportPreview(null)} aria-label="取消">×</button></div><p>没有冲突的任务会直接新增。以下冲突可以逐条处理，也可以统一选择。</p><div className="modal__footer"><button type="button" className="text-button" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "keep-current"]))) }>全部保留当前</button><button type="button" className="text-button" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "overwrite"]))) }>全部导入覆盖</button><button type="button" className="text-button" onClick={() => setImportChoices(Object.fromEntries(importPreview.conflicts.map((conflict) => [conflict.key, "duplicate"]))) }>全部保留两者</button></div>{importPreview.conflicts.map((conflict) => <label className="field" key={conflict.key}><span>{conflict.reason === "id" ? "ID 冲突" : "内容冲突"}：{conflict.incoming.title}</span><select value={importChoices[conflict.key] ?? "keep-current"} onChange={(event) => setImportChoices({ ...importChoices, [conflict.key]: event.target.value as ImportChoice })}><option value="keep-current">保留当前</option><option value="overwrite">导入覆盖</option><option value="duplicate">两者保留并生成新 ID</option></select></label>)}<div className="modal__footer"><button className="button button--quiet" type="button" onClick={() => setImportPreview(null)}>取消导入</button><button className="button button--dark" type="button" onClick={() => void window.kairos.resolveImport(importPreview.token!, importChoices).then((result) => { setImportPreview(null); setNotice(`导入完成：新增 ${result.added} 条，覆盖 ${result.overwritten} 条，保留 ${result.kept} 条，跳过 ${result.skipped} 条，复制 ${result.duplicated} 条`); return hydrate(); }).catch(() => setNotice("导入失败，当前数据未修改"))}>确认导入</button></div></div></div>}
    {welcome && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal__header"><div><p className="eyebrow">第一次使用</p><h2>欢迎来到 Kairos</h2></div></div><p>四象限帮助你区分重要与紧急：先处理“立即处理”，再安排“计划处理”，把其余事情委托或减少。</p><p>点击“新建任务”填写标题和截止时间，也可以把任务拖到不同象限。关闭窗口时 Kairos 会继续驻留托盘并发送提醒。</p><div className="modal__footer"><button className="button button--dark" type="button" onClick={() => { localStorage.setItem("kairos.welcome.v1", "done"); setWelcome(false); }}>开始使用</button></div></div></div>}
  </main>;
}
