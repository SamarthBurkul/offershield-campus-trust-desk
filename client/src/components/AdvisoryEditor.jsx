import { useEffect, useState } from 'react'
import { getAudienceCount } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import { listIndicators } from '../api/registry.js'
import AdvisoryCard from './AdvisoryCard.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import IndicatorPicker from './IndicatorPicker.jsx'
import TargetPicker from './TargetPicker.jsx'
import { Button, Card, ErrorAlert, SelectField, TextAreaField, TextField } from './ui.jsx'

const EMPTY = { title: '', body: '', severity: 'warning', target: { years: [], branches: [] }, indicatorIds: [], sourceCaseId: null }

function problemsOf(form) {
  const problems = []
  if (form.title.trim().length < 5) problems.push('Title must be at least 5 characters.')
  if (form.body.trim().length < 20) problems.push('Message must be at least 20 characters.')
  return problems
}

/**
 * Draft (officers and head) and publish (head only) an advisory. `onSave(body)` resolves to the saved
 * advisory; `onPublish(id)` publishes it. Both throw on failure.
 */
export default function AdvisoryEditor({ initial = {}, isHead, branches = [], onSave, onPublish }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, target: { ...EMPTY.target, ...(initial.target ?? {}) } })
  const [indicators, setIndicators] = useState(null)
  const [audience, setAudience] = useState(null)
  const [savedId, setSavedId] = useState(initial.id ?? null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const problems = problemsOf(form)
  const targetKey = `${form.target.years.join(',')}|${form.target.branches.join(',')}`

  useEffect(() => {
    let active = true
    listIndicators({ status: 'active', limit: 100 })
      .then((data) => active && setIndicators(data.indicators))
      .catch(() => active && setIndicators([]))
    return () => {
      active = false
    }
  }, [])

  // Live audience count (debounced).
  useEffect(() => {
    let active = true
    const [years, branchList] = targetKey.split('|').map((part) => part.split(',').filter(Boolean))
    const timer = setTimeout(() => {
      getAudienceCount({ years: years.map(Number), branches: branchList })
        .then((count) => active && setAudience(count))
        .catch(() => active && setAudience(null))
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [targetKey])

  const body = () => ({
    title: form.title.trim(),
    body: form.body.trim(),
    severity: form.severity,
    target: form.target,
    indicatorIds: form.indicatorIds,
    ...(form.sourceCaseId ? { sourceCaseId: form.sourceCaseId } : {}),
  })

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await onSave(body(), savedId)
      setSavedId(saved.id)
      setNotice('Draft saved.')
      return saved
    } catch (err) {
      setError(errorMessage(err, err.message))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function startPublish() {
    const saved = await save()
    if (saved) setConfirming(true)
  }

  async function confirmPublish() {
    setBusy(true)
    setError('')
    try {
      await onPublish(savedId)
    } catch (err) {
      setError(errorMessage(err, err.message))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  const previewIndicators = (indicators ?? []).filter((item) => form.indicatorIds.includes(item.id))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title="Advisory">
        <form onSubmit={(event) => event.preventDefault()} className="space-y-4" noValidate aria-label="Advisory editor">
          <TextField label="Title" value={form.title} onChange={(event) => set({ title: event.target.value })} hint="5–120 characters." />
          <TextAreaField label="Message to students" rows={7} value={form.body} onChange={(event) => set({ body: event.target.value })} hint="20–3000 characters. Never name the student who reported it." />
          <SelectField label="Severity" value={form.severity} onChange={(event) => set({ severity: event.target.value })}>
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </SelectField>
          <TargetPicker value={form.target} branches={branches} onChange={(target) => set({ target })} />
          <p className="text-sm text-slate-700" aria-live="polite">
            Audience: <strong>{audience == null ? '…' : `${audience} student${audience === 1 ? '' : 's'}`}</strong>
          </p>
          <IndicatorPicker indicators={indicators} selected={form.indicatorIds} onChange={(indicatorIds) => set({ indicatorIds })} />
          {problems.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-800" aria-label="Missing before saving">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          <ErrorAlert message={error} />
          {notice && <p className="text-sm text-emerald-700">{notice}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" disabled={busy || problems.length > 0} onClick={save}>
              Save draft
            </Button>
            {isHead && (
              <Button disabled={busy || problems.length > 0} onClick={startPublish}>
                Publish…
              </Button>
            )}
          </div>
          {!isHead && <p className="text-xs text-slate-500">Your TPO head reviews and publishes advisories.</p>}
        </form>
      </Card>

      <Card title="Preview as student">
        <AdvisoryCard advisory={{ title: form.title || 'Advisory title', body: form.body || 'Advisory message…', severity: form.severity, indicators: previewIndicators }} />
      </Card>

      {confirming && (
        <ConfirmDialog title="Publish this advisory?" confirmLabel="Publish" busy={busy} onConfirm={confirmPublish} onCancel={() => setConfirming(false)}>
          <p>
            It will be sent to <strong>{audience ?? 0} student{audience === 1 ? '' : 's'}</strong> as an in-app notification.
          </p>
          <p>Published advisories cannot be edited. To correct one, withdraw it and publish a new one.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
