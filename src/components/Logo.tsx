import React, { useState, useEffect } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'serif' | 'brand-serif';
  showTagline?: boolean;
  className?: string;
  iconOnly?: boolean;
  customLogoUrl?: string;
}

const getResolvedLogoUrl = (customUrl?: string): string => {
  if (customUrl) return customUrl;
  try {
    const saved = localStorage.getItem('wits_lingo_site_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.logoUrl) {
        const v = parsed.logoVersion ? `?v=${parsed.logoVersion}` : '';
        return parsed.logoUrl.includes('?') ? parsed.logoUrl : `${parsed.logoUrl}${v}`;
      }
    }
  } catch {}
  return '/logo.svg';
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'dark', 
  showTagline = false,
  className = '',
  iconOnly = false,
  customLogoUrl
}) => {
  const isLight = variant === 'light';

  const [currentLogo, setCurrentLogo] = useState<string>(() => getResolvedLogoUrl(customLogoUrl));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (customLogoUrl) {
      setCurrentLogo(customLogoUrl);
      setImgError(false);
      return;
    }

    const handleLogoUpdate = (e: any) => {
      setImgError(false);
      if (e?.detail) {
        const url = typeof e.detail === 'string' ? e.detail : e.detail.logoUrl;
        if (url) {
          const v = e.detail?.logoVersion ? `?v=${e.detail.logoVersion}` : `?v=${Date.now()}`;
          setCurrentLogo(url.includes('?') ? url : `${url}${v}`);
          return;
        }
      }
      setCurrentLogo(getResolvedLogoUrl());
    };

    window.addEventListener('wits_lingo_logo_updated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);
    return () => {
      window.removeEventListener('wits_lingo_logo_updated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, [customLogoUrl]);

  const iconSizes = {
    sm: 'w-8 h-8 sm:w-9 sm:h-9',
    md: 'w-9.5 h-9.5 sm:w-10.5 sm:h-10.5',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
  };

  const textSizes = {
    sm: 'text-[15px] sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl',
  };

  const taglineSizes = {
    sm: 'text-[8px] min-[360px]:text-[9px] min-[390px]:text-[9.5px] sm:text-[11px]',
    md: 'text-[10px] sm:text-[11px]',
    lg: 'text-xs sm:text-sm',
  };

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none min-w-0 ${className}`}>
      {/* Official Wits Circular Mascot Logo Emblem */}
      <div
        className={`${iconSizes[size]} rounded-full flex items-center justify-center relative overflow-hidden group shrink-0 transition-transform duration-200 hover:scale-105`}
      >
        <img
          src={imgError ? '/logo.svg' : currentLogo}
          alt="Wits Lingo Logo"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain rounded-full shadow-md shadow-purple-950/20"
          referrerPolicy="no-referrer"
        />
      </div>

      {!iconOnly && (
        <div className="flex flex-col min-w-0 justify-center">
          {variant === 'serif' || variant === 'brand-serif' ? (
            <span className="text-xl sm:text-2xl font-bold font-['Playfair_Display',Georgia,serif] tracking-tight text-[#1E123B] leading-none">
              Wits Lingo
            </span>
          ) : (
            <div className="flex items-center gap-1.5 leading-none">
              <span
                className={`${textSizes[size]} font-extrabold tracking-tight font-['Outfit'] uppercase ${
                  isLight ? 'text-white' : 'text-[#1E1B26]'
                }`}
              >
                WITS <span className={isLight ? 'text-purple-300' : 'text-[#581C87]'}>LINGO</span>
              </span>
            </div>
          )}
          {showTagline && variant !== 'serif' && variant !== 'brand-serif' && (
            <span
              className={`${taglineSizes[size]} font-medium tracking-tight sm:tracking-wide mt-0.5 whitespace-nowrap leading-tight ${
                isLight ? 'text-purple-200/90' : 'text-slate-500'
              }`}
            >
              A Global Language Platform
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
