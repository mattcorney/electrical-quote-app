import * as React from "react";

export function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="font-semibold text-gray-700" {...props}>
      {children}
    </label>
  );
}
