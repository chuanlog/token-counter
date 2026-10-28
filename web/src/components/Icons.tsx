import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function iconProps({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function LensMark({ size = 28, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      {...props}
    >
      <circle cx="16" cy="16" r="9.2" stroke="#3987e5" strokeWidth="2" />
      <circle cx="16" cy="16" r="4.4" stroke="#d95926" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="1.7" fill="currentColor" />
      <path
        d="M16 2.5v5M16 24.5v5M2.5 16h5M24.5 16h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.9" />
      <path d="M20.5 3.8v4.8h-4.8" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.7v5.4M12 7.7v.2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m4.8 12.2 4.7 4.7 9.7-9.8" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function ArrowDownRightIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 7l10 10M17 8v9H8" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M9.5 9.5v10M15.5 9.5v10" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 19V5M4 19h16" />
      <path d="M7.5 15.5V12M12 15.5V8.5M16.5 15.5v-5" />
    </svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
      <path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </svg>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="6" y="6" width="12" height="12" rx="2.2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 9.5v4.7M12 17.2v.2" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.3" />
      <path d="m7.2 9 3 3-3 3M12.5 15.2h4.2" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 12h4l2.2-5.5 4.2 11 2.3-5.5H21" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m12 3.5 8.5 4.7L12 12.9 3.5 8.2 12 3.5Z" />
      <path d="m4 12 8 4.5 8-4.5M4 15.8l8 4.5 8-4.5" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 15.5 19.2 18l2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.5Z" />
    </svg>
  );
}
