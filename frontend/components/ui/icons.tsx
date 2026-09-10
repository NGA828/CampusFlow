import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function makeIcon(path: React.ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };
}

export const IconGrid = makeIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);

export const IconCalendar = makeIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);

export const IconMap = makeIcon(
  <>
    <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z" />
    <path d="M9 7v13M15 4v13" />
  </>,
);

export const IconCompass = makeIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
  </>,
);

export const IconQueue = makeIcon(
  <>
    <path d="M3 6h13M3 12h13M3 18h9" />
    <circle cx="19" cy="18" r="2" />
  </>,
);

export const IconBell = makeIcon(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>,
);

export const IconSparkle = makeIcon(
  <>
    <path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.3L12 3Z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
  </>,
);

export const IconUser = makeIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </>,
);

export const IconSearch = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);

export const IconLogout = makeIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </>,
);

export const IconMenu = makeIcon(
  <>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </>,
);

export const IconX = makeIcon(
  <>
    <path d="M18 6 6 18M6 6l12 12" />
  </>,
);

export const IconClock = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const IconChevronRight = makeIcon(<path d="m9 18 6-6-6-6" />);

export const IconChevronLeft = makeIcon(<path d="m15 18-6-6 6-6" />);

export const IconBuilding = makeIcon(
  <>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
  </>,
);

export const IconQr = makeIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z" />
  </>,
);

export const IconArrowRight = makeIcon(
  <>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </>,
);

export const IconPin = makeIcon(
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>,
);

export const IconUsers = makeIcon(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21 20c0-2.6-1.6-4.1-4-4.7" />
  </>,
);
