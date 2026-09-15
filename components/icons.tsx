// Minimal, dependency-free line icons (no icon library needed for six glyphs).
type P = { className?: string };

export const IconList = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="4.5" cy="6" r="1.4" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1.4" fill="currentColor" />
    <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconCalendar = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconBolt = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M13 3 5 13.5h6L10.5 21 19 9.5h-6.3L13 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export const IconUsers = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 20c.6-3.6 3-5.6 5.5-5.6s4.9 2 5.5 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15.5 14.7c2-.3 4 1.3 4.7 3.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconCalc = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7.5 7.5h9M7.5 12h.01M12 12h.01M16.5 12h.01M7.5 16h.01M12 16h.01M16.5 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconGear = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="m5 12.5 4.5 4.5L19.5 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRoute = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="5" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="19" cy="18" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7 7.5c0 4 3 3 5 5s3 4 5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2.4 2.4" />
  </svg>
);

export const IconTrendingDown = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 6.5 10 12l3.5-3.5L20 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 15h5v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconAlertCircle = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="16.3" r="0.9" fill="currentColor" />
  </svg>
);

export const IconDownload = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 3.5v11.5M8 11.5 12 16l4-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 17v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IconChevronDown = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6 9.5 12 15l6-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBriefcase = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M3.5 12.5h17" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const IconCloudSync = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M7 17.5a4 4 0 0 1-.5-7.97 5 5 0 0 1 9.66-1.7A4.5 4.5 0 0 1 17 17.5H7Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M10 13.2 12 11l2 2.2M12 11v5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconMail = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4.5 7 12 12.5 19.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSearch = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="m19.5 19.5-4.3-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconFileText = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6.5 3.5h8l4 4v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M14 3.5V8h4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8.5 12.5h7M8.5 15.8h7M8.5 9.2h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IconX = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconCopy = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconExternalLink = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M9.5 6.5h-3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.5 4.5h6v6M19 5l-8.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSpark = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 3.5c.5 3 2 4.5 5 5-3 .5-4.5 2-5 5-.5-3-2-4.5-5-5 3-.5 4.5-2 5-5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M18.5 15c.3 1.6 1.1 2.4 2.5 2.7-1.4.3-2.2 1.1-2.5 2.7-.3-1.6-1.1-2.4-2.5-2.7 1.4-.3 2.2-1.1 2.5-2.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);
