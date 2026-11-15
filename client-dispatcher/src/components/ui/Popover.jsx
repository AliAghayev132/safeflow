import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

/**
 * Anchored popover rendered in a portal (never clipped by cards, tables or
 * map panes). Closes on outside click and Esc; re-positions on scroll/resize
 * and flips above the anchor when there is no room below.
 *
 *   <Popover open={open} onClose={…} anchorRef={buttonRef} width={320}>…</Popover>
 */
export const Popover = ({ open, onClose, anchorRef, width = 320, align = 'start', className, children, label }) => {
  const panel = useRef(null)
  const [pos, setPos] = useState(null)

  const place = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const w = Math.min(width, window.innerWidth - 16)
    const left = Math.min(Math.max(8, align === 'end' ? r.right - w : r.left), window.innerWidth - w - 8)
    const below = window.innerHeight - r.bottom
    const up = below < 320 && r.top > below
    setPos({
      left,
      width: w,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.max(200, (up ? r.top : below) - 16),
    })
  }, [anchorRef, width, align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        anchorRef.current?.focus()
      }
    }
    const onScroll = (e) => {
      if (!panel.current?.contains(e.target)) place()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, onClose, anchorRef, place])

  if (!open || !pos) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className={clsx(
        'fixed z-[2000] flex flex-col overflow-hidden rounded-xl border border-border-strong bg-panel shadow-[0_12px_32px_rgba(0,0,0,0.45)] animate-[popIn_120ms_ease-out]',
        className,
      )}
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  )
}
