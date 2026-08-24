import React from 'react';

/** Calls handler when a pointer press lands outside the referenced element. */
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void,
  isActive = true
) {
  React.useEffect(() => {
    if (!isActive) return;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOutside();
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onOutside, isActive]);
}
