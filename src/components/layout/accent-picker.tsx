"use client";

import { useAccent, ACCENT_OPTIONS } from "@/providers/accent-provider";
import { Check } from "lucide-react";
import { motion } from "motion/react";

export function AccentPicker() {
  const { accent, setAccent } = useAccent();

  return (
    <div className="flex flex-wrap gap-3">
      {ACCENT_OPTIONS.map((option) => {
        const isActive = accent === option.id;
        return (
          <button
            key={option.id}
            onClick={() => setAccent(option.id)}
            className="group flex flex-col items-center gap-1.5"
            aria-label={option.label}
          >
            <div className="relative">
              <motion.div
                className="h-10 w-10 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: option.preview,
                  borderColor: isActive ? option.preview : "transparent",
                  boxShadow: isActive ? `0 0 0 3px oklch(from ${option.preview} l c h / 25%)` : "none",
                }}
                whileTap={{ scale: 0.9 }}
              />
              {isActive && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Check className="h-4 w-4 text-white drop-shadow-md" />
                </motion.div>
              )}
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
