"use client";

// The one-click switch in the sidebar.
//
// It cycles System → Light → Dark → System rather than flipping between two
// states, because "system" is a real choice here and a two-way toggle would
// silently throw it away the first time anyone touched the button.
//
// The icon shows what you'd GET, not what you're on — a sun means "click for
// light". The label underneath says where you are now, so nothing has to be
// guessed from an icon alone.

import { useTheme } from "@/lib/use-theme";
import { THEMES, THEME_LABELS } from "@/lib/theme";
import { IconSun, IconMoon, IconMonitor } from "@/components/icons";

const ICONS = { system: IconMonitor, light: IconSun, dark: IconMoon };

export default function ThemeToggle({ initial, compact = false }) {
  const { choice, resolved, change } = useTheme(initial);

  const next = THEMES[(THEMES.indexOf(choice) + 1) % THEMES.length];
  const Icon = ICONS[choice];

  // "Match my system" is long; in the rail it's clearer as the word plus what
  // it currently works out to.
  const label = choice === "system" ? `System · ${resolved}` : THEME_LABELS[choice];

  if (compact) {
    return (
      <button
        onClick={() => change(next)}
        className="icon-btn"
        title={`Theme: ${label}. Switch to ${THEME_LABELS[next]}.`}
        aria-label={`Theme: ${label}. Switch to ${THEME_LABELS[next]}.`}
      >
        <Icon size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={() => change(next)}
      className="nav-link w-full"
      title={`Switch to ${THEME_LABELS[next]}`}
      aria-label={`Theme: ${label}. Switch to ${THEME_LABELS[next]}.`}
    >
      <Icon size={17} className="text-ink-400" />
      <span className="capitalize">{label}</span>
    </button>
  );
}
