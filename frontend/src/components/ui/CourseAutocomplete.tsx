import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterCourses, findCanonicalCourseName } from "@/data/ufrgsCourses";
import styles from "./CourseAutocomplete.module.css";

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
  placeholder = "Digite para buscar seu curso (ex: Ciência da Computação)",
  hint = "Selecione na lista ou escolha 'Outro' para digitar manualmente",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Filter courses based on current query
  const matches = useMemo(() => {
    return filterCourses(value).slice(0, 20);
  }, [value]);

  // Total selectable items = matches + 1 ("Outro" option)
  const totalOptions = matches.length + 1;

  // Close dropdown on outside click
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
    // If the entered value canonical-matches an official course (case/accent insensitive),
    // normalize it to the official capitalized form
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
    <div className={styles.wrapper} ref={containerRef}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label} {required && <span className={styles.req}>*</span>}
        </label>
      )}

      <div className={[styles.inputWrap, error ? styles.hasError : ""].join(" ")}>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          className={styles.input}
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
        <ul className={styles.dropdown} role="listbox">
          {matches.map((course, idx) => {
            const isSelected = course.toLowerCase() === value.trim().toLowerCase();
            const isActive = idx === activeIndex;
            return (
              <li
                key={course}
                role="option"
                aria-selected={isSelected}
                className={[
                  styles.item,
                  isActive ? styles.itemActive : "",
                  isSelected ? styles.itemSelected : "",
                ].join(" ")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectCourse(course);
                }}
              >
                <span>{course}</span>
                {isSelected && <span>✓</span>}
              </li>
            );
          })}

          {matches.length === 0 && (
            <li className={styles.empty}>
              Nenhum curso oficial encontrado com esse nome.
            </li>
          )}

          <li
            role="option"
            aria-selected={activeIndex === matches.length}
            className={[
              styles.item,
              styles.otherItem,
              activeIndex === matches.length ? styles.itemActive : "",
            ].join(" ")}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectOther();
            }}
          >
            <span>Outro (digite seu curso)</span>
          </li>
        </ul>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
};
