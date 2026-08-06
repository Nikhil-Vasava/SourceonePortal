// Line icons, 1.6px stroke on a 24px grid — consistent weight throughout the app.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
};

const Svg = ({ children, size = 18, className = "", ...rest }) => (
  <svg {...base} width={size} height={size} className={className} aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
  <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);

export const IconPurchase = (p) => (
  <Svg {...p}><path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2Z" />
  <path d="M9 9h6M9 13h4" /></Svg>
);

export const IconShip = (p) => (
  <Svg {...p}><path d="M3 18c1.6 0 1.6 1.5 3.2 1.5S7.8 18 9.4 18s1.6 1.5 3.2 1.5S14.2 18 15.8 18s1.6 1.5 3.2 1.5S20.6 18 22 18" />
  <path d="M4.5 14.5 12 12l7.5 2.5-1.2 3.2H5.7z" /><path d="M12 12V6" /><path d="M8.5 8.5h7" /></Svg>
);

export const IconFactory = (p) => (
  <Svg {...p}><path d="M3 20V10l5 3V10l5 3V7l6 3.5V20z" /><path d="M7 16h2M13 16h2M17 16h1" /></Svg>
);

export const IconHandshake = (p) => (
  <Svg {...p}><path d="m11 17 1.5 1.5a1.6 1.6 0 0 0 2.3-2.3" />
  <path d="m13 14 2.5 2.5a1.6 1.6 0 0 0 2.3-2.3l-4.6-4.6" />
  <path d="M3 9.5 6.5 6a2 2 0 0 1 2.6-.2L12 8l-2.8 2.4a1.7 1.7 0 0 0 2.2 2.5L14 11" />
  <path d="M21 9.5 17.5 6" /></Svg>
);

export const IconBook = (p) => (
  <Svg {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z" />
  <path d="M5 17h14" /><path d="M9 7h6" /><path d="M9 11h4" /></Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" />
  <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M17.5 14.2A5.6 5.6 0 0 1 21 20" /></Svg>
);

export const IconUpload = (p) => (
  <Svg {...p}><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
  <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></Svg>
);

// The upload arrow, flipped — same tray, arrow pointing into it.
export const IconDownload = (p) => (
  <Svg {...p}><path d="M12 4v12" /><path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
  <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></Svg>
);

export const IconPlus = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);

export const IconDoc = (p) => (
  <Svg {...p}><path d="M14 3v5h5" /><path d="M19 8v11.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H14z" />
  <path d="M8.5 13h7M8.5 17h4" /></Svg>
);

export const IconPencil = (p) => (
  <Svg {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5 17 10" /></Svg>
);

export const IconCheck = (p) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>);
export const IconX = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const IconArrowRight = (p) => (<Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
export const IconSearch = (p) => (<Svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.5-4.5" /></Svg>);
export const IconLogout = (p) => (
  <Svg {...p}><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
  <path d="M10 8 6 12l4 4" /><path d="M6 12h9" /></Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}><path d="M12 4.5 21 19H3z" /><path d="M12 10v4" /><path d="M12 16.5h.01" /></Svg>
);
export const IconInbox = (p) => (
  <Svg {...p}><path d="M4 13h4l1.5 3h5L16 13h4" />
  <path d="M5.6 5h12.8l1.6 8v5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18v-5z" /></Svg>
);
export const IconBox = (p) => (
  <Svg {...p}><path d="M12 3 4 7v10l8 4 8-4V7z" /><path d="m4 7 8 4 8-4" /><path d="M12 11v10" /></Svg>
);
export const IconClock = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></Svg>);
export const IconWeight = (p) => (
  <Svg {...p}><path d="M6.5 8h11l2 12H4.5z" /><circle cx="12" cy="5" r="2" /></Svg>
);

export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Svg>
);

export const IconTrash = (p) => (
  <Svg {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>
);
