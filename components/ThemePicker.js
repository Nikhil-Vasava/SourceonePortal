"use client";

// The three-option control on the Account page.
//
// No Save button. Theme is the rare setting where the preview IS the result —
// picking one applies it instantly, and if it's wrong you can see that it's
// wrong and pick another. A Save step would only add a way to lose the change.

import { useTheme } from "@/lib/use-theme";
import { THEMES, THEME_LABELS, THEME_NOTES } from "@/lib/theme";
import { IconSun, IconMoon, IconMonitor, IconCheck } from "@/components/icons";

const ICONS = { system: IconMonitor, light: IconSun, dark: IconMoon };

export default function ThemePicker({ initial }) {
  const { choice, resolved, change } = useTheme(initial);

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {THEMES.map(id => {
          const Icon = ICONS[id];
          const active = choice === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => change(id)}
              aria-pressed={active}
              className={[
                "card-interactive flex flex-col gap-1.5 rounded-xl border p-3 text-left",
                active
                  ? "border-brand-300 bg-brand-50"
                  : "border-ink-200 bg-glass hover:border-ink-200",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} className={active ? "text-brand-700" : "text-ink-400"} />
                <span className={`text-sm font-semibold ${active ? "text-brand-700" : "text-ink-800"}`}>
                  {THEME_LABELS[id]}
                </span>
                {active && <IconCheck size={14} className="ml-auto text-brand-700" />}
              </div>
              <span className="text-2xs leading-relaxed text-ink-400">{THEME_NOTES[id]}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-2xs text-ink-400">
        {choice === "system"
          ? `Currently showing ${resolved}, because that's what this computer is set to.`
          : "Saved in this browser. Signing in on another computer starts from your system setting again."}
      </p>
    </div>
  );
}
