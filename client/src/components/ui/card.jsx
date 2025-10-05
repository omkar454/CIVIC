// src/components/ui/card.jsx
import React from "react";
import clsx from "clsx";

export function Card({ children, className, ...props }) {
  return (
    <div
      className={clsx(
        "bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={clsx("space-y-4", className)} {...props}>
      {children}
    </div>
  );
}
