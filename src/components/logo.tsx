export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Folded paper effect */}
      <path
        d="M8 4h12l6 6v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="currentColor"
        className="text-primary"
      />
      <path
        d="M20 4v6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground"
      />
      {/* P letter */}
      <path
        d="M12 14h4a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-4v-4z"
        fill="currentColor"
        className="text-primary-foreground"
      />
      <path
        d="M12 14v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-primary-foreground"
      />
    </svg>
  );
}

export function LogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className="relative inline-flex">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl blur-sm" />
      <div className="relative bg-gradient-to-br from-primary to-primary/90 rounded-xl p-1.5 shadow-lg shadow-primary/25">
        <Logo className={className} />
      </div>
    </div>
  );
}
