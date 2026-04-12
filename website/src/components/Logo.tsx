import React from "react";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  locale?: string;
}

export default function Logo({
  size = 36,
  withWordmark = true,
  className = "",
  locale = "en",
}: LogoProps) {
  const wordmark = locale === "ar" ? "إجنيفاى" : "Ignify";
  const gradId = `ignify-grad-${size}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-xl brand-gradient-bg"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path
            d="M12 2c.8 3.2 3.2 4.8 3.2 7.6 0 1.4-.8 2.6-2.2 2.6-1 0-1.6-.6-1.6-1.4 0-.6.2-1 .2-1.6 0-.8-.6-1.2-1.2-1.2-1.4 0-3.4 2-3.4 5C7 16.4 9.4 19 12 19c3 0 5.4-2.2 5.4-5.6 0-3.8-2.6-7-5.4-11.4z"
            fill={`url(#${gradId})`}
          />
        </svg>
      </span>
      {withWordmark && (
        <span
          className="text-xl font-bold brand-gradient-text"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          {wordmark}
        </span>
      )}
    </span>
  );
}
