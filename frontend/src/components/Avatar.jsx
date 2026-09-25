import { initials } from '../lib/user'

// Avatar con iniciales, en la tinta de las superficies
export function Avatar({ user, size = 'size-8 text-xs' }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-700 font-semibold text-zinc-50 ring-1 ring-zinc-600 ${size}`}>
      {initials(user)}
    </span>
  )
}
