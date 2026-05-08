import * as React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="border border-dashed border-dg-border rounded-lg p-6 text-center text-sm"
    >
      <h3 className="font-semibold mb-1">{title}</h3>
      {description && <p className="text-gray-400 mb-3">{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  retry?: () => void;
}

export function ErrorState({ message, retry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border border-dg-bad/40 bg-dg-bad/10 text-dg-bad rounded-lg p-4 text-sm"
    >
      <p>{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-2 underline focus-visible:outline focus-visible:outline-2"
        >
          retry
        </button>
      )}
    </div>
  );
}
