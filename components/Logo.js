// The horizontal lockup, in whichever version suits the current theme.
//
// Both files are in the markup and CSS hides one (see .logo-for-* in
// globals.css). That keeps this a plain server component with no state, and
// means the correct logo is present in the first paint rather than swapped in
// afterwards — a reversed logo flashing on every page load is exactly the kind
// of small wrongness that makes an app feel unfinished.

export default function Logo({ width = 158, className = "" }) {
  const common = {
    alt: "Source One Ventures",
    width,
    height: Math.round((width / 158) * 56),
    className: `h-auto ${className}`,
    style: { width },
  };
  return (
    <>
      <img {...common} src="/logo-horizontal-dark.svg" className={`${common.className} logo-for-dark`} />
      <img {...common} src="/logo-horizontal.svg" className={`${common.className} logo-for-light`} />
    </>
  );
}
