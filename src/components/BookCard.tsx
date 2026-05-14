import React from 'react';
import { Book as BookIcon } from 'lucide-react';
import { Book } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface BookCardProps {
  book: Book;
  badge?: React.ReactNode;
  categoryBadge?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  key?: React.Key;
}

export function BookCard({ 
  book, 
  badge, 
  categoryBadge, 
  metadata, 
  actions, 
  className,
  onClick 
}: BookCardProps) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-100/50 transition-all hover:shadow-2xl hover:shadow-indigo-100/40",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="aspect-[3/4] w-full bg-slate-100 overflow-hidden relative">
        {/* Actual Cover or Placeholder */}
        {book.coverUrl ? (
          <img 
            src={book.coverUrl} 
            alt={book.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform duration-500">
            <BookIcon className="h-16 w-16 sm:h-20 sm:w-20 opacity-20" />
          </div>
        )}
        
        {/* Badges Slot */}
        {badge && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
            {badge}
          </div>
        )}

        {/* Category Badge Slot */}
        {categoryBadge || (book.category && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <span className="rounded-full bg-slate-900/60 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-[9px] sm:text-[10px] uppercase tracking-wider text-white font-bold">
              {Array.isArray(book.category) ? book.category[0] : book.category}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <h3 className="text-sm sm:text-base md:text-lg font-bold leading-tight text-slate-900 line-clamp-2">{book.title}</h3>
        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-medium text-slate-500 truncate">
          {Array.isArray(book.author) ? book.author.join(', ') : book.author}
        </p>
        
        {/* Metadata Slot */}
        {metadata && (
          <div className="mt-3 sm:mt-4 flex flex-col gap-1.5 sm:gap-2">
            {metadata}
          </div>
        )}

        {/* Actions Slot */}
        {actions && (
          <div className="mt-auto pt-4 sm:pt-6 flex gap-1.5 sm:gap-2">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}
