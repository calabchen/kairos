import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  fromDatetimeLocal,
  isOverdue,
  quadrantFor,
  reminderOffsets,
  sortCompletedTasks,
  sortTasks,
  toDatetimeLocal,
  type QuadrantKey,
  type RecurrenceRule,
  type TaskInstance,
} from "../shared/task";
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

function formatDue(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function newTaskTemplate(): TaskInstance {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60, 0, 0);
  return {
    id: crypto.randomUUID(),
    title: "",
    important: true,
    urgent: true,
    dueAt: now.toISOString(),
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

function TaskCard({ task, onEdit, onComplete, onDelete, onDragStart }: {
  task: TaskInstance;
  onEdit: () => void;
  onComplete?: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const overdue = isOverdue(task);
  return <div className={`task-card ${overdue ? "is-overdue" : ""}`} draggable={!task.completed} onDragStart={onDragStart}>
    <div className="task-card__top"><span className={`task-card__dot ${overdue ? "task-card__dot--late" : ""}`} /><span className="task-card__due">{task.completed ? `完成于 ${formatDue(task.completedAt!)}` : `截止 ${formatDue(task.dueAt)}`}</span>{task.recurrence.type !== "none" && <span className="task-card__repeat" title="重复任务">↻</span>}</div>
    <p className="task-card__title">{task.title}</p>
    {!task.completed && <div className="task-card__actions">{onComplete && <button type="button" onClick={onComplete}>完成</button>}<button type="button" onClick={onEdit}>编辑</button><button type="button" className="task-card__delete" onClick={onDelete}>删除</button></div>}
  </div>;
}

function TaskModal({ task, onClose, onSave }: { task: TaskInstance; onClose: () => void; onSave: (task: TaskInstance) => void }) {
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState("");
  const recurrence = draft.recurrence;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return setError("请先写下任务标题");
    if (!draft.dueAt || Number.isNaN(Date.parse(draft.dueAt))) return setError("请设置截止日期和时间");
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
  const { tasks, hydrated, hydrate, addTask, updateTask, removeTask, completeTask, clearCompleted } = useTaskStore();
  const [view, setView] = useState<View>("board");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modalTask, setModalTask] = useState<TaskInstance | null>(null);

  useEffect(() => hydrate(), [hydrate]);
  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((task) => task.completed)), [tasks]);
  const visibleTasks = (view === "board" ? activeTasks : completedTasks).filter((task) => matchesFilter(task, filter) && task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function moveTask(event: DragEvent<HTMLElement>, quadrant: QuadrantKey) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/kairos-task");
    if (!id) return;
    updateTask(id, { important: quadrant === "do-now" || quadrant === "schedule", urgent: quadrant === "do-now" || quadrant === "delegate" });
  }

  if (!hydrated) return <main className="loading-screen">正在打开 Kairos…</main>;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand__mark">K</span><div><p className="eyebrow">Kairos / 今日安排</p><h1>把重要的事，放在恰当的时机。</h1></div></div><button className="button button--dark" type="button" onClick={() => setModalTask(newTaskTemplate())}><span className="button__plus">+</span>新建任务</button></header>
    <section className="toolbar"><div className="view-tabs"><button className={view === "board" ? "is-active" : ""} onClick={() => setView("board")} type="button">四象限 <b>{activeTasks.length}</b></button><button className={view === "trash" ? "is-active" : ""} onClick={() => setView("trash")} type="button">回收站 <b>{completedTasks.length}</b></button></div><div className="toolbar__right"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务" aria-label="搜索任务" /></label><select className="filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="筛选任务"><option value="all">全部任务</option><option value="overdue">只看逾期</option><option value="recurring">只看重复</option></select></div></section>
    {view === "board" ? <section className="quadrant-grid" aria-label="四象限任务看板">{quadrants.map((quadrant) => { const quadrantTasks = sortTasks(visibleTasks.filter((task) => quadrantFor(task) === quadrant.key)); return <article key={quadrant.key} className={`quadrant quadrant--${quadrant.accent}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveTask(event, quadrant.key)}><header className="quadrant__header"><div><span className="quadrant__number">{quadrant.number}</span><h2>{quadrant.label}</h2><p>{quadrant.hint}</p></div><span className="quadrant__count">{quadrantTasks.length}</span></header><div className="quadrant__tasks">{quadrantTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onComplete={() => completeTask(task.id)} onDelete={() => window.confirm("确定删除这个任务吗？") && removeTask(task.id)} onDragStart={(event) => event.dataTransfer.setData("text/kairos-task", task.id)} />)}{quadrantTasks.length === 0 && <div className="empty-quadrant">把事情放到这里<br /><span>拖入任务，或新建一件事</span></div>}</div></article>; })}</section> : <section className="trash-view"><div className="trash-view__heading"><div><span className="eyebrow">完成记录</span><h2>已完成的事情</h2></div>{completedTasks.length > 0 && <button className="text-button" type="button" onClick={clearCompleted}>清空回收站</button>}</div>{visibleTasks.length === 0 ? <div className="empty-trash">这里还没有完成记录。</div> : <div className="trash-list">{visibleTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => setModalTask(task)} onDelete={() => undefined} onDragStart={() => undefined} />)}</div>}</section>}
    <footer className="statusbar"><span><i className="status-dot" />数据仅保存在本机</span><span>{activeTasks.filter((task) => isOverdue(task)).length ? `有 ${activeTasks.filter((task) => isOverdue(task)).length} 件逾期` : "今天，稳稳向前"}</span></footer>
    {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} onSave={(task) => { const exists = tasks.some((item) => item.id === task.id); exists ? updateTask(task.id, task) : addTask(task); setModalTask(null); }} />}
  </main>;
}
