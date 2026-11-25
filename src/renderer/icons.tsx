import type { ReactElement, ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function CalendarIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" />
    </Svg>
  )
}

export function PencilIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 20h4l11-11-4-4L4 16v4z" />
      <path d="M13 7l4 4" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </Svg>
  )
}

export function PauseIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9.5v5M14 9.5v5" />
    </Svg>
  )
}

export function PlayIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5z" />
    </Svg>
  )
}

export function ExitIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M10 7V5H6v14h4v-2" />
      <path d="M10 12h8M15 9l3 3-3 3" />
    </Svg>
  )
}
