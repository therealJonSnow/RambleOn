import { useEffect, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react'

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// A textarea that grows with its content, styled to look like the typed page.
export function AutoTextarea({
  ref,
  className = '',
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement>; value: string }) {
  const inner = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => fit(inner.current), [value])

  // Wrapping also changes when the typewriter font finishes loading or the
  // width changes (rotation, window resize), so measure again then.
  useEffect(() => {
    const el = inner.current
    if (!el) return
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth
        fit(el)
      }
    })
    observer.observe(el)
    void document.fonts?.ready.then(() => fit(el))
    return () => observer.disconnect()
  }, [])

  return (
    <textarea
      ref={(el) => {
        inner.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      rows={1}
      value={value}
      className={`typed-field ${className}`}
      {...props}
    />
  )
}
