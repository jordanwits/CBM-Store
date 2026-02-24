'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Optional wrapper class. Default "w-full". Use "flex-shrink-0" for inline layouts. */
  wrapperClassName?: string;
  id?: string;
}

export function Select({
  label,
  error,
  options,
  value = '',
  onChange,
  disabled = false,
  placeholder,
  className = '',
  wrapperClassName = 'w-full',
  id,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label ?? placeholder;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent, index?: number) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    if (e.key === 'Enter' && index !== undefined) {
      onChange?.(options[index].value);
      setIsOpen(false);
    }
  };

  const baseClasses = [
    'w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
    'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500',
    'cursor-pointer text-left flex items-center justify-between gap-2',
    error ? 'border-red-500' : 'border-gray-400',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <button
        type="button"
        id={selectId}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        className={baseClasses}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label ? `${selectId}-label` : undefined}
      >
        <span className={!displayValue ? 'text-gray-500' : ''}>
          {displayValue || placeholder || 'Select...'}
        </span>
        <svg
          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[160px] max-h-[50vh] overflow-y-auto rounded-md border border-gray-400 bg-white py-1 shadow-lg"
          role="listbox"
          onKeyDown={(e) => handleKeyDown(e)}
        >
          {options.map((opt, index) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange?.(opt.value);
                setIsOpen(false);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                w-full px-3 py-2 text-left text-sm text-gray-900
                hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
                ${opt.value === value ? 'bg-primary/10 font-medium' : ''}
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
