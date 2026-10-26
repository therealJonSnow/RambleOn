import { useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react'

// A textarea that grows with its content, styled to look like the typed page.
export function AutoTextarea({
  ref,
  className = '',
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement>; value: string }) {
  const inner = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

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
