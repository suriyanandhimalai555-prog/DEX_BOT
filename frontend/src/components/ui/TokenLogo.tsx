import { useState } from 'react';
import { cn } from '../../lib/utils';

interface TokenLogoProps {
  token: {
    symbol: string;
    logoUrl?: string | null;
    address?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };

function colorFromAddress(seed: string): string {
  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
  let idx: number;
  if (seed.startsWith('0x') && seed.length >= 4) {
    idx = parseInt(seed.slice(2, 4), 16) % colors.length;
  } else {
    idx = [...seed].reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length;
  }
  return colors[idx] ?? colors[0];
}

export function TokenLogo({ token, size = 'md', className }: TokenLogoProps): JSX.Element {
  const sizeClass = sizes[size];
  const key = token.address ?? token.symbol;
  const [imgOk, setImgOk] = useState(Boolean(token.logoUrl));
  const letter = (token.symbol || '?').slice(0, 1).toUpperCase();
  const bg = colorFromAddress(key);

  if (imgOk && token.logoUrl) {
    return (
      <img
        src={token.logoUrl}
        alt=""
        className={cn(sizeClass, 'shrink-0 rounded-full object-cover', className)}
        onError={() => setImgOk(false)}
      />
    );
  }

  return (
    <div
      className={cn(sizeClass, 'flex shrink-0 items-center justify-center rounded-full font-bold text-white', className)}
      style={{ backgroundColor: bg }}
    >
      {letter}
    </div>
  );
}
