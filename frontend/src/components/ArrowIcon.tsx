// Arrow that points toward the reading direction: right in LTR, left in RTL.
// Mirrors itself with the rtl: variant, so callers never think about direction.
export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden
      className={`shrink-0 rtl:-scale-x-100 ${className}`}
    >
      <path d="M5 14h18M16 7l7 7-7 7" />
    </svg>
  );
}
