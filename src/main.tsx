import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Alarm, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, CalendarBlank, CalendarDots, CaretDown, Check, CheckCircle, CheckSquare, Circle, Clock, DotsThree, FlowerLotus, FolderOpen, Gear, GridFour, List, MagnifyingGlass, PencilSimple, Plus, Repeat, SquaresFour, Tag, Target, Timer, Trash, TrendUp, UserCircle, X, type Icon } from '@phosphor-icons/react';
import './styles.css';
import { addJalaliDays, calendarCellsForSystem, calendarLabelsForJalali, calendarViewLabelForSystem, formatCalendarInput, formatJalaliInput, jalaliAtToDate, jalaliKey, jalaliLabel, jalaliMonthNames, jalaliShortLabel, jalaliWeekday, jalaliWeekdayNames, moveCalendarForSystem, parseCalendarInput, parseJalaliInput, parseJalaliKey, parseNaturalDateValue, todayJalali, type CalendarSystem, type WeekStart } from './core/date';
import { parseQuickAdd } from './core/nlp';
import { nextOccurrence, parseRecurrence } from './core/recurrence';
import { loadAppSnapshot, saveAppSnapshot } from './core/storage';
import { createTask, editTask, migrateTask, softDeleteTask, restoreTask, isVisibleTask, matrixQuadrantForPriority, selectTasks, type MatrixQuadrant, type Task, type LegacyTask, type TaskPriority as Priority, type TaskView } from './core/task';
import type { Habit, FocusSession } from './core/user-data';
import { matchesPersianQuery } from './core/search';
import { mergeBackup, type BackupData } from './core/backup';
import { DataScreen } from './features/data/DataScreen';
import { CalendarPicker, TaskEditor } from './features/tasks/TaskEditor';
import { focusSeconds, endFocus } from './core/focus';
type ZitarWidgetPlugin = { update: (options: { tasks: Array<{ title: string; time?: string; completed: boolean }> }) => Promise<void> };
const ZitarWidget = registerPlugin<ZitarWidgetPlugin>('ZitarWidget');
type CalendarEventOptions = { title: string; description?: string; startAt: number; endAt: number; allDay: boolean };
type ZitarCalendarPlugin = { requestPermissions: () => Promise<void>; createEvent: (options: CalendarEventOptions) => Promise<{ eventId: number }>; updateEvent: (options: CalendarEventOptions & { eventId: number }) => Promise<void>; deleteEvent: (options: { eventId: number }) => Promise<void> };
const ZitarCalendar = registerPlugin<ZitarCalendarPlugin>('ZitarCalendar');
type Screen = 'tasks' | 'focus' | 'matrix' | 'calendar' | 'more' | 'settings' | 'stats' | 'habits' | 'lists' | 'data' | 'countdown' | 'ai' | 'search';
type SettingsTab = 'display' | 'icons' | 'theme' | 'tabbar' | 'dateTime';
type Countdown = { id: string; title: string; dateKey: string; direction: 'until' | 'since'; icon: 'timer' | 'calendar' | 'star' };
const listNames = ['Inbox', 'شخصی', 'دانشگاه', 'کار اول', 'کار دوم', 'باشگاه', 'سلامتی', 'مطالعه'];
const faDigits = (value: string | number) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const displayTime = (time?: string) => {
    if (!time) return '';
    const normalized = time.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match || readStore<'24' | '12'>('zitar.timeFormat', '24') === '24') return time;
    const hour = Number(match[1]); const suffix = hour >= 12 ? 'ب.ظ' : 'ق.ظ'; const hour12 = hour % 12 || 12;
    return `${faDigits(hour12)}:${match[2]} ${suffix}`;
};
const displayTaskDate = (task: Task) => {
    if (!task.dateKey) return task.date || '';
    const value = parseJalaliKey(task.dateKey);
    if (!value) return task.date || '';
    const labels = calendarLabelsForJalali(value);
    if (task.dateSystem === 'GREGORIAN') return labels.gregorian;
    if (task.dateSystem === 'HIJRI') return labels.hijri;
    return labels.jalali;
};
const currentTodayKey = () => jalaliKey(todayJalali());
const taskNotificationId = (taskId: string) => 100000000 + Math.abs(Array.from(taskId).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)) % 1000000000;
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
    { id: 'tasks', label: 'کارها', icon: CheckSquare }, { id: 'calendar', label: 'تقویم', icon: CalendarBlank },
    { id: 'matrix', label: 'ماتریس', icon: GridFour }, { id: 'focus', label: 'تمرکز', icon: Target },
    { id: 'more', label: 'بیشتر', icon: DotsThree }, { id: 'habits', label: 'عادت‌ها', icon: FlowerLotus },
    { id: 'countdown', label: 'شمارش معکوس', icon: Timer }, { id: 'ai', label: 'دستیار هوشمند', icon: Archive },
    { id: 'search', label: 'جست‌وجو', icon: MagnifyingGlass }, { id: 'settings', label: 'تنظیمات', icon: Gear }
];
const defaultTabOrder: Screen[] = ['tasks', 'calendar', 'matrix', 'focus', 'more', 'habits', 'countdown', 'ai', 'search', 'settings'];
function readStore<T>(key: string, fallback: T): T { try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
}
catch {
    return fallback;
} }
const prepareTasks = (values: LegacyTask[]) => { const now = new Date().toISOString(); return values.map((task, index) => { const parsed = task.date === 'دیروز' ? addJalaliDays(todayJalali(), -1) : task.date ? parseNaturalDateValue(task.date)?.value : undefined; return migrateTask({ ...task, dateKey: task.dateKey || (parsed ? jalaliKey(parsed) : undefined) }, now, index); }); };
const prepareHabits = (values: Habit[]) => { const key = currentTodayKey(); return values.map((habit) => { const dates = habit.completionDates || (habit.completedToday ? [key] : []); return { ...habit, completionDates: dates, completedToday: dates.includes(key), streak: habitStreak(dates), bestStreak: Math.max(habit.bestStreak || 0, habitBestStreak(dates)) }; }); };
function App() {
    const [screen, setScreenState] = useState<Screen>('tasks');
    const screenHistory = useRef<Screen[]>([]);
    const screenRef = useRef<Screen>('tasks');
    const setScreen = (next: Screen) => { if (next === screenRef.current) return; screenHistory.current = [...screenHistory.current, screenRef.current].slice(-30); screenRef.current = next; setScreenState(next); };
    const [tasks, setTasks] = useState<Task[]>([]);
    const [taskView, setTaskView] = useState<TaskView>('today');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showDetail, setShowDetail] = useState<Task | null>(null);
    const [showHabitAdd, setShowHabitAdd] = useState(false);
    const [showCountdownAdd, setShowCountdownAdd] = useState(false);
    const [showFocusRecord, setShowFocusRecord] = useState(false);
    const [reminderNotice, setReminderNotice] = useState<Task | null>(null);
    const [reminderPermission, setReminderPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const [quickTitle, setQuickTitle] = useState('');
    const [profileName, setProfileName] = useState(() => readStore('zitar.profileName', 'کاربر زیتر'));
    const [fontScale, setFontScale] = useState(() => readStore('zitar.fontScale', 1));
    const [fontFamily, setFontFamily] = useState(() => readStore('zitar.fontFamily', 'Vazirmatn'));
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTheme, setActiveTheme] = useState('default');
    const [appearanceMode, setAppearanceMode] = useState<'dark' | 'light' | 'system'>(() => readStore('zitar.appearanceMode', 'dark'));
    const [colorScheme, setColorScheme] = useState<'default' | 'turquoise' | 'peach' | 'pebble'>(() => readStore('zitar.colorScheme', 'default'));
    const [season, setSeason] = useState<'none' | 'spring' | 'summer' | 'autumn' | 'winter'>(() => readStore('zitar.season', 'none'));
    const [focusMode, setFocusMode] = useState<'pomo' | 'stopwatch'>('pomo');
    const [focusPreset, setFocusPreset] = useState(25);
    const [seconds, setSeconds] = useState(25 * 60);
    const [running, setRunning] = useState(false);
    const [focusStartedAt, setFocusStartedAt] = useState<string | null>(null);
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('display');
    const [focusSettingsOpen, setFocusSettingsOpen] = useState(false);
    const [tabOrder, setTabOrder] = useState<Screen[]>(() => unique([...readStore<Screen[]>('zitar.tabOrder.v2', defaultTabOrder), ...defaultTabOrder]).filter((id) => navItems.some((item) => item.id === id)));
    const [tabLimit, setTabLimit] = useState(() => readStore('zitar.tabLimit', 5));
    const [customLists, setCustomLists] = useState<string[]>(() => readStore('zitar.customLists', []));
    const [countdowns, setCountdowns] = useState<Countdown[]>(() => readStore('zitar.countdowns', []));
    const [showListAdd, setShowListAdd] = useState(false);
    const [editingList, setEditingList] = useState<string | null>(null);
    const [storageReady, setStorageReady] = useState(false);
    const [storageError, setStorageError] = useState('');
    const [saving, setSaving] = useState(false);
    const [systemDark, setSystemDark] = useState(() => typeof window === 'undefined' ? true : !window.matchMedia('(prefers-color-scheme: light)').matches);
    const overlayRef = useRef({ showAdd: false, showSearch: false, showDetail: false, showHabitAdd: false, showCountdownAdd: false, showFocusRecord: false, showListAdd: false, reminderNotice: false, focusSettingsOpen: false });
    useEffect(() => { overlayRef.current = { showAdd, showSearch, showDetail: Boolean(showDetail), showHabitAdd, showCountdownAdd, showFocusRecord, showListAdd, reminderNotice: Boolean(reminderNotice), focusSettingsOpen }; }, [showAdd, showSearch, showDetail, showHabitAdd, showCountdownAdd, showFocusRecord, showListAdd, reminderNotice, focusSettingsOpen]);
    const closeTopOverlay = () => {
        const overlay = overlayRef.current;
        if (overlay.reminderNotice) { setReminderNotice(null); return true; }
        if (overlay.showDetail) { setShowDetail(null); return true; }
        if (overlay.showSearch) { setShowSearch(false); setSearchQuery(''); return true; }
        if (overlay.showAdd) { setShowAdd(false); setQuickTitle(''); return true; }
        if (overlay.showHabitAdd) { setShowHabitAdd(false); return true; }
        if (overlay.showCountdownAdd) { setShowCountdownAdd(false); return true; }
        if (overlay.showListAdd) { setShowListAdd(false); setEditingList(null); return true; }
        if (overlay.showFocusRecord) { setShowFocusRecord(false); return true; }
        if (overlay.focusSettingsOpen) { setFocusSettingsOpen(false); return true; }
        return false;
    };
    const goBack = () => {
        if (closeTopOverlay()) return;
        const previous = screenHistory.current.pop();
        if (previous) { screenRef.current = previous; setScreenState(previous); }
        else if (Capacitor.isNativePlatform()) void import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => undefined);
    };
    useEffect(() => { localStorage.setItem('zitar.profileName', profileName); }, [profileName]);
    useEffect(() => { localStorage.setItem('zitar.fontScale', JSON.stringify(fontScale)); }, [fontScale]);
    useEffect(() => { localStorage.setItem('zitar.fontFamily', fontFamily); }, [fontFamily]);
    useEffect(() => { localStorage.setItem('zitar.appearanceMode', appearanceMode); }, [appearanceMode]);
    useEffect(() => { localStorage.setItem('zitar.colorScheme', colorScheme); }, [colorScheme]);
    useEffect(() => { localStorage.setItem('zitar.season', season); }, [season]);
    useEffect(() => { window.addEventListener('zitar-back', goBack); return () => window.removeEventListener('zitar-back', goBack); });
    useEffect(() => { let remove: (() => void) | undefined; void import('@capacitor/app').then(({ App }) => App.addListener('backButton', goBack).then(listener => { remove = () => listener.remove(); })).catch(() => undefined); return () => remove?.(); });
    useEffect(() => { let mounted = true; loadAppSnapshot<LegacyTask, Habit, FocusSession>({ tasks: [], habits: [], focusSessions: [], activeTheme: 'default' }).then((snapshot) => { if (!mounted)
        return; setTasks(prepareTasks(snapshot.tasks)); setHabits(prepareHabits(snapshot.habits)); setFocusSessions(snapshot.focusSessions); setActiveTheme(snapshot.activeTheme); const legacy = snapshot.activeTheme; if (['light', 'dark', 'system'].includes(legacy)) setAppearanceMode(legacy as 'dark' | 'light' | 'system'); else if (['turquoise', 'peach', 'pebble'].includes(legacy)) setColorScheme(legacy as 'default' | 'turquoise' | 'peach' | 'pebble'); else if (['spring', 'summer', 'autumn', 'winter'].includes(legacy)) setSeason(legacy as 'spring' | 'summer' | 'autumn' | 'winter'); setStorageReady(true); }).catch(error => { if (mounted) setStorageError(String(error.message || error)); }); return () => { mounted = false; }; }, []);
    useEffect(() => {
        if (!storageReady) return;
        let current = true;
        setSaving(true);
        void saveAppSnapshot({ tasks, habits, focusSessions, activeTheme }).then(() => { if (current) { setStorageError(''); setSaving(false); } }).catch(error => { if (current) { setStorageError(String(error.message || error)); setSaving(false); } });
        return () => { current = false; };
    }, [tasks, habits, focusSessions, activeTheme, storageReady]);
    useEffect(() => { localStorage.setItem('zitar.customLists', JSON.stringify(customLists)); }, [customLists]);
    useEffect(() => { localStorage.setItem('zitar.tabOrder.v2', JSON.stringify(tabOrder)); }, [tabOrder]);
    useEffect(() => { localStorage.setItem('zitar.tabLimit', String(tabLimit)); }, [tabLimit]);
    useEffect(() => { localStorage.setItem('zitar.countdowns', JSON.stringify(countdowns)); }, [countdowns]);
    useEffect(() => { if (!running || !focusStartedAt)
        return; const tick = () => setSeconds(focusSeconds(focusMode, focusStartedAt, Date.now(), focusPreset * 60)); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [running, focusMode, focusStartedAt, focusPreset]);
    useEffect(() => { if (!Capacitor.isNativePlatform())
        return; LocalNotifications.createChannel({ id: 'task-reminders', name: 'یادآوری کارها', description: 'یادآوری‌های مربوط به کارها', importance: 4, vibration: true }).catch(() => undefined); }, []);
    useEffect(() => { if (typeof window === 'undefined') return; const media = window.matchMedia('(prefers-color-scheme: dark)'); const update = () => setSystemDark(media.matches); update(); media.addEventListener?.('change', update); return () => media.removeEventListener?.('change', update); }, []);
    useEffect(() => { if (!storageReady || !Capacitor.isNativePlatform()) return; const widgetTasks = tasks.filter((task) => isVisibleTask(task) && !task.completed && task.dateKey === currentTodayKey()).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.sortOrder - b.sortOrder).slice(0, 4).map((task) => ({ title: task.title, time: task.time, completed: task.completed })); void ZitarWidget.update({ tasks: widgetTasks }).catch(() => undefined); }, [tasks, storageReady]);
    const todayValue = todayJalali();
    const todayKey = jalaliKey(todayValue);
    const visibleTasks = tasks.filter(isVisibleTask);
    const activeTasks = selectTasks(tasks, taskView, todayKey);
    const completedCount = visibleTasks.filter((task) => task.completed && dateKeyFromIso(task.completedAt) === todayKey).length;
    const themeClass = `${appearanceMode === 'light' || (appearanceMode === 'system' && !systemDark) ? 'theme-light' : ''} theme-${colorScheme} ${season !== 'none' ? `theme-${season}` : ''}`.trim();
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
    const addTask = async (draft: Partial<Task> & Pick<Task, 'title'>) => { if (!draft.title.trim()) return; const created = createTask(draft); setTasks((current) => [created, ...current]); if (created.syncCalendar && created.dateKey && Capacitor.isNativePlatform()) { const start = jalaliAtToDate(created.dateKey, created.time || '00:00', created.timezone); if (start) { const end = new Date(start.getTime() + (created.allDay ? 24 * 60 * 60_000 : (created.duration || 30) * 60_000)); try { await ZitarCalendar.requestPermissions(); const result = await ZitarCalendar.createEvent({ title: created.title, description: created.description || '', startAt: start.getTime(), endAt: end.getTime(), allDay: created.allDay }); setTasks((current) => current.map(task => task.id === created.id ? editTask(task, { calendarEventId: String(result.eventId) }) : task)); } catch { setReminderNotice({ ...created, title: created.title + ' · برای افزودن به تقویم گوشی مجوز لازم است' }); } } } setQuickTitle(''); setShowAdd(false); setTaskView(created.dateKey ? (created.dateKey <= todayKey ? 'today' : 'upcoming') : 'inbox'); setScreen('tasks'); };
    const finishFocusSession = (completed: boolean) => { if (!focusStartedAt)
        return; const session = endFocus(focusMode, focusStartedAt, new Date(), focusPreset * 60); setFocusSessions((current) => current.some(s => s.startAt === session.startAt) ? current : [session, ...current]); setFocusStartedAt(null); };
    const focusAlarmId = 2147000000;
    const toggleFocus = async () => { if (running) {
        finishFocusSession(false);
        if (Capacitor.isNativePlatform()) await LocalNotifications.cancel({ notifications: [{ id: focusAlarmId }] }).catch(() => undefined);
        setRunning(false);
    }
    else {
        setSeconds(focusMode === 'pomo' ? focusPreset * 60 : 0);
        setFocusStartedAt(new Date().toISOString());
        if (focusMode === 'pomo' && Capacitor.isNativePlatform()) { let permission = await LocalNotifications.checkPermissions(); if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions(); setReminderPermission(normalizePermission(permission.display)); if (permission.display === 'granted') await LocalNotifications.schedule({ notifications: [{ id: focusAlarmId, title: 'پومودورو تمام شد', body: 'زمان تمرکز به پایان رسید.', schedule: { at: new Date(Date.now() + focusPreset * 60_000), allowWhileIdle: true }, channelId: 'task-reminders', smallIcon: 'ic_stat_zitar' }] }).catch(() => undefined); }
        setRunning(true);
    } };
    const resetFocus = () => { if (running) finishFocusSession(false); if (Capacitor.isNativePlatform()) void LocalNotifications.cancel({ notifications: [{ id: focusAlarmId }] }).catch(() => undefined); setRunning(false); setFocusStartedAt(null); setSeconds(focusMode === 'pomo' ? focusPreset * 60 : 0); };
    useEffect(() => { if (running && focusMode === 'pomo' && seconds === 0) {
        finishFocusSession(true);
        if (Capacitor.isNativePlatform()) void LocalNotifications.cancel({ notifications: [{ id: focusAlarmId }] }).catch(() => undefined);
        setRunning(false);
    } }, [seconds, running, focusMode]);
    const changeFocusMode = (mode: 'pomo' | 'stopwatch') => { if (running) {
        finishFocusSession(false);
        setRunning(false);
    } setFocusMode(mode); setSeconds(mode === 'pomo' ? focusPreset * 60 : 0); };
    const toggleHabit = (id: string) => setHabits((current) => current.map((habit) => { if (habit.id !== id)
        return habit; const key = currentTodayKey(); const dates = habit.completionDates || []; const nextDates = dates.includes(key) ? dates.filter((date) => date !== key) : [...dates, key]; return { ...habit, completedToday: nextDates.includes(key), completionDates: nextDates, streak: habitStreak(nextDates), bestStreak: Math.max(habit.bestStreak || 0, habitBestStreak(nextDates)) }; }));
    const addHabit = (title: string, frequency: string) => { if (!title.trim())
        return; setHabits((current) => [...current, { id: crypto.randomUUID(), title: title.trim(), icon: 'habit', color: '#4773fa', frequency, streak: 0, bestStreak: 0, completedToday: false, completionDates: [] }]); setShowHabitAdd(false); };
    const addList = (title: string) => { const value = title.trim(); if (!value) return; setCustomLists((current) => current.includes(value) ? current : [...current, value]); setShowListAdd(false); setEditingList(null); };
    const renameList = (oldName: string, nextName: string) => { const value = nextName.trim(); if (!value || value === oldName || listNames.includes(value) || customLists.includes(value)) return; setCustomLists((current) => current.map(item => item === oldName ? value : item)); setTasks((current) => current.map(task => task.list === oldName ? editTask(task, { list: value }) : task)); };
    const deleteList = (name: string) => { if (listNames.includes(name)) return; setCustomLists((current) => current.filter(item => item !== name)); setTasks((current) => current.map(task => task.list === name ? editTask(task, { list: 'Inbox' }) : task)); };
    const saveListTitle = (title: string) => { if (editingList) renameList(editingList, title); else addList(title); setShowListAdd(false); setEditingList(null); };
    const addCountdown = (countdown: Omit<Countdown, 'id'>) => { setCountdowns((current) => [{ ...countdown, id: crypto.randomUUID() }, ...current]); setShowCountdownAdd(false); };
    const deleteCountdown = (id: string) => setCountdowns((current) => current.filter((item) => item.id !== id));
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
        const previousIds = readStore<number[]>('zitar.reminders.scheduledIds', []);
        if (previousIds.length) await LocalNotifications.cancel({ notifications: previousIds.map(id => ({ id })) });
        const notifications = tasks.filter((task) => isVisibleTask(task) && task.reminder && !task.completed && task.dateKey && task.time).map((task) => { const at = jalaliAtToDate(task.dateKey!, task.time!, task.timezone || 'Asia/Tehran'); if (!at || at.getTime() <= Date.now())
            return null; const id = taskNotificationId(task.id); return { id, title: 'یادآوری زیتر', body: task.title, schedule: { at, allowWhileIdle: true }, channelId: 'task-reminders', smallIcon: 'ic_stat_zitar', extra: { taskId: task.id } }; }).filter(Boolean) as Array<{
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
        if (notifications.length) {
            await LocalNotifications.schedule({ notifications });
            localStorage.setItem('zitar.reminders.scheduledIds', JSON.stringify(notifications.map(notification => notification.id)));
        } else {
            localStorage.setItem('zitar.reminders.scheduledIds', '[]');
        }
    }
    catch { /* Native permission or alarm settings can be unavailable. */ } }; scheduleNativeReminders(); }, [tasks, storageReady, reminderPermission]);
    useEffect(() => { if (!storageReady || Capacitor.isNativePlatform()) return; const checkReminders = () => { const now = Date.now(); const fired = readStore<string[]>('zitar.reminders.fired', []); const dueTasks = tasks.filter((item) => isVisibleTask(item) && item.reminder && !item.completed && item.dateKey && item.time && !fired.includes(`${item.id}:${item.dateKey}:${item.time}`) && (() => { const due = jalaliAtToDate(item.dateKey!, item.time!, item.timezone || 'Asia/Tehran'); return due && due.getTime() <= now && now - due.getTime() <= 10 * 60 * 1000; })()); if (!dueTasks.length) return; const keys = dueTasks.map(task => `${task.id}:${task.dateKey}:${task.time}`); localStorage.setItem('zitar.reminders.fired', JSON.stringify([...fired, ...keys].slice(-200))); const first = dueTasks[0]; setReminderNotice(first); if (typeof Notification !== 'undefined' && Notification.permission === 'granted') dueTasks.forEach(task => new Notification('یادآوری زیتر', { body: task.title, tag: `${task.id}:${task.dateKey}:${task.time}` })); }; checkReminders(); const timer = window.setInterval(checkReminders, 15000); return () => window.clearInterval(timer); }, [tasks, storageReady]);
    const calendarOptions = (task: Task): CalendarEventOptions | null => { if (!task.dateKey) return null; const start = jalaliAtToDate(task.dateKey, task.time || '00:00', task.timezone || 'Asia/Tehran'); if (!start) return null; return { title: task.title, description: task.description || task.note || '', startAt: start.getTime(), endAt: start.getTime() + (task.allDay || !task.time ? 24 * 60 * 60_000 : (task.duration || 30) * 60_000), allDay: task.allDay || !task.time }; };
    const syncCalendarEvent = async (task: Task) => { if (!Capacitor.isNativePlatform()) return; const options = calendarOptions(task); try { await ZitarCalendar.requestPermissions(); if (task.syncCalendar && options) { if (task.calendarEventId) await ZitarCalendar.updateEvent({ ...options, eventId: Number(task.calendarEventId) }); else { const result = await ZitarCalendar.createEvent(options); setTasks((current) => current.map(item => item.id === task.id ? editTask(item, { calendarEventId: String(result.eventId) }) : item)); } } else if (task.calendarEventId) { await ZitarCalendar.deleteEvent({ eventId: Number(task.calendarEventId) }); setTasks((current) => current.map(item => item.id === task.id ? editTask(item, { calendarEventId: undefined }) : item)); } } catch { setReminderNotice({ ...task, title: `${task.title} · همگام‌سازی تقویم گوشی انجام نشد` }); } };
    const updateTask = async (updated: Task) => { if (!updated.title.trim()) return; const currentTask = tasks.find(task => task.id === updated.id); const next = currentTask ? editTask(currentTask, updated) : updated; setTasks((current) => current.map((task) => task.id === updated.id ? next : task)); await syncCalendarEvent(next); setShowDetail(null); };
    const updateMatrixQuadrant = (id: string, matrixQuadrant: MatrixQuadrant) => setTasks((current) => current.map((task) => task.id === id ? editTask(task, { matrixQuadrant }) : task));
    const deleteTask = (id: string) => { const target = tasks.find(task => task.id === id); if (target?.calendarEventId && Capacitor.isNativePlatform()) void ZitarCalendar.deleteEvent({ eventId: Number(target.calendarEventId) }).catch(() => undefined); setTasks((current) => current.map((task) => task.id === id ? softDeleteTask(task) : task)); setShowDetail(null); };
    const restoreDeleted = (id: string) => setTasks(current => current.map(task => task.id === id ? restoreTask(task) : task));
    const importData = (incoming: BackupData) => {
        const merged = mergeBackup({ tasks, habits, focusSessions, activeTheme }, incoming);
        setTasks(prepareTasks(merged.tasks)); setHabits(prepareHabits(merged.habits)); setFocusSessions(merged.focusSessions);
    };
    const openSettings = () => { setScreen('settings'); setSettingsTab('display'); };
    const orderedNavItems = tabOrder.map((id) => navItems.find((item) => item.id === id)).filter(Boolean) as typeof navItems;
    const limitedNavItems = orderedNavItems.slice(0, Math.max(2, Math.min(5, tabLimit)));
    const visibleNavItems = limitedNavItems.some((item) => item.id === 'more') ? limitedNavItems : [...limitedNavItems.slice(0, -1), navItems.find((item) => item.id === 'more')!];
    const hiddenNav = ['settings', 'stats', 'habits', 'lists', 'data'].includes(screen) || focusSettingsOpen;
    if (!storageReady) return <main className="screen" dir="rtl"><h1>زیتر</h1><p role={storageError ? 'alert' : 'status'}>{storageError || 'در حال خواندن داده‌های دستگاه…'}</p>{storageError && <button className="primary" onClick={() => location.reload()}>تلاش دوباره</button>}</main>;
    return <div className={`app-shell ${themeClass}`} style={{ ['--font-scale' as string]: fontScale, fontSize: `${fontScale}em`, zoom: fontScale, fontFamily: fontFamily === 'Tahoma' ? 'Tahoma, sans-serif' : fontFamily === 'serif' ? 'Georgia, serif' : fontFamily === 'Jomhuria' ? 'Jomhuria, Vazirmatn, sans-serif' : 'Vazirmatn, Tahoma, sans-serif' }}><main className="app-content">
    {storageError && <div className="storage-warning" role="alert">{storageError}<button onClick={() => setScreen('data')}>پشتیبان‌گیری</button></div>}
    {screen === 'tasks' && <TasksScreen tasks={visibleTasks} activeTasks={activeTasks} view={taskView} setView={setTaskView} saving={saving} today={today} onToggle={toggleTask} onEdit={setShowDetail} onSettings={openSettings} onSearch={() => setShowSearch(true)}/>}
    {screen === 'calendar' && <CalendarScreen tasks={visibleTasks} onToggle={toggleTask} onEdit={setShowDetail} onAdd={() => setShowAdd(true)}/>}
    {screen === 'matrix' && <MatrixScreen tasks={visibleTasks.filter(t => !t.completed)} onToggle={toggleTask} onEdit={setShowDetail} onMove={updateMatrixQuadrant} onAdd={() => setShowAdd(true)}/>}
    {screen === 'countdown' && <CountdownScreen countdowns={countdowns} onAdd={() => setShowCountdownAdd(true)} onDelete={deleteCountdown}/>}
    {screen === 'ai' && <AssistantScreen tasks={visibleTasks} onCreateTask={() => { setScreen('tasks'); setShowAdd(true); }} onSearch={() => setScreen('search')} onAddTask={(title) => { setQuickTitle(title); setScreen('tasks'); setShowAdd(true); }}/>}
    {screen === 'search' && (
      <SearchScreen tasks={visibleTasks} onToggle={toggleTask} onEdit={setShowDetail} onBack={goBack}/>
    )}
    {screen === 'focus' && (focusSettingsOpen ? <FocusSettings presetMinutes={focusPreset} onPresetChange={(minutes) => { setFocusPreset(minutes); setSeconds(focusMode === 'pomo' ? minutes * 60 : 0); }} onClose={() => setFocusSettingsOpen(false)} onOpenRecord={() => setShowFocusRecord(true)}/> : <FocusScreen mode={focusMode} onModeChange={changeFocusMode} seconds={seconds} running={running} onToggle={toggleFocus} onReset={resetFocus} onOpenSettings={() => setFocusSettingsOpen(true)} presetMinutes={focusPreset}/>)}
    {screen === 'more' && (
      <MoreScreen profileName={profileName} onProfileNameChange={setProfileName} completedCount={completedCount} reminderPermission={reminderPermission} onEnableReminders={requestReminderPermission} onStats={() => setScreen('stats')} onSettings={openSettings} onHabits={() => setScreen('habits')} onLists={() => setScreen('lists')} onData={() => setScreen('data')} onCountdown={() => setScreen('countdown')} onAI={() => setScreen('ai')} onSearch={() => setScreen('search')}/>
    )}
    {screen === 'data' && <DataScreen data={{ tasks, habits, focusSessions, activeTheme }} onImport={importData} onRestore={restoreDeleted} onBack={goBack}/>}
    {screen === 'stats' && <><StatsScreen tasks={visibleTasks} focusSessions={focusSessions} habits={habits} onClose={goBack}/><button className="stats-record-fab" onClick={() => setShowFocusRecord(true)} aria-label="افزودن رکورد تمرکز"><Plus size={27}/></button></>}{screen === 'habits' && <HabitsScreen habits={habits} onToggle={toggleHabit} onAdd={() => setShowHabitAdd(true)} onBack={goBack}/>} {screen === 'lists' && <ListsScreen tasks={visibleTasks} lists={unique([...listNames, ...customLists])} onToggle={toggleTask} onEdit={setShowDetail} onAdd={() => setShowListAdd(true)} onRename={(name) => { setEditingList(name); setShowListAdd(true); }} onDelete={deleteList} onBack={goBack}/>} {screen === 'settings' && <SettingsScreen tab={settingsTab} setTab={setSettingsTab} appearanceMode={appearanceMode} setAppearanceMode={(mode) => { setAppearanceMode(mode); setActiveTheme(mode); }} colorScheme={colorScheme} setColorScheme={(scheme) => { setColorScheme(scheme); setActiveTheme(scheme); }} season={season} setSeason={(value) => { setSeason(value); setActiveTheme(value === 'none' ? colorScheme : value); }} tabOrder={tabOrder} setTabOrder={setTabOrder} tabLimit={tabLimit} setTabLimit={setTabLimit} fontScale={fontScale} setFontScale={setFontScale} fontFamily={fontFamily} setFontFamily={setFontFamily} onBack={goBack}/>}
  </main>{!hiddenNav && <BottomNav screen={screen} navigate={setScreen} items={visibleNavItems}/>}{!hiddenNav && <button className="fab" aria-label="افزودن کار" onClick={() => setShowAdd(true)}><Plus size={32} weight="bold"/></button>}{showAdd && <CreateTaskSheet initialTitle={quickTitle} lists={unique([...listNames, ...customLists, ...visibleTasks.map(t => t.list)])} onClose={() => { setShowAdd(false); setQuickTitle(''); }} onSave={addTask}/>} {showSearch && <SearchSheet query={searchQuery} setQuery={setSearchQuery} tasks={visibleTasks} onToggle={toggleTask} onClose={() => { setShowSearch(false); setSearchQuery(''); }} onEdit={setShowDetail}/>}{showDetail && <TaskEditor task={showDetail} lists={unique([...listNames, ...customLists, ...visibleTasks.map(t => t.list)])} onClose={() => setShowDetail(null)} onSave={updateTask} onDelete={deleteTask}/>}{showHabitAdd && <HabitSheet onClose={() => setShowHabitAdd(false)} onSave={addHabit}/>}{showListAdd && <ListSheet initialTitle={editingList || ''} editing={Boolean(editingList)} onClose={() => { setShowListAdd(false); setEditingList(null); }} onSave={saveListTitle}/>}{showCountdownAdd && <CountdownSheet onClose={() => setShowCountdownAdd(false)} onSave={addCountdown}/>} {showFocusRecord && <FocusRecordSheet tasks={visibleTasks} onClose={() => setShowFocusRecord(false)} onSave={(session) => { setFocusSessions((current) => [session, ...current]); setShowFocusRecord(false); }}/>} {reminderNotice && <ReminderToast task={reminderNotice} onClose={() => setReminderNotice(null)}/>}</div>;
}
function TopBar({ title, icon, action, onOptions, onMenu }: {
    title: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    onOptions?: () => void;
    onMenu?: () => void;
}) { return <header className="top-bar">{onOptions ? <button className="icon-button" onClick={onOptions} aria-label="گزینه‌ها"><DotsThree size={28} weight="bold"/></button> : <span className="top-spacer" aria-hidden="true"/>}<div className="brand-title">{icon}{title}</div>{action || (onMenu ? <button className="icon-button" onClick={onMenu} aria-label="منو"><List size={27} weight="bold"/></button> : <span className="top-spacer" aria-hidden="true"/>)}</header>; }
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
      <TopBar title="زیتر" icon={<img className="brand-logo" src="/zitar-logo.png" alt="" />} action={<div className="top-actions"><button className="icon-button" onClick={onSearch} aria-label="جست‌وجو"><MagnifyingGlass size={25}/></button><button className="icon-button" onClick={onSettings} aria-label="تنظیمات"><Gear size={25}/></button></div>}/>
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
}) { return <div className={`task-row ${task.completed ? 'completed' : ''}`} onClick={() => onEdit(task)}><button className={`task-check priority-${task.priority}`} onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} aria-label="تکمیل کار">{task.completed && <Check size={16} weight="bold"/>}</button><div className="task-copy"><span>{task.title}</span><small>{task.list}{task.tag ? ` · #${task.tag}` : ''}{task.dateKey || task.date ? ` · ${displayTaskDate(task)}` : ''}{task.time ? ` · ${displayTime(task.time)}` : ''}{task.reminder ? ' · 🔔 یادآور' : ''}{task.recurrence ? ` · ${task.recurrence}` : ''}</small></div><DotsThree size={22} className="task-menu"/></div>; }
function CalendarScreen({ tasks, onToggle, onEdit, onAdd }: {
    tasks: Task[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onAdd: () => void;
}) {
    const today = todayJalali();
    const todayKey = jalaliKey(today);
    const [selectedKey, setSelectedKey] = useState(todayKey);
    const [view, setView] = useState<'agenda' | 'day' | 'week' | 'month'>('month');
    const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>('JALALI');
    const weekStart = readStore<WeekStart>('zitar.startDay', 'saturday');
    const [dateInput, setDateInput] = useState(formatCalendarInput(today, 'JALALI'));
    const [dateError, setDateError] = useState('');
    const selected = parseCalendarKey(selectedKey) || today;
    const calendarView = view === 'agenda' ? 'day' : view;
    const cells = useMemo(() => calendarCellsForSystem(selected, calendarView, calendarSystem, weekStart), [selectedKey, calendarView, calendarSystem, weekStart]);
    const weekdayLabels = weekStart === 'sunday' ? [...jalaliWeekdayNames.slice(1), jalaliWeekdayNames[0]] : jalaliWeekdayNames;
    const itemsForKey = (key: string) => {
        const date = parseCalendarKey(key);
        if (!date) return [];
        const taskItems = tasks.filter((task) => task.dateKey === key && (task.completed ? false : true)).map((task) => ({ kind: 'task' as const, id: task.id, title: task.title, task, time: task.time }));
        return taskItems.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    };
    const selectedItems = itemsForKey(selectedKey);
    const move = (amount: number) => { const target = moveCalendarForSystem(selected, calendarView, amount, calendarSystem); setSelectedKey(jalaliKey(target)); setDateInput(formatCalendarInput(target, calendarSystem)); setDateError(''); };
    const chooseToday = () => { setSelectedKey(todayKey); setDateInput(formatCalendarInput(today, calendarSystem)); setDateError(''); };
    const submitDate = () => { const parsed = parseCalendarInput(dateInput, calendarSystem); if (!parsed) { setDateError(`تاریخ ${calendarSystem === 'JALALI' ? 'شمسی' : calendarSystem === 'GREGORIAN' ? 'میلادی' : 'قمری'} معتبر نیست.`); return; } setSelectedKey(jalaliKey(parsed)); setDateInput(formatCalendarInput(parsed, calendarSystem)); setDateError(''); };
    const selectDate = (key: string) => { setSelectedKey(key); const parsed = parseCalendarKey(key); if (parsed) setDateInput(formatCalendarInput(parsed, calendarSystem)); };
    const changeCalendarSystem = (system: CalendarSystem) => { setCalendarSystem(system); setDateInput(formatCalendarInput(selected, system)); setDateError(''); };
    return <section className="screen calendar-screen"><TopBar title="تقویم" icon={<CalendarBlank size={26} weight="duotone"/>} action={<button className="icon-button" onClick={() => setView('agenda')} aria-label="نمای روز انتخاب‌شده"><List size={25}/></button>}/>
    <div className="calendar-system-tabs" role="tablist" aria-label="تقویم اصلی">{([['JALALI', 'شمسی'], ['GREGORIAN', 'میلادی'], ['HIJRI', 'قمری']] as const).map(([system, label]) => <button type="button" role="tab" aria-selected={calendarSystem === system} key={system} className={calendarSystem === system ? 'active' : ''} onClick={() => changeCalendarSystem(system)}>{label}</button>)}</div>
    <div className="calendar-controls"><button className="icon-button" onClick={() => move(-1)} aria-label="بازه قبل"><ArrowRight size={20}/></button><form className="calendar-date-form" onSubmit={(event) => { event.preventDefault(); submitDate(); }}><input aria-label={`تاریخ ${calendarSystem === 'JALALI' ? 'شمسی' : calendarSystem === 'GREGORIAN' ? 'میلادی' : 'قمری'}`} value={dateInput} onChange={(event) => setDateInput(event.target.value)} onBlur={submitDate} placeholder={calendarSystem === 'JALALI' ? '۱۴۰۵/۰۶/۱۴' : calendarSystem === 'GREGORIAN' ? '۲۰۲۶/۰۹/۱۸' : '۱۴۴۷/۰۳/۲۶'}/><strong>{calendarViewLabelForSystem(selected, calendarView, calendarSystem, weekStart)}</strong>{dateError && <small>{dateError}</small>}</form><button className="today-chip" onClick={chooseToday}>امروز</button><button className="icon-button" onClick={() => move(1)} aria-label="بازه بعد"><ArrowLeft size={20}/></button></div>
    <CalendarLabels value={selected}/>
    <div className="calendar-view-tabs">{([['month', 'ماه'], ['week', 'هفته'], ['day', 'روز'], ['agenda', 'دستورکار']] as const).map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
    {view === 'month' && <div className="vilia-month-view"><div className="month-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div><div className="vilia-month-grid">{cells.map((cell) => { const items = itemsForKey(cell.key); return <button key={cell.key} className={`${cell.inRange ? '' : 'outside'} ${selectedKey === cell.key ? 'selected-month-day' : ''} ${cell.weekday === 6 ? 'holiday' : ''} ${cell.key === todayKey ? 'today-day' : ''}`} onClick={() => { selectDate(cell.key); setView('agenda'); }}><b>{faDigits(cell.displayDay)}</b><div className="calendar-chips">{items.slice(0, 2).map((item) => <span key={item.id} className="task-chip">{item.title}</span>)}{items.length > 2 && <small>+ {faDigits(items.length - 2)} مورد</small>}</div></button>; })}</div></div>}
    {view === 'week' && <div className="vilia-week-view"><div className="month-weekdays">{cells.map((cell, index) => <span key={cell.key}>{weekdayLabels[index]}</span>)}</div><div className="vilia-week-grid">{cells.map((cell) => <button key={cell.key} className={`${selectedKey === cell.key ? 'selected-line' : ''} ${cell.weekday === 6 ? 'holiday' : ''} ${cell.key === todayKey ? 'today-day' : ''}`} onClick={() => selectDate(cell.key)}><div className="week-cell-heading"><b>{faDigits(cell.displayDay)}</b><small>{cell.displayMonthName} {faDigits(cell.displayYear)}</small></div><div className="calendar-chips">{itemsForKey(cell.key).slice(0, 4).map((item) => <span key={item.id} className="task-chip">{item.title}</span>)}</div></button>)}</div></div>}
    {view === 'day' && <div className="day-view"><div className="day-view-heading"><strong>{calendarViewLabelForSystem(selected, 'day', calendarSystem, weekStart)}</strong><span>{jalaliWeekdayNames[cells[0].weekday]}</span></div><div className="day-items">{selectedItems.map((item) => <TaskRow key={item.id} task={item.task} onToggle={onToggle} onEdit={onEdit}/>)}{!selectedItems.length && <EmptyState title="روز خالی است" subtitle="یک کار برای این روز اضافه کن." icon={<CalendarBlank size={58} weight="thin"/>}/>}</div></div>}
    <div className="calendar-banner"><div><strong>نمایش برنامهٔ روز</strong><p>یک روز را انتخاب کن تا کارهای همان روز را ببینی.</p><div className="banner-actions"><button className="primary mini" onClick={onAdd}>افزودن کار یا قرار</button></div></div><CalendarDots size={52} weight="duotone"/></div>
    <section className="agenda-card"><div className="agenda-header"><strong>{selectedKey === todayKey ? 'امروز' : calendarViewLabelForSystem(selected, 'day', calendarSystem, weekStart)}</strong><span>{faDigits(selectedItems.length)} مورد</span></div>{selectedItems.map((item) => <TaskRow key={item.id} task={item.task} onToggle={onToggle} onEdit={onEdit}/>)}{!selectedItems.length && <EmptyState title="برنامه‌ای نیست" subtitle="یک کار برای این روز اضافه کن." icon={<CalendarBlank size={58} weight="thin"/>}/>}<button className="primary calendar-add" onClick={onAdd}><Plus size={18}/> افزودن کار</button></section></section>;
}
function parseCalendarKey(key: string) { return parseJalaliKey(key); }
function CalendarLabels({ value }: { value: ReturnType<typeof todayJalali> }) { const labels = calendarLabelsForJalali(value); const visible = readStore('zitar.calendarLabels', { jalali: true, gregorian: true, hijri: true }); return <div className="calendar-labels calendar-label-strip"><span className={visible.jalali ? '' : 'hidden'}>شمسی: {labels.jalali}</span><span className={visible.gregorian ? '' : 'hidden'}>میلادی: {labels.gregorian}</span><span className={visible.hijri ? '' : 'hidden'}>قمری: {labels.hijri}</span></div>; }
function MatrixScreen({ tasks, onToggle, onEdit, onMove, onAdd }: {
    tasks: Task[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onMove: (id: string, quadrant: MatrixQuadrant) => void;
    onAdd: () => void;
}) { const quadrants: Array<[string, string, MatrixQuadrant]> = [['فوری و مهم', 'urgent-important', 'urgent-important'], ['مهم و غیرفوری', 'not-urgent-important', 'not-urgent-important'], ['فوری و کم‌اهمیت', 'urgent-unimportant', 'urgent-unimportant'], ['غیرفوری و کم‌اهمیت', 'not-urgent-unimportant', 'not-urgent-unimportant']]; const options: Array<[MatrixQuadrant, string]> = [['urgent-important', 'فوری و مهم'], ['not-urgent-important', 'مهم و غیرفوری'], ['urgent-unimportant', 'فوری و کم‌اهمیت'], ['not-urgent-unimportant', 'غیرفوری و کم‌اهمیت']]; return <section className="screen matrix-screen"><TopBar title="ماتریس آیزنهاور" icon={<GridFour size={26} weight="duotone"/>} action={<div className="top-actions"><button className="icon-button" onClick={onAdd} aria-label="افزودن کار"><Plus size={24}/></button></div>}/><p className="matrix-help">ربع هر کار را مستقیماً تغییر بده؛ اولویت و ربع ماتریس مستقل از هم ذخیره می‌شوند.</p><div className="matrix-grid">{quadrants.map(([label, className, quadrant]) => { const quadrantTasks = tasks.filter((task) => (task.matrixQuadrant || matrixQuadrantForPriority(task.priority)) === quadrant); return <div className={`quadrant ${className}`} key={label}><h3>{label}</h3><div className="quadrant-tasks">{quadrantTasks.slice(0, 8).map(task => <div className="matrix-task" key={task.id}><button className="matrix-check" onClick={() => onToggle(task.id)} aria-label="تکمیل کار"><Circle size={23}/></button><span onClick={() => onEdit(task)}>{task.title}</span><select aria-label={`ربع ماتریس برای ${task.title}`} value={task.matrixQuadrant || matrixQuadrantForPriority(task.priority)} onChange={(event) => onMove(task.id, event.target.value as MatrixQuadrant)} onClick={(event) => event.stopPropagation()}>{options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></div>)}{!quadrantTasks.length && <span className="no-tasks">کاری نیست</span>}</div></div>; })}</div><button className="matrix-fab" onClick={onAdd} aria-label="افزودن کار"><Plus size={29} weight="bold"/></button></section>; }
function FocusScreen({ mode, onModeChange, seconds, running, onToggle, onReset, onOpenSettings, presetMinutes }: {
    mode: 'pomo' | 'stopwatch';
    onModeChange: (mode: 'pomo' | 'stopwatch') => void;
    seconds: number;
    running: boolean;
    onToggle: () => void;
    onReset: () => void;
    onOpenSettings: () => void;
    presetMinutes: number;
}) { const minute = String(Math.floor(seconds / 60)).padStart(2, '0'); const second = String(seconds % 60).padStart(2, '0'); return <section className="screen focus-screen"><div className="focus-toolbar"><button className="icon-button" onClick={onReset} aria-label="بازنشانی زمان‌سنج"><Clock size={27}/></button><button className="icon-button" onClick={onToggle} aria-label="شروع جلسه"><Plus size={27}/></button><button className="icon-button" onClick={onOpenSettings} aria-label="تنظیمات تمرکز"><DotsThree size={27}/></button></div><div className="mode-tabs"><button className={mode === 'stopwatch' ? '' : 'muted'} onClick={() => onModeChange('stopwatch')}>کرنومتر</button><button className={mode === 'pomo' ? 'active' : ''} onClick={() => onModeChange('pomo')}>پومودورو {mode === 'pomo' && `· ${faDigits(presetMinutes)} دقیقه`}</button></div><div className="focus-label">تمرکز</div><div className={`timer-ring ${running ? 'running' : ''}`}><span>{faDigits(`${minute}:${second}`)}</span></div><button className="focus-button" onClick={onToggle}>{running ? 'توقف و ذخیره' : 'شروع'}</button><div className="focus-hint">از تنظیمات تمرکز می‌توانی مدت، حالت شروع و رفتار زمان‌سنج را تغییر بدهی.</div></section>; }
function FocusSettings({ presetMinutes, onPresetChange, onClose, onOpenRecord }: { presetMinutes: number; onPresetChange: (minutes: number) => void; onClose: () => void; onOpenRecord: () => void }) {
    const [showPomo, setShowPomo] = useState(false);
    return <section className="screen settings-screen focus-settings-screen"><div className="inner-header"><button className="icon-button" onClick={onClose} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>تنظیمات تمرکز</h1></div><button className="settings-row settings-link" onClick={() => setShowPomo((value) => !value)}><ArrowRight size={22}/><span>{faDigits(presetMinutes)} دقیقه</span><strong>تنظیمات پومودورو</strong></button><button className="settings-row settings-link" onClick={onOpenRecord}><Plus size={22}/><span>جلسهٔ دستی</span><strong>افزودن رکورد تمرکز</strong></button>{showPomo && <SettingsCard title="مدت پومودورو"><div className="choice-row focus-duration-options">{[15, 25, 50, 90].map((minutes) => <ChoiceCard key={minutes} title={`${minutes} دقیقه`} selected={presetMinutes === minutes} onClick={() => onPresetChange(minutes)} icon={<Timer size={30}/>}/>)}</div></SettingsCard>}<SettingsCard title="وضعیت قابلیت‌ها"><p className="helper">پومودورو، کرنومتر، ذخیرهٔ رکورد و زنگ پایان جلسه در این نسخه فعال هستند. قابلیت‌هایی مثل حالت سخت‌گیرانه و Allowlist به مجوزهای سیستمی جداگانه نیاز دارند و به‌صورت ظاهری نمایش داده نمی‌شوند.</p></SettingsCard></section>;
}
function PreferenceToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) { return <button className="toggle-row preference-toggle" onClick={() => onChange(!value)}><span className={`switch ${value ? 'on' : ''}`}><i /></span><span><strong>{title}</strong><small>{description}</small></span></button>; }
function TabBarSettings({ order, setOrder, limit, setLimit }: { order: Screen[]; setOrder: (order: Screen[]) => void; limit: number; setLimit: (limit: number) => void }) {
    const move = (id: Screen, direction: -1 | 1) => { const index = order.indexOf(id); const target = index + direction; if (index < 0 || target < 0 || target >= order.length) return; const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; setOrder(next); };
    return <div className="settings-body"><SettingsCard title="نوار تب‌ها"><p className="helper">ترتیب تب‌ها را تغییر بده. تب‌های خارج از سقف انتخابی در «بیشتر» باقی می‌مانند.</p><div className="tabbar-list">{order.map((id, index) => { const item = navItems.find((nav) => nav.id === id)!; const ItemIcon = item.icon; return <div className={`tabbar-item ${index < limit ? 'visible' : ''}`} key={id}><ItemIcon size={23}/><strong>{item.label}</strong><small>{index < limit ? 'نمایش در نوار پایین' : 'در بیشتر'}</small><button onClick={() => move(id, -1)} disabled={index === 0} aria-label="بالا"><ArrowUp size={18}/></button><button onClick={() => move(id, 1)} disabled={index === order.length - 1} aria-label="پایین"><ArrowDown size={18}/></button></div>; })}</div></SettingsCard><SettingsCard title="حداکثر تعداد تب‌ها"><div className="choice-row">{[3, 4, 5].map((value) => <ChoiceCard key={value} title={`${value} تب`} selected={limit === value} onClick={() => setLimit(value)} icon={<SquaresFour size={30}/>}/>)}</div></SettingsCard></div>;
}
function CountdownScreen({ countdowns, onAdd, onDelete }: { countdowns: Countdown[]; onAdd: () => void; onDelete: (id: string) => void }) {
    const [filter, setFilter] = useState<'today' | 'weekend'>('today');
    const now = todayJalali();
    const visible = countdowns.filter((item) => filter === 'today' || (() => { const target = parseJalaliKey(item.dateKey); return target ? [5, 6].includes(jalaliWeekday(target)) : false; })());
    const daysFor = (item: Countdown) => { const target = parseJalaliKey(item.dateKey); if (!target) return 0; const diff = Math.round((jalaliAtToDate(item.dateKey, '12:00')!.getTime() - jalaliAtToDate(jalaliKey(now), '12:00')!.getTime()) / 86400000); return item.direction === 'until' ? diff : Math.abs(diff); };
    return <section className="screen countdown-screen"><TopBar title="شمارش معکوس" icon={<Timer size={26} weight="duotone"/>} action={<button className="icon-button" onClick={onAdd} aria-label="افزودن شمارش معکوس"><Plus size={25}/></button>}/><div className="segmented-control"><button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>امروز</button><button className={filter === 'weekend' ? 'active' : ''} onClick={() => setFilter('weekend')}>آخر هفته</button></div><div className="countdown-list">{visible.map((item) => <article className="countdown-card" key={item.id}><div className={`countdown-number ${item.direction === 'since' ? 'since' : ''}`}><b>{faDigits(daysFor(item))}</b><small>{item.direction === 'until' ? 'روز مانده' : 'روز گذشته'}</small></div><div className="countdown-copy"><strong>{item.title}</strong><small>{item.dateKey}</small></div><span className="countdown-icon"><Timer size={27}/></span><button className="icon-button" onClick={() => onDelete(item.id)} aria-label={`حذف ${item.title}`}><Trash size={20}/></button></article>)}{!visible.length && <EmptyState title="شمارش معکوسی نیست" subtitle="برای تولد، deadline یا یک اتفاق مهم اضافه کن." icon={<Timer size={64} weight="thin"/>}/>}</div><button className="fab" onClick={onAdd} aria-label="افزودن شمارش معکوس"><Plus size={32} weight="bold"/></button></section>;
}
function CountdownSheet({ onClose, onSave }: { onClose: () => void; onSave: (countdown: Omit<Countdown, 'id'>) => void }) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(formatJalaliInput(todayJalali()));
    const [direction, setDirection] = useState<Countdown['direction']>('until');
    const [icon, setIcon] = useState<Countdown['icon']>('timer');
    const valid = Boolean(title.trim() && parseJalaliInput(date));
    return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>افزودن شمارش معکوس</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><input className="habit-input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً: شروع سال تحصیلی"/><label className="field-label">تاریخ جلالی<input className="habit-input" value={date} onChange={(event) => setDate(event.target.value)} placeholder="۱۴۰۵/۰۷/۰۱"/></label><div className="frequency-options"><button className={direction === 'until' ? 'active' : ''} onClick={() => setDirection('until')}>روز مانده</button><button className={direction === 'since' ? 'active' : ''} onClick={() => setDirection('since')}>روز گذشته</button></div><div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" disabled={!valid} onClick={() => { const parsed = parseJalaliInput(date); if (parsed) onSave({ title: title.trim(), dateKey: jalaliKey(parsed), direction, icon }); }}>ذخیره</button></div></section></div>;
}
function AssistantScreen({ tasks, onCreateTask, onSearch, onAddTask }: { tasks: Task[]; onCreateTask: () => void; onSearch: () => void; onAddTask: (title: string) => void }) {
    const [message, setMessage] = useState('');
    const [input, setInput] = useState('');
    const todayTasks = tasks.filter((task) => task.dateKey === currentTodayKey() && !task.completed);
    const summarize = () => setMessage(todayTasks.length ? `امروز ${faDigits(todayTasks.length)} کار باز داری: ${todayTasks.slice(0, 3).map((task) => task.title).join('، ')}${todayTasks.length > 3 ? ' و چند کار دیگر.' : '.'}` : 'امروز کار بازِ تاریخ‌گذاری‌شده‌ای نداری. زمان خوبی برای استراحت یا برنامه‌ریزی فرداست.');
    const plan = () => setMessage(todayTasks.length ? `پیشنهاد برنامه: ${todayTasks.slice(0, 5).map((task, index) => `${faDigits(index + 1)}. ${task.title}`).join(' · ')}` : 'برای ساخت برنامه، اول یک کار با تاریخ امروز اضافه کن.');
    return <section className="screen assistant-screen"><TopBar title="دستیار زیتر" icon={<Archive size={26} weight="duotone"/>} onMenu={onSearch}/><div className="assistant-actions"><button onClick={onSearch}><MagnifyingGlass size={22}/> کارهای امروز من</button><button onClick={onCreateTask}><Plus size={22}/> ساخت کار</button><button onClick={summarize}><List size={22}/> خلاصهٔ امروز</button><button onClick={plan}><CalendarBlank size={22}/> برنامه‌ریزی روز</button></div><div className="assistant-notice">{message || 'دستیار محلی زیتر بدون ارسال داده‌ها به سرور، کارهای امروزت را مرتب می‌کند.'}</div><div className="assistant-input"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="ایده یا کار جدید را بنویس…" onKeyDown={(event) => { if (event.key === 'Enter' && input.trim()) { onAddTask(input.trim()); setInput(''); } }}/><button disabled={!input.trim()} onClick={() => { onAddTask(input.trim()); setInput(''); }}><Plus size={22}/></button></div><button className="premium-note" onClick={() => setMessage('قابلیت‌های ابری AI در این نسخه متصل نیست؛ خلاصه‌سازی و ساخت کار به‌صورت محلی فعال است.')}>نسخهٔ حرفه‌ای AI · توضیحات</button></section>;
}
function SearchScreen({ tasks, onToggle, onEdit, onBack }: { tasks: Task[]; onToggle: (id: string) => void; onEdit: (task: Task) => void; onBack: () => void }) {
    const [query, setQuery] = useState('');
    const results = tasks.filter((task) => matchesPersianQuery([task.title, task.note || '', task.description || '', task.list, task.tag || ''], query));
    return <section className="screen search-screen"><div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>جست‌وجو</h1></div><div className="search-field"><MagnifyingGlass size={22}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="عنوان، یادداشت، فهرست یا برچسب…"/></div><div className="search-results">{results.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}{!results.length && <EmptyState title={query ? 'نتیجه‌ای پیدا نشد' : 'همهٔ کارها آمادهٔ جست‌وجو هستند'} subtitle={query ? 'عبارت دیگری را امتحان کن.' : 'با عنوان، یادداشت، فهرست یا برچسب جست‌وجو کن.'} icon={<MagnifyingGlass size={64} weight="thin"/>}/>}</div></section>;
}
function FocusRecordSheet({ tasks, onClose, onSave }: { tasks: Task[]; onClose: () => void; onSave: (session: FocusSession) => void }) {
    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 25 * 60000);
    const toInput = (value: Date) => { const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); };
    const [taskId, setTaskId] = useState('');
    const [startAt, setStartAt] = useState(toInput(defaultStart));
    const [endAt, setEndAt] = useState(toInput(defaultEnd));
    const [type, setType] = useState<'POMODORO' | 'STOPWATCH'>('POMODORO');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const save = () => { const start = new Date(startAt); const end = new Date(endAt); const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)); if (!Number.isFinite(seconds) || seconds === 0) { setError('زمان پایان باید بعد از شروع باشد.'); return; } const session: FocusSession = { id: crypto.randomUUID(), taskId: taskId || undefined, startAt: start.toISOString(), endAt: end.toISOString(), duration: seconds / 60, durationSeconds: seconds, type, completed: type === 'POMODORO', interrupted: false }; if (note.trim()) localStorage.setItem(`zitar.focus.note.${session.id}`, note.trim()); onSave(session); };
    return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet focus-record-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>افزودن رکورد تمرکز</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><label className="field-label">کار مرتبط<select className="habit-input" value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">بدون کار</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="field-label">شروع<input className="habit-input" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)}/></label><label className="field-label">پایان<input className="habit-input" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)}/></label><div className="frequency-options"><button className={type === 'POMODORO' ? 'active' : ''} onClick={() => setType('POMODORO')}>پومودورو</button><button className={type === 'STOPWATCH' ? 'active' : ''} onClick={() => setType('STOPWATCH')}>کرنومتر</button></div><textarea className="detail-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="یادداشت تمرکز…"/>{error && <p className="helper" role="alert">{error}</p>}<div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" onClick={save}>ذخیره رکورد</button></div></section></div>;
}
function MoreScreen({ profileName, onProfileNameChange, completedCount, reminderPermission, onEnableReminders, onStats, onSettings, onHabits, onLists, onData, onCountdown, onAI, onSearch }: {
    profileName: string;
    onProfileNameChange: (value: string) => void;
    completedCount: number;
    reminderPermission: 'granted' | 'denied' | 'default' | 'unsupported';
    onEnableReminders: () => void;
    onStats: () => void;
    onSettings: () => void;
    onHabits: () => void;
    onLists: () => void;
    onData: () => void;
    onCountdown: () => void;
    onAI: () => void;
    onSearch: () => void;
}) { const reminderLabel = reminderPermission === 'granted' ? 'یادآورها فعال‌اند' : reminderPermission === 'denied' ? 'دسترسی یادآورها رد شده' : reminderPermission === 'unsupported' ? 'هشدار داخل برنامه فعال است' : 'فعال‌سازی یادآورهای دستگاه'; return <section className="screen more-screen"><TopBar title="بیشتر" icon={<SquaresFour size={26} weight="duotone"/>} action={<button className="icon-button" onClick={onSettings} aria-label="تنظیمات"><Gear size={24}/></button>}/><div className="more-hero"><div className="avatar"><UserCircle size={55} weight="duotone"/></div><div><h1>{profileName || 'کاربر زیتر'}</h1><p>حساب محلی · امروز {faDigits(completedCount)} کار تکمیل شده</p></div></div><div className="profile-alias"><label>نام نمایشی من<input value={profileName} onChange={event => onProfileNameChange(event.target.value)} placeholder="مثلاً حسین"/></label></div><SettingsCard title="ویژگی‌های اصلی"><div className="more-grid"><button className="more-card" onClick={onStats}><TrendUp size={29} weight="duotone"/><span>آمار عملکرد</span><small>روند انجام کارها</small></button><button className="more-card" onClick={onHabits}><FlowerLotus size={29} weight="duotone"/><span>عادت‌ها</span><small>ثبات روزانه</small></button><button className="more-card" onClick={onCountdown}><Timer size={29} weight="duotone"/><span>شمارش معکوس</span><small>روزهای مهم</small></button><button className="more-card" onClick={onAI}><Archive size={29}/><span>دستیار هوشمند</span><small>خلاصه و برنامه‌ریزی محلی</small></button><button className="more-card" onClick={onSearch}><MagnifyingGlass size={29}/><span>جست‌وجو</span><small>در همهٔ کارها</small></button></div></SettingsCard><SettingsCard title="مدیریت و تنظیمات"><div className="more-grid"><button className="more-card" onClick={onSettings}><Gear size={29} weight="duotone"/><span>تنظیمات</span><small>نمایش، تب‌ها و پوسته</small></button><button className="more-card" onClick={onLists}><FolderOpen size={29} weight="duotone"/><span>فهرست‌ها و پروژه‌ها</span><small>کار، شخصی و مطالعه</small></button><button className="more-card" onClick={onData}><Archive size={29}/><span>پشتیبان و سطل زباله</span><small>خروجی و بازیابی داده‌ها</small></button></div></SettingsCard><button className="more-note reminder-action" onClick={onEnableReminders}><Bell size={21}/> <span>{reminderLabel}</span></button></section>; }
function StatsScreen({ tasks, focusSessions, habits, onClose }: {
    tasks: Task[];
    focusSessions: FocusSession[];
    habits: Habit[];
    onClose: () => void;
}) { const [range, setRange] = useState<'overview' | 'day' | 'week' | 'month'>('overview'); const today = currentTodayKey(); const completed = tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === today || (!task.completedAt && task.dateKey === today))).length; const totalCompleted = tasks.filter((task) => task.completed).length; const focusTodaySeconds = focusSessions.filter((session) => dateKeyFromIso(session.startAt) === today).reduce((sum, session) => sum + (session.durationSeconds || session.duration * 60), 0); const focusToday = Math.round(focusTodaySeconds / 60); const habitDone = habits.reduce((sum, habit) => sum + (habit.completionDates?.includes(today) ? 1 : 0), 0); const habitRate = habits.length ? Math.round(habitDone / habits.length * 100) : 0; const days = Array.from({ length: range === 'day' ? 1 : range === 'month' ? 30 : 7 }, (_, index) => jalaliKey(addJalaliDays(todayJalali(), index - (range === 'day' ? 0 : range === 'month' ? 29 : 6)))); const completionSeries = days.map((key) => tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === key || (!task.completedAt && task.dateKey === key))).length); const rateSeries = days.map((key) => { const due = tasks.filter((task) => task.dateKey === key).length; const done = tasks.filter((task) => task.completed && (dateKeyFromIso(task.completedAt) === key || task.dateKey === key)).length; return due ? Math.round(done / due * 100) : 0; }); const tabs: Array<[typeof range, string]> = [['overview', 'نمای کلی'], ['day', 'روز'], ['week', 'هفته'], ['month', 'ماه']]; return <section className="screen stats-screen"><div className="stats-top"><button className="icon-button" onClick={onClose} aria-label="بازگشت"><X size={30}/></button><div className="stats-tabs">{tabs.map(([id, label]) => <button key={id} className={range === id ? 'active' : ''} onClick={() => setRange(id)}>{label}</button>)}</div></div><div className="metric-grid"><Metric title="تکمیل امروز" value={completed}/><Metric title="کل تکمیل‌شده" value={totalCompleted}/><Metric title="تمرکز امروز" value={`${faDigits(focusToday)} دقیقه`}/><Metric title="عادت‌های امروز" value={`${faDigits(habitRate)}٪`}/></div><ChartCard title="روند تکمیل اخیر" values={completionSeries}/><ChartCard title="نرخ تکمیل اخیر" values={rateSeries} rate/><FocusStatsPanel focusSessions={focusSessions}/></section>; }
function FocusStatsPanel({ focusSessions }: { focusSessions: FocusSession[] }) { const today = currentTodayKey(); const todaySessions = focusSessions.filter((session) => dateKeyFromIso(session.startAt) === today); const todaySeconds = todaySessions.reduce((sum, session) => sum + (session.durationSeconds || session.duration * 60), 0); const pomoToday = todaySessions.filter((session) => session.type === 'POMODORO').length; const totalSeconds = focusSessions.reduce((sum, session) => sum + (session.durationSeconds || session.duration * 60), 0); const values = Array.from({ length: 7 }, (_, index) => { const key = jalaliKey(addJalaliDays(todayJalali(), index - 6)); return Math.round(focusSessions.filter((session) => dateKeyFromIso(session.startAt) === key).reduce((sum, session) => sum + (session.durationSeconds || session.duration * 60), 0) / 60); }); return <section className="focus-stats-panel"><h2>آمار تمرکز</h2><div className="metric-grid"><Metric title="پومودورو امروز" value={pomoToday}/><Metric title="تمرکز امروز" value={`${faDigits(Math.round(todaySeconds / 60))} دقیقه`}/><Metric title="کل پومودورو" value={focusSessions.filter((session) => session.type === 'POMODORO').length}/><Metric title="کل زمان تمرکز" value={`${faDigits(Math.round(totalSeconds / 60))} دقیقه`}/></div><ChartCard title="روند تمرکز این هفته" values={values}/><SettingsCard title="رکوردهای تمرکز"><div className="focus-record-list">{focusSessions.slice(0, 5).map((session) => <div className="focus-record-row" key={session.id}><Timer size={21}/><span>{session.type === 'POMODORO' ? 'پومودورو' : 'کرنومتر'}</span><small>{faDigits(Math.round(session.durationSeconds || session.duration * 60))} ثانیه</small></div>)}{!focusSessions.length && <p className="helper">هنوز رکوردی ثبت نشده؛ از دکمهٔ + برای ثبت دستی استفاده کن.</p>}</div></SettingsCard></section>; }
function Metric({ title, value }: {
    title: string;
    value: string | number;
}) { return <div className="metric-card"><strong>{title}</strong><small>بر اساس داده‌های ذخیره‌شده <TrendUp size={14}/></small><b>{typeof value === 'number' ? faDigits(value) : value}</b></div>; }
function ChartCard({ title, values, rate = false }: {
    title: string;
    values: number[];
    rate?: boolean;
}) { const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day'); const visibleValues = period === 'day' ? values.slice(-1) : period === 'week' ? values.slice(-7) : values; const max = Math.max(...visibleValues, 1); return <div className="chart-card"><h3>{title}</h3><div className="chart-tabs">{(['day', 'week', 'month'] as const).map(item => <button key={item} className={period === item ? 'selected' : ''} onClick={() => setPeriod(item)}>{item === 'day' ? 'روز' : item === 'week' ? 'هفته' : 'ماه'}</button>)}</div>{visibleValues.length ? <div className={`fake-bars ${rate ? 'rate-bars' : ''}`}>{visibleValues.map((value, i) => <i key={i} style={{ height: `${Math.max(4, value / max * 100)}%` }} title={faDigits(value)}/>)}</div> : <div className="no-data">هنوز داده‌ای نیست</div>}<div className="chart-axis"><span>{period === 'month' ? '۳۰ روز قبل' : period === 'week' ? '۶ روز قبل' : 'امروز'}</span><span>{period === 'day' ? 'امروز' : period === 'week' ? '۳ روز قبل' : '۱۵ روز قبل'}</span><span>امروز</span></div></div>; }
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
function ListSheet({ initialTitle = '', editing = false, onClose, onSave }: { initialTitle?: string; editing?: boolean; onClose: () => void; onSave: (title: string) => void }) { const [title, setTitle] = useState(initialTitle); return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>{editing ? 'تغییر نام دسته' : 'افزودن دسته'}</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><input className="habit-input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً: پروژه‌های کاری"/><div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" disabled={!title.trim()} onClick={() => onSave(title)}>{editing ? 'ذخیره نام' : 'ساخت دسته'}</button></div></section></div>; }
function ListsScreen({ tasks, lists, onToggle, onEdit, onAdd, onRename, onDelete, onBack }: {
    tasks: Task[];
    lists: string[];
    onToggle: (id: string) => void;
    onEdit: (task: Task) => void;
    onAdd: () => void;
    onRename: (name: string) => void;
    onDelete: (name: string) => void;
    onBack: () => void;
}) { return <section className="screen lists-screen"><div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>دسته‌ها و فهرست‌ها</h1><button className="icon-button" onClick={onAdd} aria-label="افزودن دسته"><Plus size={26}/></button></div><p className="helper list-helper">کارها را در دسته‌های شخصی، دانشگاه، کار، باشگاه یا دسته‌های دلخواهت مرتب کن.</p><div className="list-cards">{unique([...lists, ...tasks.map(t => t.list)]).map(list => { const listTasks = tasks.filter(t => t.list === list); const canEdit = !listNames.includes(list); return <section className="list-card" key={list}><div className="list-card-head"><FolderOpen size={25} weight="duotone"/><strong>{list}</strong><span>{faDigits(listTasks.length)}</span>{canEdit && <><button className="icon-button" onClick={() => onRename(list)} aria-label={'تغییر نام ' + list}><PencilSimple size={18}/></button><button className="icon-button danger-icon" onClick={() => { if (window.confirm('دستهٔ «' + list + '» حذف شود؟ کارهایش به ورودی‌ها منتقل می‌شوند.')) onDelete(list); }} aria-label={'حذف ' + list}><Trash size={18}/></button></>}</div>{listTasks.map(task => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}</section>; })}</div></section>; }
function SettingsScreen({ tab, setTab, appearanceMode, setAppearanceMode, colorScheme, setColorScheme, season, setSeason, tabOrder, setTabOrder, tabLimit, setTabLimit, fontScale, setFontScale, fontFamily, setFontFamily, onBack }: {
    tab: SettingsTab;
    setTab: (tab: SettingsTab) => void;
    appearanceMode: 'dark' | 'light' | 'system';
    setAppearanceMode: (mode: 'dark' | 'light' | 'system') => void;
    colorScheme: 'default' | 'turquoise' | 'peach' | 'pebble';
    setColorScheme: (scheme: 'default' | 'turquoise' | 'peach' | 'pebble') => void;
    season: 'none' | 'spring' | 'summer' | 'autumn' | 'winter';
    setSeason: (season: 'none' | 'spring' | 'summer' | 'autumn' | 'winter') => void;
    tabOrder: Screen[];
    setTabOrder: (order: Screen[]) => void;
    tabLimit: number;
    setTabLimit: (limit: number) => void;
    fontScale: number;
    setFontScale: (scale: number) => void;
    fontFamily: string;
    setFontFamily: (family: string) => void;
    onBack: () => void;
}) { return <section className="screen settings-screen"><div className="settings-tabs"><button className={tab === 'display' ? 'active' : ''} onClick={() => setTab('display')}>نمایش</button><button className={tab === 'icons' ? 'active' : ''} onClick={() => setTab('icons')}>آیکون برنامه</button><button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>پوسته</button><button className={tab === 'tabbar' ? 'active' : ''} onClick={() => setTab('tabbar')}>تب‌ها</button><button className={tab === 'dateTime' ? 'active' : ''} onClick={() => setTab('dateTime')}>تاریخ و زمان</button><button className="icon-button back" onClick={onBack} aria-label="بازگشت"><ArrowLeft size={29}/></button></div>{tab === 'display' && <DisplaySettings fontScale={fontScale} setFontScale={setFontScale} fontFamily={fontFamily} setFontFamily={setFontFamily} onDateTime={() => setTab('dateTime')}/>} {tab === 'dateTime' && <DateTimeSettings onBack={() => setTab('display')}/>} {tab === 'icons' && <IconSettings />}{tab === 'theme' && <ThemeSettings appearanceMode={appearanceMode} setAppearanceMode={setAppearanceMode} colorScheme={colorScheme} setColorScheme={setColorScheme} season={season} setSeason={setSeason}/>} {tab === 'tabbar' && <TabBarSettings order={tabOrder} setOrder={setTabOrder} limit={tabLimit} setLimit={setTabLimit}/>}</section>; }
function DisplaySettings({ fontScale, setFontScale, fontFamily, setFontFamily, onDateTime }: { fontScale: number; setFontScale: (scale: number) => void; fontFamily: string; setFontFamily: (family: string) => void; onDateTime: () => void }) { return <div className="settings-body"><SettingsCard title="نوع فونت"><div className="frequency-options"><button className={fontFamily === 'Vazirmatn' ? 'active' : ''} onClick={() => setFontFamily('Vazirmatn')}>وزیرمتن</button><button className={fontFamily === 'Jomhuria' ? 'active' : ''} onClick={() => setFontFamily('Jomhuria')}>جمهور</button><button className={fontFamily === 'Tahoma' ? 'active' : ''} onClick={() => setFontFamily('Tahoma')}>Tahoma</button><button className={fontFamily === 'serif' ? 'active' : ''} onClick={() => setFontFamily('serif')}>سریف</button></div></SettingsCard><SettingsCard title="اندازه فونت"><div className="frequency-options">{[[0.9, 'کوچک'], [1, 'پیش‌فرض'], [1.15, 'بزرگ'], [1.3, 'خیلی بزرگ']].map(([value, label]) => <button key={String(value)} className={fontScale === value ? 'active' : ''} onClick={() => setFontScale(value as number)}>{label}</button>)}</div><p className="helper">این گزینه مقیاس واقعی رابط را تغییر می‌دهد، نه فقط اندازهٔ یک متن.</p></SettingsCard><SettingsRow title="تاریخ و زمان" value="سه تقویم، فرمت ساعت و شروع هفته" onClick={onDateTime}/><SettingsCard title="ویجت امروز"><p className="helper">ویجت کارهای امروز پس از نصب نسخهٔ جدید در فهرست ویجت‌های صفحهٔ اصلی گوشی قابل افزودن است.</p></SettingsCard></div>; }
function DateTimeSettings({ onBack }: { onBack: () => void }) { const [timeFormat, setTimeFormat] = useState<'24' | '12'>(() => readStore<'24' | '12'>('zitar.timeFormat', '24')); const [startDay, setStartDay] = useState<'saturday' | 'sunday'>(() => readStore<'saturday' | 'sunday'>('zitar.startDay', 'saturday')); const [calendarLabels, setCalendarLabels] = useState(() => readStore('zitar.calendarLabels', { jalali: true, gregorian: true, hijri: true })); const save = <T,>(key: string, value: T, setter: (value: T) => void) => { setter(value); localStorage.setItem(`zitar.${key}`, JSON.stringify(value)); }; return <div className="settings-body"><div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>تاریخ و زمان</h1></div><SettingsCard title="فرمت زمان"><div className="choice-row"><ChoiceCard title="۲۴ ساعته" selected={timeFormat === '24'} onClick={() => save('timeFormat', '24', setTimeFormat)} icon={<Clock size={30}/>}/><ChoiceCard title="۱۲ ساعته" selected={timeFormat === '12'} onClick={() => save('timeFormat', '12', setTimeFormat)} icon={<Clock size={30}/>}/></div></SettingsCard><SettingsCard title="شروع هفته"><div className="frequency-options"><button className={startDay === 'saturday' ? 'active' : ''} onClick={() => save('startDay', 'saturday', setStartDay)}>شنبه</button><button className={startDay === 'sunday' ? 'active' : ''} onClick={() => save('startDay', 'sunday', setStartDay)}>یکشنبه</button></div><p className="helper">این انتخاب روی نمای ماه و هفتهٔ تقویم اعمال می‌شود.</p></SettingsCard><SettingsCard title="تقویم‌های قابل نمایش"><PreferenceToggle title="تقویم شمسی" description="تاریخ شمسی در کنار ددلاین نمایش داده شود." value={calendarLabels.jalali} onChange={(value) => save('calendarLabels', { ...calendarLabels, jalali: value }, setCalendarLabels)}/><PreferenceToggle title="تقویم میلادی" description="تاریخ میلادی در کنار ددلاین نمایش داده شود." value={calendarLabels.gregorian} onChange={(value) => save('calendarLabels', { ...calendarLabels, gregorian: value }, setCalendarLabels)}/><PreferenceToggle title="تقویم قمری" description="تاریخ قمری در کنار ددلاین نمایش داده شود." value={calendarLabels.hijri} onChange={(value) => save('calendarLabels', { ...calendarLabels, hijri: value }, setCalendarLabels)}/><p className="helper">هر سه تقویم در انتخاب ددلاین و نمای تقویم قابل استفاده‌اند.</p></SettingsCard></div>; }
function IconSettings() { return <div className="settings-body"><SettingsCard title="آیکون برنامه"><div className="zitar-icon-preview"><img src="/zitar-logo.png" alt="لوگوی زیتر"/></div><p className="helper">آیکون رسمی زیتر فعال است و با همین هویت در صفحهٔ اصلی گوشی و اعلان‌ها نمایش داده می‌شود.</p></SettingsCard></div>; }
function ThemeSettings({ appearanceMode, setAppearanceMode, colorScheme, setColorScheme, season, setSeason }: {
    appearanceMode: 'dark' | 'light' | 'system';
    setAppearanceMode: (mode: 'dark' | 'light' | 'system') => void;
    colorScheme: 'default' | 'turquoise' | 'peach' | 'pebble';
    setColorScheme: (scheme: 'default' | 'turquoise' | 'peach' | 'pebble') => void;
    season: 'none' | 'spring' | 'summer' | 'autumn' | 'winter';
    setSeason: (season: 'none' | 'spring' | 'summer' | 'autumn' | 'winter') => void;
}) { const themes = [['default', '#4773fa', 'پیش‌فرض'], ['turquoise', '#73D6C5', 'فیروزه‌ای'], ['peach', '#F1A5C1', 'هلویی'], ['pebble', '#8A8A8A', 'سنگی']] as const; const seasons = [['none', 'بدون فصل'], ['spring', 'بهار'], ['summer', 'تابستان'], ['autumn', 'پاییز'], ['winter', 'زمستان']] as const; return <div className="settings-body"><SettingsCard title="حالت نمایش"><div className="theme-mode-grid">{([['dark', '#000000', 'تیره'], ['light', '#F5F5F7', 'روشن'], ['system', 'linear-gradient(135deg,#000 50%,#F5F5F7 50%)', 'هماهنگ با سیستم']] as const).map(([id, color, label]) => <button key={id} className={`theme-mode ${appearanceMode === id ? 'selected' : ''}`} onClick={() => setAppearanceMode(id)}><i style={{ background: color }}/><span>{label}</span>{appearanceMode === id && <Check size={17} weight="bold"/>}</button>)}</div></SettingsCard><SettingsCard title="رنگ‌های اصلی"><div className="theme-grid">{themes.map(([id, color, label]) => <button key={id} className={`theme-option ${colorScheme === id ? 'selected' : ''}`} onClick={() => setColorScheme(id)}><i style={{ background: color }}/>{colorScheme === id && <Check className="theme-check" size={19} weight="bold"/>}<span>{label}</span></button>)}</div></SettingsCard><SettingsCard title="فصل‌ها"><div className="season-grid">{seasons.map(([id, label]) => <button key={id} className={`season-card ${id} ${season === id ? 'selected' : ''}`} onClick={() => setSeason(id)}><span>{label}</span>{season === id && <Check size={19} weight="bold"/>}</button>)}</div></SettingsCard></div>; }
function SettingsRow({ title, value, onClick }: {
    title: string;
    value: string;
    onClick?: () => void;
}) { const content = <><ArrowRight size={22}/><span>{value}</span><strong>{title}</strong></>; return onClick ? <button className="settings-row settings-link" onClick={onClick}>{content}</button> : <div className="settings-row">{content}</div>; }
function SettingsCard({ title, children }: {
    title: string;
    children: React.ReactNode;
}) { return <section className="settings-card"><h2>{title}</h2>{children}</section>; }
function ChoiceCard({ title, selected, accent = false, icon, onClick }: {
    title: string;
    selected?: boolean;
    accent?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
}) { return <button type="button" className={`choice-card ${selected ? 'selected' : ''}`} onClick={onClick}><span className={accent ? 'choice-demo accent-demo' : 'choice-demo'}>{icon || <><span>کار</span><span>کار</span></>}</span><small>{title}</small>{selected && <span className="choice-check"><Check size={15} weight="bold"/></span>}</button>; }
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
function CreateTaskSheet({ initialTitle, lists, onClose, onSave }: { initialTitle: string; lists: string[]; onClose: () => void; onSave: (draft: Partial<Task> & Pick<Task, 'title'>) => void }) {
  const parsed = useMemo(() => parseQuickAdd(initialTitle), [initialTitle])
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState('')
  const [list, setList] = useState('Inbox')
  const [dateSystem, setDateSystem] = useState<CalendarSystem>('JALALI')
  const [dateText, setDateText] = useState(parsed.dateKey ? formatCalendarInput(parseJalaliKey(parsed.dateKey) || todayJalali(), 'JALALI') : '')
  const [time, setTime] = useState(parsed.time || '')
  const [duration, setDuration] = useState<number | undefined>()
  const [reminder, setReminder] = useState(Boolean(parsed.dateKey && parsed.time))
  const [syncCalendar, setSyncCalendar] = useState(false)
  const [priority, setPriority] = useState<Priority>('none')
  const [matrixQuadrant, setMatrixQuadrant] = useState<MatrixQuadrant>(matrixQuadrantForPriority('none'))
  const [recurrence, setRecurrence] = useState(parsed.recurrence || '')
  const selectedDate = dateText ? parseCalendarInput(dateText, dateSystem) : null
  const dateError = Boolean(dateText.trim() && !selectedDate)
  const timeError = Boolean(time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  const quickParsed = useMemo(() => parseQuickAdd(title), [title])
  const effectiveTitle = quickParsed.title || title.trim()
  const valid = Boolean(effectiveTitle && !dateError && !timeError && (!time || selectedDate))
  const changeDateSystem = (next: CalendarSystem) => { setDateSystem(next); if (selectedDate) setDateText(formatCalendarInput(selectedDate, next)) }
  const save = () => { if (!valid) return; const inferredDate = selectedDate || (quickParsed.dateKey ? parseJalaliKey(quickParsed.dateKey) : null); const inferredTime = time || quickParsed.time || ''; onSave({ title: effectiveTitle, description: description || undefined, list, dateSystem, dateKey: inferredDate ? jalaliKey(inferredDate) : undefined, date: inferredDate ? jalaliShortLabel(inferredDate) : undefined, time: inferredTime || undefined, duration, reminder: reminder && Boolean(inferredDate && inferredTime), syncCalendar: syncCalendar && Boolean(inferredDate), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran', priority, matrixQuadrant, recurrence: recurrence || quickParsed.recurrence || undefined }) }
  const labels = selectedDate ? calendarLabelsForJalali(selectedDate) : null
  return <div className="sheet-backdrop" onClick={onClose}><section className="quick-sheet create-task-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>افزودن کار کامل</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div>
    <label className="field-label">عنوان<input autoFocus className="detail-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="مثلاً: جلسه با احمد"/></label>
    <label className="field-label">توضیح کوتاه<input className="habit-input" value={description} onChange={event => setDescription(event.target.value)} placeholder="اختیاری"/></label>
    <div className="calendar-system-tabs" role="tablist" aria-label="تقویم مهلت">{([['JALALI', 'شمسی'], ['GREGORIAN', 'میلادی'], ['HIJRI', 'قمری']] as const).map(([system, label]) => <button type="button" key={system} className={dateSystem === system ? 'active' : ''} onClick={() => changeDateSystem(system)}>{label}</button>)}</div>
    <label className="field-label">مهلت در تقویم {dateSystem === 'JALALI' ? 'شمسی' : dateSystem === 'GREGORIAN' ? 'میلادی' : 'قمری'}<input className="habit-input" dir="ltr" value={dateText} onChange={event => setDateText(event.target.value)} placeholder={dateSystem === 'JALALI' ? '۱۴۰۵/۰۶/۲۷' : dateSystem === 'GREGORIAN' ? '۲۰۲۶/۰۹/۱۸' : '۱۴۴۷/۰۳/۲۶'}/></label><CalendarPicker system={dateSystem} value={selectedDate ? jalaliKey(selectedDate) : undefined} onChange={key => setDateText(formatCalendarInput(parseJalaliKey(key) || todayJalali(), dateSystem))}/>
    {dateError && <p className="helper" role="alert">تاریخ واردشده معتبر نیست.</p>}{labels && <div className="calendar-labels"><span>شمسی: {labels.jalali}</span><span>میلادی: {labels.gregorian}</span><span>قمری: {labels.hijri}</span></div>}
    <div className="editor-fields"><label className="field-label">ساعت<input className="habit-input" type="time" value={time} onChange={event => setTime(event.target.value)}/></label><label className="field-label">مدت (دقیقه)<input className="habit-input" type="number" min="1" max="1440" value={duration || ''} onChange={event => setDuration(event.target.value ? Number(event.target.value) : undefined)}/></label></div>
    {timeError && <p className="helper" role="alert">ساعت معتبر نیست.</p>}<label className="editor-check"><input type="checkbox" checked={reminder && Boolean(selectedDate && time)} disabled={!selectedDate || !time} onChange={event => setReminder(event.target.checked)}/> یادآوری با زنگ دستگاه</label><label className="editor-check"><input type="checkbox" checked={syncCalendar && Boolean(selectedDate)} disabled={!selectedDate} onChange={event => setSyncCalendar(event.target.checked)}/> ثبت در تقویم گوشی {time ? '' : '(تمام‌روز)'}</label>
    <div className="editor-fields"><label className="field-label">اولویت<select className="habit-input" value={priority} onChange={event => setPriority(event.target.value as Priority)}><option value="none">بدون اولویت</option><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option></select></label><label className="field-label">فهرست<select className="habit-input" value={list} onChange={event => setList(event.target.value)}>{lists.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
    <label className="field-label">ربع ماتریس آیزنهاور<select className="habit-input" value={matrixQuadrant} onChange={event => setMatrixQuadrant(event.target.value as MatrixQuadrant)}><option value="urgent-important">فوری و مهم</option><option value="not-urgent-important">مهم و غیرفوری</option><option value="urgent-unimportant">فوری و کم‌اهمیت</option><option value="not-urgent-unimportant">غیرفوری و کم‌اهمیت</option></select></label>
    <label className="field-label">تکرار<select className="habit-input" value={recurrence} onChange={event => setRecurrence(event.target.value)}><option value="">بدون تکرار</option><option>هر روز</option><option>هر هفته</option><option>هر دو هفته</option><option>هر ماه</option><option>هر سال</option></select></label>
    <div className="sheet-actions"><button className="ghost" onClick={onClose}>انصراف</button><button className="primary" disabled={!valid} onClick={save}>ذخیره کار</button></div>
  </section></div>
}
function SearchSheet({ query, setQuery, tasks, onToggle, onClose, onEdit }: {
    query: string;
    setQuery: (value: string) => void;
    tasks: Task[];
    onToggle: (id: string) => void;
    onClose: () => void;
    onEdit: (task: Task) => void;
}) { const results = tasks.filter(task => matchesPersianQuery([task.title, task.description || '', task.note || '', task.list, task.tag || ''], query)); return <div className="sheet-backdrop" onClick={onClose}><section className="search-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-title"><strong>جست‌وجوی همه کارها</strong><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={24}/></button></div><div className="search-field"><MagnifyingGlass size={22}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="عنوان، یادداشت، فهرست، برچسب..."/></div><div className="search-results">{results.map(task => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit}/>)}{!results.length && <EmptyState title="نتیجه‌ای پیدا نشد" subtitle="املای دیگری را امتحان کن."/>}</div></section></div>; }
function BottomNav({ screen, navigate, items }: {
    screen: Screen;
    navigate: (screen: Screen) => void;
    items: typeof navItems;
}) { return <nav className="bottom-nav">{items.map(({ id, label, icon: ItemIcon }) => <button key={id} className={screen === id ? 'active' : ''} onClick={() => navigate(id)}><ItemIcon size={27} weight={screen === id ? 'fill' : 'duotone'}/><span>{label}</span></button>)}</nav>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
