"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

import { filterCaseInsensitiveValues } from "@/lib/people-classifications";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface AutocompleteInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyMessage?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  emptyMessage = "No matching options",
  className,
  ...props
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(
    () => filterCaseInsensitiveValues(options, value),
    [options, value]
  );

  const showDropdown = isOpen && (filteredOptions.length > 0 || value.trim().length > 0);

  return (
    <div className="relative">
      <Input
        {...props}
        className={className}
        value={value}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onBlur={(event) => {
          props.onBlur?.(event);
          window.setTimeout(() => setIsOpen(false), 100);
        }}
      />

      {showDropdown ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  "flex w-full rounded px-2.5 py-2 text-left text-sm hover:bg-accent",
                  option.toLocaleLowerCase() === value.trim().toLocaleLowerCase()
                    ? "bg-accent/70"
                    : undefined
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
