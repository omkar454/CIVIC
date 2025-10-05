// src/components/ui/badge.jsx
import React from "react";
import clsx from "clsx";

export function Badge({ children, className, size = "sm", ...props }) {
  const sizes = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={clsx(
        "inline-block rounded-full font-semibold",
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
