import { Building2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCollege, listColleges } from '../api/admin.js'
import { errorMessage } from '../api/errors.js'
import {
  Badge,
  Button,
  Card,
  CodeChip,
  Drawer,
  EmptyState,
  ErrorAlert,
  OneTimeSecret,
  PageHeader,
  SelectField,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  Td,
  TextField,
  Th,
  THead,
  Tr,
  useToast,
} from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { splitList } from '../utils/lists.js'

const EMPTY = { name: '', code: '', emailDomains: '', branches: '', studentVerification: 'email_domain' }

export default function AdminCollegesPage() {
  usePageTitle('Colleges')
  const navigate = useNavigate()
  const [colleges, setColleges] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    let active = true
    listColleges()
      .then((list) => {
        if (!active) return
        setColleges(list)
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load colleges.')))
    return () => {
      active = false
    }
  }, [reloadKey])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colleges"
        description="Each college is an isolated tenant. You manage colleges and TPO heads; you cannot open cases or evidence."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Onboard a college
          </Button>
        }
      />

      {created && <OneTimeSecret label={`Student join code for ${created.college.name}`} value={created.studentJoinCode} onDismiss={() => setCreated(null)} />}

      <Card padded={false}>
        <div className="p-5 empty:hidden">
          <ErrorAlert message={loadError} />
          {colleges === null && !loadError && <Skeleton rows={3} label="Loading colleges" />}
          {colleges?.length === 0 && <EmptyState icon={Building2} title="No colleges yet." />}
        </div>
        {colleges?.length > 0 && (
          <Table label="All colleges">
            <THead>
              <tr>
                <Th>College</Th>
                <Th>Email domains</Th>
                <Th>Verification</Th>
                <Th>Staff</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {colleges.map((college) => (
                <Tr key={college.id} onActivate={() => navigate(`/admin/colleges/${college.id}`)}>
                  <Td className="min-w-56">
                    <Link to={`/admin/colleges/${college.id}`} className="font-medium text-slate-900 hover:text-accent-800 hover:underline">
                      {college.name}
                    </Link>
                    <div className="font-mono text-xs text-slate-500">{college.code}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {college.emailDomains.map((domain) => (
                        <CodeChip key={domain}>{domain}</CodeChip>
                      ))}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {college.studentVerification === 'manual_approval' ? 'Manual approval' : 'Email domain'}
                    {college.isDemo && (
                      <Badge tone="warning" size="sm" className="ml-2">
                        Demo
                      </Badge>
                    )}
                  </Td>
                  <Td className="tabular-nums text-slate-600">{college.staffCount}</Td>
                  <Td>
                    <StatusBadge status={college.status} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {creating && (
        <CreateCollegeDrawer
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false)
            setCreated(result)
            setReloadKey((key) => key + 1)
          }}
        />
      )}
    </div>
  )
}

function CreateCollegeDrawer({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const details = { name: form.name, code: form.code, emailDomains: splitList(form.emailDomains), studentVerification: form.studentVerification }
      const branches = splitList(form.branches)
      if (branches.length > 0) details.branches = branches
      const result = await createCollege(details)
      toast.success(`${result.college.name} was created.`)
      onCreated(result)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Drawer title="Onboard a college" description="The student join code is shown once after creation." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField label="College name" required value={form.name} onChange={update('name')} />
        <TextField label="College code" required hint="Lowercase slug, 3–20 characters, e.g. vjti-mumbai." value={form.code} onChange={update('code')} />
        <TextField label="Email domains" required hint="Comma-separated, e.g. college.edu" value={form.emailDomains} onChange={update('emailDomains')} />
        <TextField label="Branches (optional)" hint="Comma-separated; defaults to COMP, IT, EXTC, MECH, CIVIL, AIDS." value={form.branches} onChange={update('branches')} />
        <SelectField
          label="Student verification"
          hint="Email domains are still required: staff accounts always use a college address."
          value={form.studentVerification}
          onChange={update('studentVerification')}
        >
          <option value="email_domain">College email domain (students self-register)</option>
          <option value="manual_approval">Manual approval (any email; staff approve each student)</option>
        </SelectField>
        <ErrorAlert message={error} />
        <div className="flex gap-3">
          <Button type="submit" icon={Plus} loading={submitting}>
            {submitting ? 'Creating…' : 'Create college'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
