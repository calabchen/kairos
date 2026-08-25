import { useMemo, type DragEvent } from "react";
import { Check, Pin, Plus } from "lucide-react";
import { isOverdue, quadrantFor, sortTasks, type QuadrantKey, type TaskInstance } from "../shared/task";

const quadrants: Array<{ key: QuadrantKey; label: string; hint: string; surface: string; border: string }> = [
  { key: "do-now", label: "立即处理", hint: "重要 · 紧急", surface: "bg-coral", border: "border-coralLine" },
  { key: "schedule", label: "计划处理", hint: "重要 · 不紧急", surface: "bg-lake", border: "border-lakeLine" },
  { key: "delegate", label: "尽快处理", hint: "不重要 · 紧急", surface: "bg-saffron", border: "border-saffronLine" },
  { key: "eliminate", label: "减少或删除", hint: "不重要 · 不紧急", surface: "bg-slate", border: "border-slateLine" },
];

function formatDue(task: TaskInstance) {
  const date = new Date(task.dueAt);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function WidgetTask({ task, onComplete, onDragStart }: { task: TaskInstance; onComplete: () => void; onDragStart: (event: DragEvent<HTMLDivElement>) => void }) {
  const overdue = isOverdue(task);
  return <div data-testid="widget-task-card" className="group mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-panel/90 px-2.5 py-2 shadow-card" draggable onDragStart={onDragStart}>
    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${overdue ? "bg-danger" : "bg-[#a2ad9a]"}`} />
    <div className="min-w-0 flex-1"><p className="truncate text-xs text-ink">{task.title}</p><p className={`mt-0.5 truncate font-mono text-[10px] ${overdue ? "text-danger" : "text-muted"}`}>截止 {formatDue(task)}</p></div>
    <button className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-green-700 opacity-0 transition-colors hover:bg-green-100 hover:text-green-800 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 group-hover:opacity-100" type="button" onClick={onComplete} aria-label="完成" title="完成"><Check aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button>
  </div>;
}

export function WidgetShell({ tasks, onAdd, onComplete, onExit, onDropTask }: { tasks: TaskInstance[]; onAdd: () => void; onComplete: (id: string) => void; onExit: () => void; onDropTask: (event: DragEvent<HTMLElement>, quadrant: QuadrantKey) => void }) {
  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  return <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-canvas p-3 text-ink" aria-label="Kairos 小组件">
    <header className="flex shrink-0 items-center justify-between gap-2 pb-2" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-display text-sm text-panel">K</span><div className="min-w-0"><strong className="block truncate font-display text-sm font-semibold">Kairos</strong><span className="font-mono text-[10px] text-muted">{activeTasks.length} 件待处理</span></div></div>
      <div className="flex shrink-0 items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}><button className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40" type="button" onClick={onAdd} aria-label="新建任务" title="新建任务"><Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button><button className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40" type="button" onClick={onExit} aria-label="取消 Pin" title="取消 Pin"><Pin aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></button></div>
    </header>
    <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2" aria-label="小组件四象限任务看板">{quadrants.map((quadrant) => { const quadrantTasks = sortTasks(activeTasks.filter((task) => quadrantFor(task) === quadrant.key)); return <article key={quadrant.key} aria-label={`${quadrant.label}：${quadrant.hint}`} data-testid={`widget-quadrant-${quadrant.key}`} className={`min-h-0 overflow-hidden rounded-xl border ${quadrant.surface} ${quadrant.border}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropTask(event, quadrant.key)}><header className="flex items-center justify-between px-2.5 pb-1 pt-2"><p className="text-[10px] font-semibold text-ink">{quadrant.hint}</p><span className="grid h-5 min-w-5 place-items-center rounded-full border border-white/60 font-mono text-[10px] text-muted">{quadrantTasks.length}</span></header><div className="min-h-0 overflow-y-auto px-1.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{quadrantTasks.map((task) => <WidgetTask key={task.id} task={task} onComplete={() => onComplete(task.id)} onDragStart={(event) => event.dataTransfer.setData("text/kairos-task", task.id)} />)}{quadrantTasks.length === 0 && <p className="pt-5 text-center text-[10px] text-muted">暂无任务</p>}</div></article>; })}</section>
  </main>;
}
