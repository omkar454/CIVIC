// src/components/ui/button.jsx
import React from "react";
import clsx from "clsx";

export function Button({
  children,
  className,
  size = "md",
  variant = "default",
  ...props
}) {
  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-gray-400 text-gray-800 hover:bg-gray-100",
  };

  return (
    <button
      className={clsx(
        "rounded shadow transition duration-200",
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
