import { initials } from '../lib/user'

// Avatar con iniciales sobre el degradado de marca
export function Avatar({ user, size = 'size-8 text-xs' }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand to-brand-2 font-semibold text-white shadow-md shadow-brand/30 ring-2 ring-surface ${size}`}>
      {initials(user)}
    </span>
  )
}
