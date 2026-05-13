import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'

const styles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  error:   'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info:    'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
}

export function Badge({
  variant = 'neutral',
  className,
  children,
}: {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', styles[variant], className)}>
      {children}
    </span>
  )
}
