import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarBlank, Check, Trash, X } from '@phosphor-icons/react'
import { addJalaliDays, addJalaliMonths, formatCalendarInput, jalaliKey, jalaliLabel, jalaliMonthNames, jalaliShortLabel, jalaliWeekday, jalaliWeekdayNames, parseCalendarInput, parseJalaliKey, todayJalali, type CalendarSystem } from '../../core/date'
import { matrixQuadrantForPriority, type MatrixQuadrant, type Task, type TaskPriority } from '../../core/task'

const latin = (text: string) => text.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
const fa = (value: number) => value.toLocaleString('fa-IR', { useGrouping: false })

function JalaliPicker({ value, onChange }: { value?: string; onChange: (key: string) => void }) {
  const [month, setMonth] = useState(() => ({ ...(parseJalaliKey(value || '') || todayJalali()), day: 1 }))
  const days = Array.from({ length: 42 }, (_, i) => addJalaliDays(month, i - jalaliWeekday(month)))
  return <div className="inline-calendar">
    <div className="calendar-month"><button type="button" className="icon-button" aria-label="ماه قبل" onClick={() => setMonth(addJalaliMonths(month, -1))}><ArrowRight size={20}/></button><strong>{jalaliMonthNames[month.month - 1]} {fa(month.year)}</strong><button type="button" className="icon-button" aria-label="ماه بعد" onClick={() => setMonth(addJalaliMonths(month, 1))}><ArrowLeft size={20}/></button></div>
    <div className="month-weekdays">{jalaliWeekdayNames.map(day => <span key={day}>{day.slice(0, 2)}</span>)}</div>
    <div className="month-grid">{days.map(day => <button type="button" key={jalaliKey(day)} aria-label={jalaliLabel(day)} aria-pressed={jalaliKey(day) === value} className={`${jalaliKey(day) === value ? 'selected-month-day' : ''} ${day.month !== month.month ? 'outside' : ''} ${jalaliWeekday(day) === 6 ? 'holiday' : ''}`} onClick={() => onChange(jalaliKey(day))}>{fa(day.day)}</button>)}</div>
    <div className="data-actions"><button type="button" className="ghost" onClick={() => onChange(jalaliKey(todayJalali()))}>امروز</button><button type="button" className="ghost" onClick={() => onChange(jalaliKey(addJalaliDays(todayJalali(), 1)))}>فردا</button><button type="button" className="ghost" onClick={() => onChange('')}>بدون تاریخ</button></div>
  </div>
}

