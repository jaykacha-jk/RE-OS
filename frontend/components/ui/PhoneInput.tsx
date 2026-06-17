'use client';

import { useId, useState } from 'react';

import {
  DIAL_CODES,
  DEFAULT_DIAL_CODE,
  PHONE_FORMAT_MESSAGE,
  fromE164,
  isValidIndianMobile,
  parseNationalDigits,
  toE164,
} from '../../lib/phone';

type PhoneInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function PhoneInput({
  id: idProp,
  name,
  value,
  onChange,
  required,
  disabled,
  className = 'input',
  placeholder = '9876543210',
}: PhoneInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const { dialCode, national } = fromE164(value);
  const [touched, setTouched] = useState(false);

  const invalid = touched && national.length > 0 && !isValidIndianMobile(national);
  const showError = invalid || (touched && required && national.length === 0);

  function onNationalChange(raw: string) {
    const next = parseNationalDigits(raw, dialCode);
    onChange(toE164(next, dialCode));
  }

  function onDialChange(nextDial: string) {
    onChange(toE164(national, nextDial));
  }

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={dialCode}
          disabled={disabled || DIAL_CODES.length === 1}
          onChange={(e) => onDialChange(e.target.value)}
          onBlur={() => setTouched(true)}
          className={`${className} w-[7.5rem] shrink-0`}
        >
          {DIAL_CODES.map(({ code, label }) => (
            <option key={code} value={code}>
              {DIAL_CODES.length === 1 ? code : label}
            </option>
          ))}
        </select>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          pattern={national ? '[6-9][0-9]{9}' : undefined}
          maxLength={10}
          className={`${className} min-w-0 flex-1`}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : undefined}
        />
      </div>
      {showError ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600">
          {PHONE_FORMAT_MESSAGE}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">
          10-digit mobile starting with 6–9 ({DEFAULT_DIAL_CODE} added automatically).
        </p>
      )}
    </div>
  );
}
