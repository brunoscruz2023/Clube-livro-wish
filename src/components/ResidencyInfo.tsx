import React from 'react';
import { cn } from '../lib/utils';
import { MapPin, Home } from 'lucide-react';

interface ResidencyInfoProps {
  apartmentNumber?: string;
  apartmentBlock?: string;
  residencyNote?: string;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
}

export function ResidencyInfo({ 
  apartmentNumber, 
  apartmentBlock, 
  residencyNote,
  className, 
  iconClassName,
  showIcon = true 
}: ResidencyInfoProps) {
  if (!apartmentNumber && !residencyNote) {
    return <span className={cn("text-slate-400 italic", className)}>Residência não informada</span>;
  }

  const fullInfo = apartmentNumber 
    ? (apartmentBlock ? `Apto ${apartmentNumber} • ${apartmentBlock}` : `Apto ${apartmentNumber}`)
    : residencyNote;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {showIcon && (
        apartmentBlock 
          ? <MapPin className={cn("h-3.5 w-3.5", iconClassName)} /> 
          : <Home className={cn("h-3.5 w-3.5", iconClassName)} />
      )}
      <span>{fullInfo}</span>
    </div>
  );
}
