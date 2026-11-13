import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Dialog, Tabs, TextAreaField } from '../components/ui/index.js'

const LONG_TEXT = 'Student brought the full chat log, with the UPI demand and a look-alike domain.'

/** Opens a Dialog from a trigger; the parent keeps re-rendering (new inline onClose each time). */
function DialogHarness({ onClosed = () => {} }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 25)
    return () => clearInterval(timer)
  }, [])
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {open && (
        <Dialog
          title="Reason needed"
          onClose={() => {
            setOpen(false)
            onClosed()
          }}
          footer={<Button onClick={() => setOpen(false)}>Done</Button>}
        >
          <TextAreaField label="Reason" value={text} onChange={(event) => setText(event.target.value)} />
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('b1. focuses the first text field once and keeps focus while typing 40+ characters', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))

    const field = screen.getByLabelText('Reason')
    expect(field).toHaveFocus()
    await user.type(field, LONG_TEXT)

    expect(field).toHaveValue(LONG_TEXT)
    expect(field).toHaveFocus()
  })

  it('b2. traps Tab inside the dialog in both directions', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    const dialog = screen.getByRole('dialog', { name: 'Reason needed' })

    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('b3. Escape closes it and focus returns to the trigger', async () => {
    const onClosed = vi.fn()
    const user = userEvent.setup()
    render(<DialogHarness onClosed={onClosed} />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('Tabs', () => {
  function TabsHarness() {
    const [value, setValue] = useState('open')
    return (
      <Tabs
        label="Case status"
        value={value}
        onChange={setValue}
        tabs={[
          { value: 'open', label: 'Open', count: 4 },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ]}
      />
    )
  }

  it('e. arrow keys, Home and End move the selection and focus; only the selected tab is tabbable', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const open = screen.getByRole('tab', { name: 'Open (4)' })
    expect(open).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Closed' })).toHaveAttribute('tabindex', '-1')

    open.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Closed' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Closed' })).toHaveFocus()

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Open (4)' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Open (4)' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('tabindex', '0')
  })
})
