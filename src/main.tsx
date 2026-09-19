import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Alarm, Archive, ArrowLeft, ArrowRight, Bell, CalendarBlank, CalendarDots, CaretDown, Check, CheckCircle, CheckSquare, Circle, Clock, DotsThree, FlowerLotus, FolderOpen, Gear, GridFour, List, MagnifyingGlass, Plus, Repeat, SlidersHorizontal, SquaresFour, Tag, Target, Timer, Trash, TrendUp, UserCircle, X, type Icon } from '@phosphor-icons/react';
import './styles.css';
import { addJalaliDays, addJalaliMonths, jalaliAtToDate, jalaliKey, jalaliLabel, jalaliMonthNames, jalaliShortLabel, jalaliWeekday, jalaliWeekdayNames, parseJalaliKey, parseNaturalDateValue, todayJalali } from './core/date';
import { parseQuickAdd } from './core/nlp';
import { nextOccurrence, parseRecurrence } from './core/recurrence';
import { eventCategories, eventCategoryLabels, eventsForJalaliDate, type EventCategory } from './core/events';
import { loadAppSnapshot, saveAppSnapshot } from './core/storage';
import { createTask, editTask, migrateTask, softDeleteTask, restoreTask, isVisibleTask, selectTasks, type Task, type LegacyTask, type TaskPriority as Priority, type TaskView } from './core/task';
import type { Habit, FocusSession } from './core/user-data';
import { matchesPersianQuery } from './core/search';
import { mergeBackup, type BackupData } from './core/backup';
import { DataScreen } from './features/data/DataScreen';
import { TaskEditor } from './features/tasks/TaskEditor';
import { focusSeconds, endFocus } from './core/focus';
type Screen = 'tasks' | 'focus' | 'matrix' | 'calendar' | 'more' | 'settings' | 'stats' | 'habits' | 'lists' | 'data';
const listNames = ['Inbox', 'کار', 'شخصی', 'مطالعه'];
const faDigits = (value: string | number) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const currentTodayKey = () => jalaliKey(todayJalali());
const dateKeyFromIso = (iso?: string) => iso ? jalaliKey(todayJalali(new Date(iso))) : '';
const unique = <T,>(values: T[]) => Array.from(new Set(values));
const habitStreak = (dates: string[], now = new Date()) => { let streak = 0; let cursor = todayJalali(now); const set = new Set(dates); while (set.has(jalaliKey(cursor))) {
    streak += 1;
    cursor = addJalaliDays(cursor, -1);
} return streak; };
const habitBestStreak = (dates: string[]) => { const sorted = unique(dates).sort(); let best = 0; let run = 0; let previous = ''; for (const key of sorted) {
    const current = parseCalendarKey(key);
    const prev = previous ? parseCalendarKey(previous) : null;
    if (!current)
        continue;
    if (prev && jalaliKey(addJalaliDays(prev, 1)) === key)
        run += 1;
    else
        run = 1;
    best = Math.max(best, run);
    previous = key;
} return best; };
const navItems: Array<{
    id: Screen;
    label: string;
    icon: Icon;
}> = [
    { id: 'more', label: 'بیشتر', icon: DotsThree }, { id: 'focus', label: 'تمرکز', icon: Target },
    { id: 'matrix', label: 'ماتریس', icon: GridFour }, { id: 'calendar', label: 'تقویم', icon: CalendarBlank },
    { id: 'tasks', label: 'کارها', icon: CheckSquare }
];
function readStore<T>(key: string, fallback: T): T { try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
}
catch {
    return fallback;
} }
const prepareTasks = (values: LegacyTask[]) => { const now = new Date().toISOString(); return values.map((task, index) => { const parsed = task.date === 'دیروز' ? addJalaliDays(todayJalali(), -1) : task.date ? parseNaturalDateValue(task.date)?.value : undefined; return migrateTask({ ...task, dateKey: task.dateKey || (parsed ? jalaliKey(parsed) : undefined) }, now, index); }); };
const prepareHabits = (values: Habit[]) => { const key = currentTodayKey(); return values.map((habit) => { const dates = habit.completionDates || (habit.completedToday ? [key] : []); return { ...habit, completionDates: dates, completedToday: dates.includes(key), streak: habitStreak(dates), bestStreak: Math.max(habit.bestStreak || 0, habitBestStreak(dates)) }; }); };
function App() {
    const [screen, setScreen] = useState<Screen>('tasks');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [taskView, setTaskView] = useState<TaskView>('today');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showDetail, setShowDetail] = useState<Task | null>(null);
    const [showHabitAdd, setShowHabitAdd] = useState(false);
    const [reminderNotice, setReminderNotice] = useState<Task | null>(null);
    const [reminderPermission, setReminderPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const [quickTitle, setQuickTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTheme, setActiveTheme] = useState('default');
    const [focusMode, setFocusMode] = useState<'pomo' | 'stopwatch'>('pomo');
    const [seconds, setSeconds] = useState(25 * 60);
    const [running, setRunning] = useState(false);
    const [focusStartedAt, setFocusStartedAt] = useState<string | null>(null);
    const [settingsTab, setSettingsTab] = useState<'display' | 'icons' | 'theme'>('display');
    const [storageReady, setStorageReady] = useState(false);
    const [storageError, setStorageError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => { let mounted = true; loadAppSnapshot<LegacyTask, Habit, FocusSession>({ tasks: [], habits: [], focusSessions: [], activeTheme: 'default' }).then((snapshot) => { if (!mounted)
        return; setTasks(prepareTasks(snapshot.tasks)); setHabits(prepareHabits(snapshot.habits)); setFocusSessions(snapshot.focusSessions); setActiveTheme(snapshot.activeTheme); setStorageReady(true); }).catch(error => { if (mounted) setStorageError(String(error.message || error)); }); return () => { mounted = false; }; }, []);
    useEffect(() => {
        if (!storageReady) return;
        let current = true;
        setSaving(true);
        void saveAppSnapshot({ tasks, habits, focusSessions, activeTheme }).then(() => { if (current) { setStorageError(''); setSaving(false); } }).catch(error => { if (current) { setStorageError(String(error.message || error)); setSaving(false); } });
        return () => { current = false; };
    }, [tasks, habits, focusSessions, activeTheme, storageReady]);
    useEffect(() => { if (!running || !focusStartedAt)
        return; const tick = () => setSeconds(focusSeconds(focusMode, focusStartedAt)); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [running, focusMode, focusStartedAt]);
    useEffect(() => { if (!Capacitor.isNativePlatform())
        return; LocalNotifications.createChannel({ id: 'task-reminders', name: 'یادآوری کارها', description: 'یادآوری‌های مربوط به کارها', importance: 4, vibration: true }).catch(() => undefined); }, []);
    const todayValue = todayJalali();
    const todayKey = jalaliKey(todayValue);
    const visibleTasks = tasks.filter(isVisibleTask);
    const activeTasks = selectTasks(tasks, taskView, todayKey);
    const completedCount = visibleTasks.filter((task) => task.completed && dateKeyFromIso(task.completedAt) === todayKey).length;
    const themeClass = activeTheme === 'turquoise' ? 'theme-turquoise' : activeTheme === 'peach' ? 'theme-peach' : activeTheme === 'pebble' ? 'theme-pebble' : '';
    const today = `${jalaliWeekdayNames[jalaliWeekday(todayValue)]}، ${jalaliLabel(todayValue)}`;
    const toggleTask = (id: string) => setTasks((current) => {
        const target = current.find((task) => task.id === id);
        if (!target || !isVisibleTask(target))
            return current;
        const completed = !target.completed;
        const updated = current.map((task) => task.id === id ? editTask(task, { completed }) : task);
        if (!completed || !target.recurrence || current.some(task => task.recurrenceSourceId === target.id))
            return updated;
        const rule = parseRecurrence(target.recurrence);
        const base = parseJalaliKey(target.dateKey || todayKey);
        if (!rule || !base)
            return updated;
        const next = nextOccurrence(base, rule);
        return [createTask({ ...target, recurrenceSourceId: target.id, date: jalaliShortLabel(next), dateKey: jalaliKey(next) }), ...updated];
    });
    const addTask = () => { const parsed = parseQuickAdd(quickTitle); if (!parsed.title)
        return; setTasks((current) => [createTask(parsed), ...current]); setQuickTitle(''); setShowAdd(false); setTaskView(parsed.dateKey ? (parsed.dateKey <= todayKey ? 'today' : 'upcoming') : 'inbox'); setScreen('tasks'); };
    const finishFocusSession = (completed: boolean) => { if (!focusStartedAt)
        return; const session = endFocus(focusMode, focusStartedAt); setFocusSessions((current) => current.some(s => s.startAt === session.startAt) ? current : [session, ...current]); setFocusStartedAt(null); };
    const toggleFocus = () => { if (running) {
        finishFocusSession(false);
        setRunning(false);
    }
    else {
        setSeconds(focusMode === 'pomo' ? 1500 : 0);
        setFocusStartedAt(new Date().toISOString());
        setRunning(true);
    } };
    useEffect(() => { if (running && focusMode === 'pomo' && seconds === 0) {
        finishFocusSession(true);
        setRunning(false);
    } }, [seconds, running, focusMode]);
    const changeFocusMode = (mode: 'pomo' | 'stopwatch') => { if (running) {
        finishFocusSession(false);
        setRunning(false);
    } setFocusMode(mode); setSeconds(mode === 'pomo' ? 1500 : 0); };
    const toggleHabit = (id: string) => setHabits((current) => current.map((habit) => { if (habit.id !== id)
        return habit; const key = currentTodayKey(); const dates = habit.completionDates || []; const nextDates = dates.includes(key) ? dates.filter((date) => date !== key) : [...dates, key]; return { ...habit, completedToday: nextDates.includes(key), completionDates: nextDates, streak: habitStreak(nextDates), bestStreak: Math.max(habit.bestStreak || 0, habitBestStreak(nextDates)) }; }));
    const addHabit = (title: string, frequency: string) => { if (!title.trim())
        return; setHabits((current) => [...current, { id: crypto.randomUUID(), title: title.trim(), icon: 'habit', color: '#4773fa', frequency, streak: 0, bestStreak: 0, completedToday: false, completionDates: [] }]); setShowHabitAdd(false); };
    const normalizePermission = (permission: string): 'granted' | 'denied' | 'default' => permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default';
    const requestReminderPermission = async () => { if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.requestPermissions();
        setReminderPermission(normalizePermission(permission.display));
        return;
    } if (typeof Notification === 'undefined') {
        setReminderPermission('unsupported');
        return;
    } const permission = await Notification.requestPermission(); setReminderPermission(permission); };
    useEffect(() => { if (!storageReady || !Capacitor.isNativePlatform())
        return; const scheduleNativeReminders = async () => { try {
        const permission = await LocalNotifications.checkPermissions();
        setReminderPermission(normalizePermission(permission.display));
        if (permission.display !== 'granted')
            return;
        await LocalNotifications.cancelAll();
        const notifications = tasks.filter((task) => isVisibleTask(task) && task.reminder && !task.completed && task.dateKey && task.time).map((task) => { const at = jalaliAtToDate(task.dateKey!, task.time!); if (!at || at.getTime() <= Date.now())
            return null; const id = Math.abs(Array.from(task.id).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)) % 2147480000; return { id: id || 1, title: 'یادآوری سپیدار', body: task.title, schedule: { at, allowWhileIdle: true }, channelId: 'task-reminders', smallIcon: 'ic_stat_sepidar', extra: { taskId: task.id } }; }).filter(Boolean) as Array<{
            id: number;
            title: string;
            body: string;
            schedule: {
                at: Date;
                allowWhileIdle: boolean;
            };
            channelId: string;
            smallIcon: string;
            extra: {
                taskId: string;
            };
        }>;
        if (notifications.length)
            await LocalNotifications.schedule({ notifications });
    }
    catch { /* Native permission or alarm settings can be unavailable. */ } }; scheduleNativeReminders(); }, [tasks, storageReady, reminderPermission]);
    useEffect(() => { if (!storageReady || Capacitor.isNativePlatform()) return; const checkReminders = () => { const now = Date.now(); const fired = readStore<string[]>('sepidar.reminders.fired', []); const task = tasks.find((item) => isVisibleTask(item) && item.reminder && !item.completed && item.dateKey && item.time && !fired.includes(`${item.id}:${item.dateKey}:${item.time}`) && (() => { const due = jalaliAtToDate(item.dateKey!, item.time!); return due && due.getTime() <= now && now - due.getTime() <= 10 * 60 * 1000; })()); if (!task)
        return; const key = `${task.id}:${task.dateKey}:${task.time}`; const nextFired = [...fired, key].slice(-200); localStorage.setItem('sepidar.reminders.fired', JSON.stringify(nextFired)); setReminderNotice(task); if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('یادآوری سپیدار', { body: task.title, tag: key }); }; checkReminders(); const timer = window.setInterval(checkReminders, 15000); return () => window.clearInterval(timer); }, [tasks]);
    const updateTask = (updated: Task) => { if (!updated.title.trim()) return; setTasks((current) => current.map((task) => task.id === updated.id ? editTask(task, updated) : task)); setShowDetail(null); };
    const deleteTask = (id: string) => { setTasks((current) => current.map((task) => task.id === id ? softDeleteTask(task) : task)); setShowDetail(null); };
    const restoreDeleted = (id: string) => setTasks(current => current.map(task => task.id === id ? restoreTask(task) : task));
    const importData = (incoming: BackupData) => {
        const merged = mergeBackup({ tasks, habits, focusSessions, activeTheme }, incoming);
        setTasks(prepareTasks(merged.tasks)); setHabits(prepareHabits(merged.habits)); setFocusSessions(merged.focusSessions);
    };
    const openSettings = () => { setScreen('settings'); setSettingsTab('display'); };
    const hiddenNav = ['settings', 'stats', 'habits', 'lists', 'data'].includes(screen);
    if (!storageReady) return <main className="screen" dir="rtl"><h1>سپیدار</h1><p role={storageError ? 'alert' : 'status'}>{storageError || 'در حال خواندن داده‌های دستگاه…'}</p>{storageError && <button className="primary" onClick={() => location.reload()}>تلاش دوباره</button>}</main>;
    return <div className={`app-shell ${themeClass}`}><main className="app-content">
    {storageError && <div className="storage-warning" role="alert">{storageError}<button onClick={() => setScreen('data')}>پشتیبان‌گیری</button></div>}
    {screen === 'tasks' && <TasksScreen tasks={visibleTasks} activeTasks={activeTasks} view={taskView} setView={setTaskView} saving={saving} today={today} onToggle={toggleTask} onEdit={setShowDetail} onSettings={openSettings} onSearch={() => setShowSearch(true)}/>}
    {screen === 'calendar' && <CalendarScreen tasks={visibleTasks} onToggle={toggleTask} onEdit={setShowDetail} onAdd={() => setShowAdd(true)}/>}
    {screen === 'matrix' && <MatrixScreen tasks={visibleTasks.filter(t => !t.completed)} onToggle={toggleTask} onEdit={setShowDetail} onAdd={() => setShowAdd(true)}/>}
    {screen === 'focus' && <FocusScreen mode={focusMode} onModeChange={changeFocusMode} seconds={seconds} running={running} onToggle={toggleFocus}/>}
    {screen === 'more' && <MoreScreen completedCount={completedCount} reminderPermission={reminderPermission} onEnableReminders={requestReminderPermission} onStats={() => setScreen('stats')} onSettings={openSettings} onHabits={() => setScreen('habits')} onLists={() => setScreen('lists')} onData={() => setScreen('data')}/>}
    {screen === 'data' && <DataScreen data={{ tasks, habits, focusSessions, activeTheme }} onImport={importData} onRestore={restoreDeleted} onBack={() => setScreen('more')}/>}
    {screen === 'stats' && <StatsScreen tasks={visibleTasks} focusSessions={focusSessions} habits={habits} onClose={() => setScreen('more')}/>}{screen === 'habits' && <HabitsScreen habits={habits} onToggle={toggleHabit} onAdd={() => setShowHabitAdd(true)} onBack={() => setScreen('more')}/>}{screen === 'lists' && <ListsScreen tasks={visibleTasks} onToggle={toggleTask} onEdit={setShowDetail} onBack={() => setScreen('more')}/>}{screen === 'settings' && <SettingsScreen tab={settingsTab} setTab={setSettingsTab} activeTheme={activeTheme} setActiveTheme={setActiveTheme} onBack={() => setScreen('more')}/>}
  </main>{!hiddenNav && <BottomNav screen={screen} navigate={setScreen}/>}{!hiddenNav && <button className="fab" aria-label="افزودن کار" onClick={() => setShowAdd(true)}><Plus size={32} weight="bold"/></button>}{showAdd && <QuickAdd value={quickTitle} setValue={setQuickTitle} onClose={() => setShowAdd(false)} onSave={addTask}/>}{showSearch && <SearchSheet query={searchQuery} setQuery={setSearchQuery} tasks={visibleTasks} onToggle={toggleTask} onClose={() => { setShowSearch(false); setSearchQuery(''); }} onEdit={setShowDetail}/>}{showDetail && <TaskEditor task={showDetail} lists={unique([...listNames, ...visibleTasks.map(t => t.list)])} onClose={() => setShowDetail(null)} onSave={updateTask} onDelete={deleteTask}/>}{showHabitAdd && <HabitSheet onClose={() => setShowHabitAdd(false)} onSave={addHabit}/>}{reminderNotice && <ReminderToast task={reminderNotice} onClose={() => setReminderNotice(null)}/>}</div>;
}
function TopBar({ title, icon, action }: {
    title: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
}) { return <header className="top-bar"><button className="icon-button" aria-label="گزینه‌ها"><DotsThree size={28} weight="bold"/></button><div className="brand-title">{icon}{title}</div>{action || <button className="icon-button" aria-label="منو"><List size={27} weight="bold"/></button>}</header>; }
function TasksScreen({ tasks, activeTasks, view, setView, saving, today, onToggle, onEdit, onSettings, onSearch }: {
    tasks: Task[];
    activeTasks: Task[];
    view: TaskView;
    setView: (view: TaskView) => void;
    saving: boolean;
    today: string;
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onSettings: () => void;
    onSearch: () => void;
}) {
    const labels: Record<TaskView, string> = { today: 'امروز', inbox: 'ورودی‌ها', upcoming: 'آینده', all: 'همه کارها', completed: 'انجام‌شده' };
    return <section className="screen tasks-screen">
      <TopBar title="سپیدار" icon={<span className="brand-mark">✦</span>} action={<div className="top-actions"><button className="icon-button" onClick={onSearch} aria-label="جست‌وجو"><MagnifyingGlass size={25}/></button><button className="icon-button" onClick={onSettings} aria-label="تنظیمات"><Gear size={25}/></button></div>}/>
      <div className="welcome-copy"><span>برنامهٔ من</span><small>{today}</small></div>
      <div className="task-view-tabs" role="tablist" aria-label="نمای کارها">{(Object.entries(labels) as [TaskView, string][]).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>)}</div>
      <section className="task-group"><div className="group-heading"><span>{labels[view]} <span className="count">{faDigits(activeTasks.length)}</span></span><span className="muted">{faDigits(tasks.length)} کار</span></div>
        {view === 'today' && activeTasks.some(t => t.dateKey! < currentTodayKey()) && <p className="overdue-label">کارهای عقب‌افتاده در ابتدای فهرست هستند</p>}
        <div className="task-list">{activeTasks.map(task => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}{activeTasks.length === 0 && <EmptyState title="کاری در این بخش نیست" subtitle={view === 'today' ? 'کارهای بدون تاریخ را در ورودی‌ها ببین.' : 'با دکمهٔ + یک کار جدید ثبت کن.'}/>}</div>
      </section><div className="sync-pill" role="status"><CheckCircle size={17} weight="fill"/>{saving ? 'در حال ذخیره روی دستگاه…' : 'ذخیره روی دستگاه · بدون همگام‌سازی ابری'}</div>
    </section>;
}
function TaskRow({ task, onToggle, onEdit }: {
    task: Task;
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
}) { return <div className={`task-row ${task.completed ? 'completed' : ''}`} onClick={() => onEdit(task)}><button className={`task-check priority-${task.priority}`} onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} aria-label="تکمیل کار">{task.completed && <Check size={16} weight="bold"/>}</button><div className="task-copy"><span>{task.title}</span><small>{task.list}{task.tag ? ` · #${task.tag}` : ''}{task.date ? ` · ${task.date}` : ''}{task.time ? ` · ${task.time}` : ''}{task.reminder ? ' · 🔔 یادآور' : ''}{task.recurrence ? ` · ${task.recurrence}` : ''}</small></div><DotsThree size={22} className="task-menu"/></div>; }
function CalendarScreen({ tasks, onToggle, onEdit, onAdd }: {
    tasks: Task[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onAdd: () => void;
}) {
    const today = todayJalali();
    const todayKey = jalaliKey(today);
    const [selectedKey, setSelectedKey] = useState(todayKey);
    const [view, setView] = useState<'agenda' | 'week' | 'month'>('week');
    const [showEventFilters, setShowEventFilters] = useState(false);
    const [enabledCategories, setEnabledCategories] = useState<EventCategory[]>(() => readStore('sepidar.eventCategories', eventCategories));
    const selected = parseCalendarKey(selectedKey) || today;
    const weekStart = addJalaliDays(selected, -jalaliWeekday(selected));
    const weekDays = Array.from({ length: 7 }, (_, index) => addJalaliDays(weekStart, index));
    const monthStart = { year: selected.year, month: selected.month, day: 1 };
    const monthDays = Array.from({ length: 42 }, (_, index) => addJalaliDays(monthStart, index - jalaliWeekday(monthStart)));
    const selectedTasks = tasks.filter((task) => !task.completed && task.dateKey === selectedKey);
    const selectedEvents = eventsForJalaliDate(selected, enabledCategories);
    const toggleEventCategory = (category: EventCategory) => setEnabledCategories((current) => { const next = current.includes(category) ? current.filter((item) => item !== category) : [...current, category]; localStorage.setItem('sepidar.eventCategories', JSON.stringify(next)); return next; });
    const moveMonth = (amount: number) => { const target = addJalaliMonths({ ...selected, day: 1 }, amount); setSelectedKey(jalaliKey(target)); };
    const chooseToday = () => setSelectedKey(todayKey);
    return <section className="screen calendar-screen"><TopBar title="تقویم" icon={<CalendarBlank size={26} weight="duotone"/>} action={<div className="top-actions"><button className="icon-button" aria-label="لیست"><List size={25}/></button><button className="icon-button" aria-label="فیلتر"><SlidersHorizontal size={24}/></button></div>}/>
    <div className="calendar-month"><button className="icon-button" onClick={() => moveMonth(-1)} aria-label="ماه قبل"><ArrowRight size={20}/></button><strong>{jalaliMonthNames[selected.month - 1]} {faDigits(selected.year)}</strong><button className="today-chip" onClick={chooseToday}>امروز</button><button className="icon-button" onClick={() => moveMonth(1)} aria-label="ماه بعد"><ArrowLeft size={20}/></button></div>
    <div className="calendar-view-tabs">{([['week', 'هفته'], ['month', 'ماه'], ['agenda', 'دستورکار']] as const).map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
    {view === 'week' && <><div className="week-strip">{weekDays.map((day) => { const key = jalaliKey(day); return <button key={key} onClick={() => setSelectedKey(key)} className={`${jalaliWeekday(day) === 6 ? 'holiday' : ''} ${selectedKey === key ? 'selected-day' : ''}`}><small>{jalaliWeekdayNames[jalaliWeekday(day)].slice(0, 2)}</small><b>{faDigits(day.day)}</b></button>; })}</div><div className="week-timeline">{weekDays.map((day) => <button key={jalaliKey(day)} className={selectedKey === jalaliKey(day) ? 'selected-line' : ''} onClick={() => setSelectedKey(jalaliKey(day))}><span>{jalaliWeekdayNames[jalaliWeekday(day)]}</span><small>{jalaliShortLabel(day)}</small><i>{faDigits(tasks.filter((task) => !task.completed && task.dateKey === jalaliKey(day)).length)}</i></button>)}</div></>}
    {view === 'month' && <div className="month-view"><div className="month-weekdays">{jalaliWeekdayNames.map((day) => <span key={day}>{day.slice(0, 2)}</span>)}</div><div className="month-grid">{monthDays.map((day, index) => { const key = jalaliKey(day); const count = tasks.filter((task) => !task.completed && task.dateKey === key).length; const outside = day.month !== selected.month; return <button key={`${key}-${index}`} className={`${outside ? 'outside' : ''} ${selectedKey === key ? 'selected-month-day' : ''} ${jalaliWeekday(day) === 6 ? 'holiday' : ''}`} onClick={() => { setSelectedKey(key); setView('agenda'); }}><b>{faDigits(day.day)}</b>{count > 0 && <i>{faDigits(count)}</i>}</button>; })}</div></div>}
    <div className="calendar-banner"><div><strong>تقویم فارسی تو آماده است</strong><p>کارها، رویدادها و مناسبت‌های ایران را در یک نگاه ببین.</p><div className="banner-actions"><button className="primary mini" onClick={onAdd}>افزودن کار</button><button className="ghost mini" onClick={() => setShowEventFilters(!showEventFilters)}>مناسبت‌ها</button></div></div><CalendarDots size={52} weight="duotone"/></div>
    {showEventFilters && <div className="event-filters"><strong>نمایش دسته‌های مناسبت</strong><div>{eventCategories.map((category) => <button key={category} className={enabledCategories.includes(category) ? 'active' : ''} onClick={() => toggleEventCategory(category)}>{eventCategoryLabels[category]}</button>)}</div></div>}
    {selectedEvents.length > 0 && <section className="event-card"><div className="agenda-header"><strong>مناسبت‌های این روز</strong><span>{faDigits(selectedEvents.length)} مورد</span></div>{selectedEvents.map((event) => <div className="event-row" key={event.id}><span className={event.isHoliday ? 'holiday-dot' : 'event-dot'}/> <div><strong>{event.title}</strong><small>{event.isHoliday ? 'تعطیل رسمی' : event.category === 'CULTURAL' ? 'فرهنگی' : 'مناسبت رسمی'}</small></div></div>)}</section>}
    <section className="agenda-card"><div className="agenda-header"><strong>{selectedKey === todayKey ? 'امروز' : jalaliLabel(selected)}</strong><span>{faDigits(selectedTasks.length)} کار</span></div>{selectedTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}{!selectedTasks.length && <EmptyState title="برنامه‌ای نیست" subtitle="یک کار برای این روز اضافه کن." icon={<CalendarBlank size={58} weight="thin"/>}/>}</section></section>;
}
function parseCalendarKey(key: string) { const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null; }
function MatrixScreen({ tasks, onToggle, onEdit, onAdd }: {
    tasks: Task[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onAdd: () => void;
}) { const quadrants = [['فوری و مهم', 'urgent-important', 'high'], ['مهم و غیرفوری', 'not-urgent-important', 'medium'], ['فوری و کم‌اهمیت', 'urgent-unimportant', 'low'], ['غیرفوری و کم‌اهمیت', 'not-urgent-unimportant', 'none']] as const; return <section className="screen matrix-screen"><TopBar title="ماتریس آیزنهاور"/><div className="matrix-grid">{quadrants.map(([label, className, priority]) => <div className={`quadrant ${className}`} key={label}><h3>{label}</h3><div className="quadrant-tasks">{tasks.filter(t => t.priority === priority).slice(0, 5).map(task => <div className="matrix-task" key={task.id} onClick={() => onEdit(task)}><span>{task.title}</span><button className="matrix-check" onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}><Circle size={23}/></button></div>)}{tasks.filter(t => t.priority === priority).length === 0 && <span className="no-tasks">کاری نیست</span>}</div></div>)}</div><button className="matrix-fab" onClick={onAdd}><Plus size={29} weight="bold"/></button></section>; }
function FocusScreen({ mode, onModeChange, seconds, running, onToggle }: {
    mode: 'pomo' | 'stopwatch';
    onModeChange: (mode: 'pomo' | 'stopwatch') => void;
    seconds: number;
    running: boolean;
    onToggle: () => void;
}) { const minute = String(Math.floor(seconds / 60)).padStart(2, '0'); const second = String(seconds % 60).padStart(2, '0'); return <section className="screen focus-screen"><div className="focus-toolbar"><button className="icon-button"><Clock size={27}/></button><button className="icon-button" aria-label="افزودن جلسه"><Plus size={27}/></button><button className="icon-button"><DotsThree size={27}/></button></div><div className="mode-tabs"><button className={mode === 'stopwatch' ? '' : 'muted'} onClick={() => onModeChange('stopwatch')}>کرنومتر</button><button className={mode === 'pomo' ? 'active' : ''} onClick={() => onModeChange('pomo')}>پومودورو</button></div><div className="focus-label">تمرکز</div><div className={`timer-ring ${running ? 'running' : ''}`}><span>{faDigits(`${minute}:${second}`)}</span></div><button className="focus-button" onClick={onToggle}>{running ? 'توقف و ذخیره' : 'شروع'}</button><div className="focus-hint">جلسه پس از توقف در آمار تمرکز ذخیره می‌شود.</div></section>; }
function MoreScreen({ completedCount, reminderPermission, onEnableReminders, onStats, onSettings, onHabits, onLists, onData }: {
    completedCount: number;
    reminderPermission: 'granted' | 'denied' | 'default' | 'unsupported';
    onEnableReminders: () => void;
    onStats: () => void;
    onSettings: () => void;
    onHabits: () => void;
    onLists: () => void;
    onData: () => void;
}) { const reminderLabel = reminderPermission === 'granted' ? 'یادآورها فعال‌اند' : reminderPermission === 'denied' ? 'دسترسی یادآورها رد شده' : reminderPermission === 'unsupported' ? 'هشدار داخل برنامه فعال است' : 'فعال‌سازی یادآورهای دستگاه'; return <section className="screen more-screen"><TopBar title="بیشتر" icon={<SquaresFour size={26} weight="duotone"/>}/><div className="more-hero"><div className="avatar"><UserCircle size={55} weight="duotone"/></div><div><h1>حساب محلی</h1><p>امروز {faDigits(completedCount)} کار تکمیل شده</p></div></div><div className="more-grid"><button className="more-card" onClick={onStats}><TrendUp size={29} weight="duotone"/><span>آمار عملکرد</span><small>روند انجام کارها</small></button><button className="more-card" onClick={onHabits}><FlowerLotus size={29} weight="duotone"/><span>عادت‌ها</span><small>ثبات روزانه</small></button><button className="more-card" onClick={onSettings}><Gear size={29} weight="duotone"/><span>تنظیمات</span><small>نمایش و پوسته</small></button><button className="more-card" onClick={onLists}><FolderOpen size={29} weight="duotone"/><span>فهرست‌ها و پروژه‌ها</span><small>کار، شخصی و مطالعه</small></button><button className="more-card" onClick={onData}><Archive size={29}/><span>پشتیبان و سطل زباله</span><small>خروجی و بازیابی داده‌ها</small></button></div><button className="more-note reminder-action" onClick={onEnableReminders}><Bell size={21}/> <span>{reminderLabel}</span></button></section>; }
function StatsScreen({ tasks, focusSessions, habits, onClose }: {
    tasks: Task[];
    focusSessions: FocusSession[];
    habits: Habit[];
    onClose: () => void;
}) { const today = currentTodayKey(); const completed = tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === today || (!task.completedAt && task.dateKey === today))).length; const totalCompleted = tasks.filter((task) => task.completed).length; const completionRate = tasks.length ? Math.round(totalCompleted / tasks.length * 100) : 0; const focusTodaySeconds = focusSessions.filter((session) => dateKeyFromIso(session.startAt) === today).reduce((sum, session) => sum + (session.durationSeconds || session.duration * 60), 0); const focusToday = Math.round(focusTodaySeconds / 60); const habitDone = habits.reduce((sum, habit) => sum + (habit.completionDates?.includes(today) ? 1 : 0), 0); const habitRate = habits.length ? Math.round(habitDone / habits.length * 100) : 0; const days = Array.from({ length: 7 }, (_, index) => jalaliKey(addJalaliDays(todayJalali(), index - 6))); const completionSeries = days.map((key) => tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === key || (!task.completedAt && task.dateKey === key))).length); const rateSeries = days.map((key) => { const due = tasks.filter((task) => task.dateKey === key).length; const done = tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === key || task.dateKey === key)).length; return due ? Math.round(done / due * 100) : 0; }); return <section className="screen stats-screen"><div className="stats-top"><button className="icon-button" onClick={onClose} aria-label="بازگشت"><X size={30}/></button><div className="stats-tabs"><button className="active">نمای کلی</button><button>روز</button><button>هفته</button><button>ماه</button></div></div><div className="metric-grid"><Metric title="تکمیل امروز" value={completed}/><Metric title="کل تکمیل‌شده" value={totalCompleted}/><Metric title="تمرکز امروز" value={`${faDigits(focusToday)} دقیقه`}/><Metric title="عادت‌های امروز" value={`${faDigits(habitRate)}٪`}/></div><ChartCard title="روند تکمیل اخیر" values={completionSeries}/><ChartCard title="نرخ تکمیل اخیر" values={rateSeries} rate/></section>; }
function Metric({ title, value }: {
    title: string;
    value: string | number;
}) { return <div className="metric-card"><strong>{title}</strong><small>بر اساس داده‌های ذخیره‌شده <TrendUp size={14}/></small><b>{typeof value === 'number' ? faDigits(value) : value}</b></div>; }
function ChartCard({ title, values, rate = false }: {
    title: string;
    values: number[];
    rate?: boolean;
}) { const max = Math.max(...values, 1); return <div className="chart-card"><h3>{title}</h3><div className="chart-tabs"><span className="selected">روز</span><span>هفته</span><span>ماه</span></div>{values.length ? <div className={`fake-bars ${rate ? 'rate-bars' : ''}`}>{values.map((value, i) => <i key={i} style={{ height: `${Math.max(4, value / max * 100)}%` }} title={faDigits(value)}/>)}</div> : <div className="no-data">هنوز داده‌ای نیست</div>}<div className="chart-axis"><span>۶ روز قبل</span><span>۳ روز قبل</span><span>امروز</span></div></div>; }
function HabitsScreen({ habits, onToggle, onAdd, onBack }: {
    habits: Habit[];
    onToggle: (id: string) => void;
    onAdd: () => void;
    onBack: () => void;
}) { const completed = habits.filter((habit) => habit.completedToday).length; const rate = habits.length ? Math.round(completed / habits.length * 100) : 0; return <section className="screen habits-screen"><div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>عادت‌ها</h1><button className="icon-button" onClick={onAdd} aria-label="افزودن عادت"><Plus size={26}/></button></div><div className="habit-summary"><strong>{faDigits(completed)} از {faDigits(habits.length)}</strong><span>عادت امروز انجام شده</span><b>{faDigits(rate)}٪</b></div><div className="habit-list">{habits.map(habit => <button className={`habit-row ${habit.completedToday ? 'done' : ''}`} key={habit.id} onClick={() => onToggle(habit.id)}><span className="habit-icon" style={{ background: habit.color }}><FlowerLotus size={23} weight="fill"/></span><span className="habit-copy"><strong>{habit.title}</strong><small>{habit.frequency} · زنجیره {faDigits(habit.streak)} روز · بهترین {faDigits(habit.bestStreak || 0)}</small><span className="habit-dots">{Array.from({ length: 7 }, (_, index) => <i key={index} className={(habit.completionDates || []).includes(jalaliKey(addJalaliDays(todayJalali(), index - 6))) ? 'done' : ''}/>)}</span></span><span className="habit-check">{habit.completedToday ? <Check size={18} weight="bold"/> : <Circle size={26}/>}</span></button>)}</div>{!habits.length && <EmptyState title="هنوز عادتی نساخته‌ای" subtitle="یک عادت کوچک برای شروع اضافه کن."/>}<div className="habit-card"><TrendUp size={24}/><div><strong>نرخ ثبات امروز</strong><p>تاریخچه‌ی انجام عادت‌ها ذخیره می‌شود.</p></div><b>{faDigits(rate)}٪</b></div></section>; }
function HabitSheet({ onClose, onSave }: {
    onClose: () => void;
    onSave: (title: string, frequency: string) => void;
}) { const [title, setTitle] = useState(''); const [frequency, setFrequency] = useState('هر روز'); return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>افزودن عادت</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><input className="habit-input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً: مطالعه روزانه"/><div className="frequency-options">{['هر روز', '۵ روز در هفته', 'هر هفته'].map((item) => <button key={item} className={frequency === item ? 'active' : ''} onClick={() => setFrequency(item)}>{item}</button>)}</div><div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" onClick={() => onSave(title, frequency)}>ساخت عادت</button></div></section></div>; }
function ListsScreen({ tasks, onToggle, onEdit, onBack }: {
    tasks: Task[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onBack: () => void;
}) { return <section className="screen lists-screen"><div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>فهرست‌ها و پروژه‌ها</h1><button className="icon-button" disabled title="ساخت فهرست سفارشی هنوز آماده نیست" aria-label="ساخت فهرست؛ به‌زودی"><Plus size={26}/></button></div><div className="list-cards">{unique([...listNames, ...tasks.map(t => t.list)]).map(list => { const listTasks = tasks.filter(t => t.list === list); return <section className="list-card" key={list}><div className="list-card-head"><FolderOpen size={25} weight="duotone"/><strong>{list}</strong><span>{faDigits(listTasks.length)}</span></div>{listTasks.map(task => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}</section>; })}</div></section>; }
function SettingsScreen({ tab, setTab, activeTheme, setActiveTheme, onBack }: {
    tab: 'display' | 'icons' | 'theme';
    setTab: (tab: 'display' | 'icons' | 'theme') => void;
    activeTheme: string;
    setActiveTheme: (theme: string) => void;
    onBack: () => void;
}) { return <section className="screen settings-screen"><div className="settings-tabs"><button className={tab === 'display' ? 'active' : ''} onClick={() => setTab('display')}>نمایش</button><button className={tab === 'icons' ? 'active' : ''} onClick={() => setTab('icons')}>آیکون برنامه</button><button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>پوسته</button><button className="icon-button back" onClick={onBack} aria-label="بازگشت"><ArrowLeft size={29}/></button></div>{tab === 'display' && <DisplaySettings />}{tab === 'icons' && <IconSettings />}{tab === 'theme' && <ThemeSettings activeTheme={activeTheme} setActiveTheme={setActiveTheme}/>}</section>; }
function DisplaySettings() { return <div className="settings-body"><SettingsRow title="اندازه فونت" value="پیش‌فرض"/><SettingsCard title="تعداد میانبرها"><div className="choice-row"><ChoiceCard title="مخفی" icon={<List size={34}/>}/><ChoiceCard title="نمایش" selected icon={<List size={34}/>}/></div><ToggleRow title="یادداشت‌ها را مخفی کن"/></SettingsCard><SettingsCard title="رنگ فهرست"><div className="choice-row"><ChoiceCard title="مخفی"/><ChoiceCard title="نمایش" selected accent/></div><p className="helper">رنگ فهرست‌ها در لیست کارها نمایش داده شود.</p></SettingsCard><SettingsCard title="نمایش کار تکمیل‌شده"><ToggleRow title="خط‌زدن عنوان کار"/></SettingsCard></div>; }
function IconSettings() { return <div className="settings-body"><SettingsCard title="آیکون برنامه"><div className="icon-options"><div className="app-icon selected"><FlowerLotus size={42} weight="duotone"/></div><div className="app-icon"><Check size={42} weight="bold"/></div><div className="app-icon"><Target size={42}/></div></div><p className="helper">آیکون سپیدار را برای صفحه اصلی انتخاب کن.</p></SettingsCard></div>; }
function ThemeSettings({ activeTheme, setActiveTheme }: {
    activeTheme: string;
    setActiveTheme: (theme: string) => void;
}) { const themes = [['default', '#4773FA', 'پیش‌فرض'], ['turquoise', '#73D6C5', 'فیروزه‌ای'], ['peach', '#F1A5C1', 'هلویی'], ['pebble', '#8A8A8A', 'سنگی']]; return <div className="settings-body"><SettingsRow title="هماهنگ با حالت تاریک سیستم" value="روشن"/><SettingsCard title="رنگ‌های اصلی"><div className="theme-grid">{themes.map(([id, color, label]) => <button key={id} className={`theme-option ${activeTheme === id ? 'selected' : ''}`} onClick={() => setActiveTheme(id)}><i style={{ background: color }}/>{activeTheme === id && <Check className="theme-check" size={19} weight="bold"/>}<span>{label}</span></button>)}</div></SettingsCard><SettingsCard title="فصل‌ها"><div className="season-grid"><div className="season-card summer">تابستان</div><div className="season-card spring">بهار</div></div></SettingsCard></div>; }
function SettingsRow({ title, value }: {
    title: string;
    value: string;
}) { return <div className="settings-row"><ArrowRight size={22}/><span>{value}</span><strong>{title}</strong></div>; }
function SettingsCard({ title, children }: {
    title: string;
    children: React.ReactNode;
}) { return <section className="settings-card"><h2>{title}</h2>{children}</section>; }
function ChoiceCard({ title, selected, accent = false, icon }: {
    title: string;
    selected?: boolean;
    accent?: boolean;
    icon?: React.ReactNode;
}) { return <div className={`choice-card ${selected ? 'selected' : ''}`}><div className={accent ? 'choice-demo accent-demo' : 'choice-demo'}>{icon || <><span>کار</span><span>کار</span></>}</div><small>{title}</small>{selected && <span className="choice-check"><Check size={15} weight="bold"/></span>}</div>; }
function ToggleRow({ title }: {
    title: string;
}) { const [on, setOn] = useState(false); return <button className="toggle-row" onClick={() => setOn(!on)}><span className={`switch ${on ? 'on' : ''}`}><i /></span><strong>{title}</strong></button>; }
function EmptyState({ title, subtitle, icon }: {
    title: string;
    subtitle: string;
    icon?: React.ReactNode;
}) { return <div className="empty-state">{icon || <CheckCircle size={78} weight="thin"/>}<h2>{title}</h2><p>{subtitle}</p></div>; }
function ReminderToast({ task, onClose }: {
    task: Task;
    onClose: () => void;
}) { return <div className="reminder-toast" role="alert"><Bell size={23} weight="fill"/><div><strong>یادآوری کار</strong><span>{task.title}</span></div><button onClick={onClose} aria-label="بستن"><X size={18}/></button></div>; }
function QuickAdd({ value, setValue, onClose, onSave }: {
    value: string;
    setValue: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
}) { const parsed = useMemo(() => parseQuickAdd(value), [value]); return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>افزودن کار</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><textarea autoFocus placeholder="مثلاً: فردا ساعت ۸ با احمد تماس بگیر" value={value} onChange={(event) => setValue(event.target.value)}/><div className="parse-preview"><CalendarBlank size={20}/><span>{parsed.date || 'بدون تاریخ'}{parsed.time ? ` · ${faDigits(parsed.time)}` : ''}{parsed.recurrence ? ` · ${parsed.recurrence}` : ''}</span></div>{parsed.warnings.map(warning => <p key={warning} className="helper" role="status">{warning}</p>)}<div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" disabled={!parsed.title.trim()} onClick={onSave}>ذخیره در ورودی‌ها</button></div></section></div>; }
function SearchSheet({ query, setQuery, tasks, onToggle, onClose, onEdit }: {
    query: string;
    setQuery: (value: string) => void;
    tasks: Task[];
    onToggle: (id: string) => void;
    onClose: () => void;
    onEdit: (task: Task) => void;
}) { const results = tasks.filter(task => matchesPersianQuery([task.title, task.description || '', task.note || '', task.list, task.tag || ''], query)); return <div className="sheet-backdrop" onClick={onClose}><section className="search-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-title"><strong>جست‌وجوی همه کارها</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><div className="search-field"><MagnifyingGlass size={22}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="عنوان، یادداشت، فهرست، برچسب..."/></div><div className="search-results">{results.map(task => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}{!results.length && <EmptyState title="نتیجه‌ای پیدا نشد" subtitle="املای دیگری را امتحان کن."/>}</div></section></div>; }
function BottomNav({ screen, navigate }: {
    screen: Screen;
    navigate: (screen: Screen) => void;
}) { return <nav className="bottom-nav">{navItems.map(({ id, label, icon: ItemIcon }) => <button key={id} className={screen === id ? 'active' : ''} onClick={() => navigate(id)}><ItemIcon size={27} weight={screen === id ? 'fill' : 'duotone'}/><span>{label}</span></button>)}</nav>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
