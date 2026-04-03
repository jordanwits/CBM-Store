'use client';

import React, { forwardRef } from 'react';
import {
  formatPhoneFieldDisplay,
  stripPhoneDigits,
  PHONE_INPUT_MAX_DIGITS,
} from '../lib/phone-format';

export interface PhoneInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'className' | 'onChange' | 'value' | 'defaultValue' | 'type'
  > {
  label?: string;
  error?: string;
  className?: string;
  /** Digits only (0–11), e.g. 15551234567 or 5551234567 */
  digits: string;
  onDigitsChange: (digits: string) => void;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { label, error, className = '', id, disabled, digits, onDigitsChange, onKeyDown, ...rest },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const display = formatPhoneFieldDisplay(digits);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = stripPhoneDigits(e.target.value).slice(0, PHONE_INPUT_MAX_DIGITS);
    onDigitsChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const nav = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (nav.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...rest}
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="(555) 123-4567"
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
          disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
          placeholder:text-gray-600
          ${error ? 'border-red-500' : 'border-gray-400'}
          ${className}
        `}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});
