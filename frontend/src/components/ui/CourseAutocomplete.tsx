import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterCourses, findCanonicalCourseName } from "@/data/ufrgsCourses";

interface CourseAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
}

export const CourseAutocomplete: React.FC<CourseAutocompleteProps> = ({
  value,
  onChange,
  error,
  required = false,
  label = "Curso",
  placeholder = "Ex.: Ciência da Computação",
  hint,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const matches = useMemo(() => {
    return filterCourses(value).slice(0, 20);
  }, [value]);

  const totalOptions = matches.length + 1;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectCourse = (course: string) => {
    onChange(course);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleSelectOther = () => {
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleInputBlur = () => {
    const canonical = findCanonicalCourseName(value);
    if (canonical && canonical !== value) {
      onChange(canonical);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        if (activeIndex < matches.length) {
          handleSelectCourse(matches[activeIndex]);
        } else {
          handleSelectOther();
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label
          className="text-xs font-semibold uppercase tracking-wider text-text-muted"
          htmlFor={inputId}
        >
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          className={`w-full rounded-md border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none transition-colors duration-150 ${
            error
              ? "border-danger focus:ring-1 focus:ring-danger/30"
              : "border-border focus:border-primary focus:ring-1 focus:ring-primary/30"
          }`}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <ul
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-60 m-0 max-h-55 list-none overflow-y-auto rounded-md border border-border-strong bg-surface py-1 shadow-lg"
          role="listbox"
        >
          {matches.map((course, idx) => {
            const isSelected = course.toLowerCase() === value.trim().toLowerCase();
            const isActive = idx === activeIndex;
            return (
              <li
                key={course}
                role="option"
                aria-selected={isSelected}
                className={`flex cursor-pointer items-center justify-between px-3.5 py-2 text-sm transition-colors duration-100 hover:bg-surface-hover ${
                  isActive ? "bg-surface-hover" : ""
                } ${isSelected ? "font-semibold text-accent-text" : "text-text"}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectCourse(course);
                }}
              >
                <span>{course}</span>
                {isSelected && <span className="font-mono text-xs text-accent-text">✓</span>}
              </li>
            );
          })}

          {matches.length === 0 && (
            <li className="px-3.5 py-2.5 text-center text-xs text-text-muted">
              Curso não encontrado na lista.
            </li>
          )}

          <li
            role="option"
            aria-selected={activeIndex === matches.length}
            className={`mt-1 flex cursor-pointer items-center justify-between border-t border-border px-3.5 py-2 text-xs font-semibold text-accent-text transition-colors duration-100 hover:bg-surface-hover ${
              activeIndex === matches.length ? "bg-surface-hover" : ""
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectOther();
            }}
          >
            <span>Outro (digitar manualmente)</span>
          </li>
        </ul>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
};