export function TaskEditor({ task, lists, onClose, onSave, onDelete }: {
  task: Task; lists: string[]; onClose: () => void; onSave: (task: Task) => void; onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState(task)
  const [dateSystem, setDateSystem] = useState<CalendarSystem>(task.dateSystem || 'JALALI')
  const [dateText, setDateText] = useState(() => task.dateKey ? formatCalendarInput(parseJalaliKey(task.dateKey) || todayJalali(), task.dateSystem || 'JALALI') : '')
  const [picker, setPicker] = useState(false)
  const [syncCalendar, setSyncCalendar] = useState(Boolean(task.syncCalendar))
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close() }, [])
  const patch = (value: Partial<Task>) => setDraft(t => ({ ...t, ...value }))
  const selectedDate = dateText ? parseCalendarInput(dateText, dateSystem) : null
  const normalizedDate = selectedDate ? jalaliKey(selectedDate) : ''
  const dateError = !!dateText.trim() && !selectedDate
  const time = latin(draft.time || '')
  const timeError = !!time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  const valid = !!draft.title.trim() && !!draft.list.trim() && !dateError && !timeError && (!time || !!selectedDate)
  const save = () => { if (!valid) return; onSave({ ...draft, dateKey: normalizedDate, dateSystem, date: selectedDate ? jalaliShortLabel(selectedDate) : '', time, reminder: draft.reminder && !!selectedDate && !!time, syncCalendar: syncCalendar && !!selectedDate && !!time }) }
  const changeDateSystem = (next: CalendarSystem) => { setDateSystem(next); if (selectedDate) setDateText(formatCalendarInput(selectedDate, next)); }
  const repeatOptions = ['', 'هر روز', 'هر هفته', 'هر دو هفته', 'هر ماه', 'هر سال', ...jalaliWeekdayNames.map(day => `هر ${day}`)]
  if (draft.recurrence && !repeatOptions.includes(draft.recurrence)) repeatOptions.push(draft.recurrence)
  return <dialog ref={dialog} className="detail-sheet task-dialog" aria-labelledby="editor-title" onCancel={onClose}>
    <form onSubmit={event => { event.preventDefault(); save() }}>
      <div className="sheet-handle"/><div className="sheet-title"><strong id="editor-title">جزئیات کار</strong><button type="button" className="icon-button" aria-label="بستن" onClick={onClose}><X size={24}/></button></div>
      <label className="editor-field">عنوان<input autoFocus required className="detail-title" value={draft.title} onChange={e => patch({ title: e.target.value })}/></label>
      <label className="editor-field">توضیح<input value={draft.description || ''} onChange={e => patch({ description: e.target.value })}/></label>
      <div className="calendar-system-tabs" role="tablist" aria-label="تقویم تاریخ کار">{([['JALALI', 'شمسی'], ['GREGORIAN', 'میلادی'], ['HIJRI', 'قمری']] as const).map(([system, label]) => <button type="button" key={system} className={dateSystem === system ? 'active' : ''} onClick={() => changeDateSystem(system)}>{label}</button>)}</div>
      <div className="editor-fields"><label className="editor-field">تاریخ {dateSystem === 'JALALI' ? 'جلالی' : dateSystem === 'GREGORIAN' ? 'میلادی' : 'قمری'}<input dir="ltr" placeholder={dateSystem === 'JALALI' ? '۱۴۰۵/۰۶/۲۷' : dateSystem === 'GREGORIAN' ? '۲۰۲۶/۰۹/۱۸' : '۱۴۴۷/۰۳/۲۶'} aria-invalid={dateError} value={dateText} onChange={e => setDateText(e.target.value)}/></label><button type="button" className="detail-button" onClick={() => setPicker(!picker)} aria-expanded={picker}><CalendarBlank size={20}/> {dateSystem === 'JALALI' ? 'انتخاب تاریخ' : 'نمایش تقویم شمسی'}</button></div>
      {picker && dateSystem === 'JALALI' && <JalaliPicker value={normalizedDate} onChange={key => { setDateText(formatCalendarInput(parseJalaliKey(key) || todayJalali(), dateSystem)); setPicker(false) }}/>} {dateError && <p role="alert">تاریخ {dateSystem === 'JALALI' ? 'جلالی' : dateSystem === 'GREGORIAN' ? 'میلادی' : 'قمری'} معتبر نیست.</p>}
      <div className="editor-fields"><label className="editor-field">ساعت (تهران)<input type="time" value={time} onChange={e => patch({ time: e.target.value })}/></label><label className="editor-field">مدت (دقیقه)<input type="number" min="1" max="1440" value={draft.duration || ''} onChange={e => patch({ duration: e.target.value ? Math.max(1, Math.min(1440, Number(e.target.value))) : undefined })}/></label></div>
      {time && !selectedDate && <p role="alert">برای تعیین ساعت، تاریخ را هم انتخاب کنید.</p>}
      <label className="editor-check"><input type="checkbox" checked={!!draft.reminder && !!selectedDate && !!time} disabled={!selectedDate || !time} onChange={e => patch({ reminder: e.target.checked })}/> یادآوری در زمان کار (نیازمند مجوز اعلان)</label>
      <label className="editor-check"><input type="checkbox" checked={syncCalendar && !!selectedDate && !!time} disabled={!selectedDate || !time} onChange={e => setSyncCalendar(e.target.checked)}/> ثبت این قرار در تقویم گوشی</label>
      <div className="editor-fields"><label className="editor-field">تکرار<select value={draft.recurrence || ''} onChange={e => patch({ recurrence: e.target.value })}>{repeatOptions.map(rule => <option key={rule} value={rule}>{rule || 'بدون تکرار'}</option>)}</select></label><label className="editor-field">اولویت<select value={draft.priority} onChange={e => patch({ priority: e.target.value as TaskPriority })}><option value="none">بدون اولویت</option><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option></select></label></div>
      <label className="editor-field">ربع ماتریس آیزنهاور<select value={draft.matrixQuadrant || matrixQuadrantForPriority(draft.priority)} onChange={e => patch({ matrixQuadrant: e.target.value as MatrixQuadrant })}><option value="urgent-important">فوری و مهم</option><option value="not-urgent-important">مهم و غیرفوری</option><option value="urgent-unimportant">فوری و کم‌اهمیت</option><option value="not-urgent-unimportant">غیرفوری و کم‌اهمیت</option></select></label>
      <label className="editor-field">فهرست<input list="task-lists" required value={draft.list} onChange={e => patch({ list: e.target.value })}/><datalist id="task-lists">{lists.map(list => <option key={list} value={list}/>)}</datalist></label>
      <label className="editor-field">برچسب<input value={draft.tag || ''} onChange={e => patch({ tag: e.target.value })}/></label>
      <label className="editor-field">یادداشت<textarea className="detail-note" value={draft.note || ''} onChange={e => patch({ note: e.target.value })}/></label>
      <div className="detail-actions"><button type="button" className="danger" onClick={() => onDelete(task.id)}><Trash size={19}/> انتقال به سطل زباله</button><button className="primary" type="submit" disabled={!valid}><Check size={19}/> ذخیره تغییرات</button></div>
    </form>
  </dialog>
}
