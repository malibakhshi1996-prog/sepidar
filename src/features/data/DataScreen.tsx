import { useState } from 'react'
import { ArrowRight, ArrowCounterClockwise, DownloadSimple, Trash } from '@phosphor-icons/react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { exportBackup, exportTasksCsv, parseBackup, type BackupData } from '../../core/backup'

const DocumentExport = registerPlugin<{ save(options: { name: string; mimeType: string; text: string }): Promise<{ cancelled?: boolean }> }>('DocumentExport')
async function saveFile(name: string, mimeType: string, text: string): Promise<boolean> {
  if (Capacitor.getPlatform() === 'android') return !(await DocumentExport.save({ name, mimeType, text })).cancelled
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}

export function DataScreen({ data, onImport, onRestore, onBack }: {
  data: BackupData; onImport: (data: BackupData) => void; onRestore: (id: string) => void; onBack: () => void
}) {
  const [pending, setPending] = useState<BackupData | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const deleted = data.tasks.filter(t => t.deletedAt)
  const exportData = async (format: 'json' | 'csv') => {
    setBusy(true); setError(false); setMessage('')
    try {
      const saved = await saveFile(`zitar-${new Date().toISOString().slice(0, 10)}.${format}`, format === 'json' ? 'application/json' : 'text/csv', format === 'json' ? exportBackup(data) : exportTasksCsv(data.tasks))
      setMessage(saved ? 'خروجی آماده شد. فایل را در محل امن نگه دارید.' : 'ذخیرهٔ فایل لغو شد.')
    } catch { setError(true); setMessage('خروجی ذخیره نشد؛ فضای دستگاه و دسترسی فایل را بررسی کنید.') }
    finally { setBusy(false) }
  }
  const readFile = async (file?: File) => {
    if (!file) return
    setError(false); setPending(null); setMessage('')
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('اندازهٔ فایل باید کمتر از ۲۰ مگابایت باشد.')
      setPending(parseBackup(await file.text()))
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'خواندن فایل ناموفق بود.') }
  }
  return <section className="screen data-screen" dir="rtl">
    <div className="inner-header"><button className="icon-button" onClick={onBack} aria-label="بازگشت"><ArrowRight size={25}/></button><h1>مدیریت داده‌ها</h1></div>
    <section className="settings-card"><h2><DownloadSimple size={24}/> پشتیبان و خروجی</h2>
      <p className="helper">پشتیبان شامل کارها، سطل زباله، تاریخچهٔ عادت‌ها و جلسات تمرکز است. فایل رمزگذاری نشده؛ فقط در محل مورد اعتماد نگه دارید.</p>
      <div className="data-actions"><button className="primary" disabled={busy} onClick={() => void exportData('json')}>دریافت پشتیبان JSON</button><button className="ghost" disabled={busy} onClick={() => void exportData('csv')}>خروجی کارها CSV</button></div>
      <label className="import-label">بازیابی از فایل JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { void readFile(e.target.files?.[0]); e.target.value = '' }}/></label>
      {pending && <div className="restore-preview"><h3>پیش‌نمایش بازیابی</h3><p>{pending.tasks.length.toLocaleString('fa-IR')} کار · {pending.habits.length.toLocaleString('fa-IR')} عادت · {pending.focusSessions.length.toLocaleString('fa-IR')} جلسه</p><p>فقط موارد جدید اضافه می‌شوند. داده‌های فعلی و کارهای حذف‌شده بازنویسی نمی‌شوند؛ پوستهٔ فعلی حفظ می‌شود.</p><div className="data-actions"><button className="primary" onClick={() => { onImport(pending); setPending(null); setMessage('داده‌های جدید اضافه شدند؛ ذخیره روی دستگاه در حال انجام است.'); }}>تأیید افزودن داده‌ها</button><button className="ghost" onClick={() => setPending(null)}>انصراف</button></div></div>}
      {message && <p role={error ? 'alert' : 'status'}>{message}</p>}
    </section>
    <section className="settings-card"><h2><Trash size={24}/> سطل زباله <small>{deleted.length.toLocaleString('fa-IR')}</small></h2><p className="helper">حذف دائمی در این نسخه فعال نیست. کارها قابل‌بازیابی هستند.</p>
      {deleted.map(task => <div className="trash-row" key={task.id}><span>{task.title}</span><button className="ghost" onClick={() => onRestore(task.id)} aria-label={`بازیابی ${task.title}`}><ArrowCounterClockwise size={19}/> بازیابی</button></div>)}
      {!deleted.length && <p className="helper">سطل زباله خالی است.</p>}
    </section>
  </section>
}
