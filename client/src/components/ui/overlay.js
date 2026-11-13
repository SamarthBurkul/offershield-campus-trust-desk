import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const TEXT_FIELD = 'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"])'

// Open overlays, innermost last: only the top one reacts to Escape and traps Tab.
const stack = []
let savedOverflow = ''

const focusablesIn = (node) => [...node.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[inert]') && el.getAttribute('aria-hidden') !== 'true')

/**
 * Modal behaviour for dialogs and drawers, mounted only while open:
 * - on open, focus the first text field (or `fallbackRef`, or the first focusable) ONCE — never again on
 *   re-render, so typing in a field is never interrupted (Phase 7 fix);
 * - Tab / Shift+Tab stay inside the overlay;
 * - Escape calls the latest `onClose` (read through a ref, so an inline handler is fine);
 * - on close, focus returns to the element that had it when the overlay opened.
 */
export function useModalBehaviour(containerRef, { onClose, fallbackRef } = {}) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const container = containerRef.current
    const trigger = document.activeElement
    const token = {}
    stack.push(token)

    const field = container?.querySelector(TEXT_FIELD)
    const target = field ?? fallbackRef?.current ?? (container ? focusablesIn(container)[0] : null)
    ;(target ?? container)?.focus()

    function onKey(event) {
      if (stack[stack.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const items = focusablesIn(container)
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    if (stack.length === 1) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(token), 1)
      if (stack.length === 0) document.body.style.overflow = savedOverflow
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) trigger.focus()
    }
    // Runs once per opening by design (the refs are stable).
  }, [containerRef, fallbackRef])
}
