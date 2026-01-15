import React from 'react';

// Modern SUP paddle + wave logo
export const Logo = ({ className = "", size = "default" }) => {
  const sizes = {
    small: { svg: "h-8 w-8", text: "text-lg" },
    default: { svg: "h-10 w-10", text: "text-xl" },
    large: { svg: "h-14 w-14", text: "text-2xl" }
  };

  const s = sizes[size] || sizes.default;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${s.svg} relative`}>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="paddleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>

          {/* Background circle with gradient */}
          <circle cx="24" cy="24" r="22" fill="url(#waveGradient)" opacity="0.15" />

          {/* Wave shape */}
          <path
            d="M4 28c4-4 8 0 12-4s8 0 12-4 8 0 12-4"
            stroke="url(#waveGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M4 34c4-4 8 0 12-4s8 0 12-4 8 0 12-4"
            stroke="url(#waveGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />

          {/* SUP paddle */}
          <ellipse cx="24" cy="12" rx="4" ry="6" fill="url(#paddleGradient)" />
          <rect x="23" y="16" width="2" height="20" rx="1" fill="url(#paddleGradient)" />

          {/* Sparkle accent */}
          <circle cx="38" cy="10" r="2" fill="#fbbf24" />
          <circle cx="10" cy="16" r="1.5" fill="#fbbf24" opacity="0.7" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={`${s.text} font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent`}>
          SUP Weather
        </span>
        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium -mt-0.5">
          Paddle Planner
        </span>
      </div>
    </div>
  );
};

// Compact logo for mobile
export const LogoCompact = ({ className = "" }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="h-8 w-8">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="waveGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="paddleGradientCompact" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#waveGradientCompact)" opacity="0.15" />
        <path d="M4 28c4-4 8 0 12-4s8 0 12-4 8 0 12-4" stroke="url(#waveGradientCompact)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M4 34c4-4 8 0 12-4s8 0 12-4 8 0 12-4" stroke="url(#waveGradientCompact)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <ellipse cx="24" cy="12" rx="4" ry="6" fill="url(#paddleGradientCompact)" />
        <rect x="23" y="16" width="2" height="20" rx="1" fill="url(#paddleGradientCompact)" />
      </svg>
    </div>
    <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
      SUP
    </span>
  </div>
);

export default Logo;
