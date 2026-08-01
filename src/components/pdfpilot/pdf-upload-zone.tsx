"use client";

import {
  type DragEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/utils";

const subscribeToHydration = () => () => {};

interface PdfUploadZoneProps {
  children: (isDragging: boolean) => ReactNode;
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  inputId?: string;
  /**
   * Native `accept` list. Defaults to PDF so existing tools are unaffected;
   * the document converters pass Word/PowerPoint types.
   */
  accept?: string;
  /** Accessible name for the file input. */
  label?: string;
}

/**
 * Shared native file-picker and drag/drop boundary for every PDF tool.
 * Selection is handed to the caller synchronously; expensive PDF parsing must
 * happen after the caller has already reflected the selected file in the UI.
 */
export function PdfUploadZone({
  children,
  onFilesSelected,
  multiple = false,
  disabled = false,
  className,
  inputId,
  accept = "application/pdf,.pdf",
  label,
}: PdfUploadZoneProps) {
  const generatedId = useId();
  const id = inputId || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const inactive = disabled || !isHydrated;

  function emit(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length) onFilesSelected(multiple ? selected : selected.slice(0, 1));
    // Let users choose the same file again after a validation failure/reset.
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (!inactive) emit(event.dataTransfer.files);
  }

  return (
    <label
      htmlFor={id}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!inactive) setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      className={cn(
        "block cursor-pointer",
        inactive && "pointer-events-none opacity-60",
        className
      )}
    >
      {children(isDragging)}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        aria-label={label}
        multiple={multiple}
        disabled={inactive}
        className="sr-only"
        onChange={(event) => emit(event.currentTarget.files || [])}
      />
    </label>
  );
}
