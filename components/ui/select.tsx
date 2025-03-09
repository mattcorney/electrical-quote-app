import React from "react";

interface SelectProps {
  id?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}

export function Select({ id, value, onChange, children }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange} // ✅ Fix: Now properly updates state
      className="border border-gray-300 px-2 py-1 rounded-md w-full"
    >
      {children}
    </select>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function SelectItem({ value, children }: SelectItemProps) {
  return <option value={value}>{children}</option>;
}
