function BaseIcon({ children, className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CartIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h3l2.5 12h11.5l2-8h-14" />
    </BaseIcon>
  );
}

export function UserIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </BaseIcon>
  );
}

export function MapPinIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </BaseIcon>
  );
}

export function SearchIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </BaseIcon>
  );
}

export function TruckIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 6h10v9H3z" />
      <path d="M13 9h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </BaseIcon>
  );
}

export function StoreIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 10h18" />
      <path d="M5 10V6l2-2h10l2 2v4" />
      <path d="M6 10v10h12V10" />
    </BaseIcon>
  );
}

export function HeadsetIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 12a8 8 0 1 1 16 0" />
      <path d="M4 12v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z" />
      <path d="M20 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
    </BaseIcon>
  );
}

export function SparkIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="m12 2 2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2z" />
    </BaseIcon>
  );
}

export function ChevronDownIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function ChevronRightIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="m9 18 6-6-6-6" />
    </BaseIcon>
  );
}

export function ShieldIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 3 5 6v6c0 5 3.5 7.5 7 9 3.5-1.5 7-4 7-9V6z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </BaseIcon>
  );
}

export function LogOutIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
    </BaseIcon>
  );
}

export function EyeIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </BaseIcon>
  );
}

export function PencilIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </BaseIcon>
  );
}

export function EyeOffIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.2A11.6 11.6 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-4.2 4.9" />
      <path d="M6.2 6.3A18.7 18.7 0 0 0 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" />
    </BaseIcon>
  );
}

export function CloseIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </BaseIcon>
  );
}

export function ChartBarIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-12" />
    </BaseIcon>
  );
}

export function ClipboardListIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M9 4h6" />
      <path d="M9 2h6v4H9z" />
      <path d="M6 6h12v16H6z" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </BaseIcon>
  );
}

export function PackageIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="M3 7v10l9 5 9-5V7" />
      <path d="M12 12v10" />
    </BaseIcon>
  );
}

export function UsersGroupIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </BaseIcon>
  );
}

export function DollarIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 2v20" />
      <path d="M17 6.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" />
    </BaseIcon>
  );
}

export function MegaphoneIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 7a7 7 0 0 1 0 10" />
    </BaseIcon>
  );
}

export function CogIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.8 1 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </BaseIcon>
  );
}

export function BackIcon({ className }) {
  return (
    <svg
      className={className ?? "h-3.5 w-3.5"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M15 18 9 12 15 6" />
    </svg>
  );
}

export function CalendarIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </BaseIcon>
  );
}

export function FilterIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 7h16" />
      <path d="M6 11h12" />
      <path d="M8 15h8" />
    </BaseIcon>
  );
}

export function DatabaseIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </BaseIcon>
  );
}

export function SaveIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </BaseIcon>
  );
}

export function LoaderIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </BaseIcon>
  );
}

export function CheckCircleIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </BaseIcon>
  );
}

export function AlertTriangleIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </BaseIcon>
  );
}

export function HistoryIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </BaseIcon>
  );
}

export function RestoreIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </BaseIcon>
  );
}


// ... después de RestoreIcon ...

export function DownloadIcon({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </BaseIcon>
  );
}

export function TrendingUp({ className }) {
  return (
    <BaseIcon className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </BaseIcon>
  );
}

export function TrendingDown({ className }) {
  return (
    <BaseIcon className={className}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </BaseIcon>
  );
}

export function Minus({ className }) {
  return (
    <BaseIcon className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </BaseIcon>
  );
}
