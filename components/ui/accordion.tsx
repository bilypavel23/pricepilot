"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

interface AccordionItemProps {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}

const AccordionContext = React.createContext<{
  openItems: Set<string>;
  toggleItem: (id: string) => void;
}>({
  openItems: new Set(),
  toggleItem: () => {},
});

export function Accordion({ children, className }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set());

  const toggleItem = React.useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ question, answer, defaultOpen = false }: AccordionItemProps) {
  const { openItems, toggleItem } = React.useContext(AccordionContext);
  const id = React.useMemo(() => `item-${question}`, [question]);
  const isOpen = openItems.has(id) || defaultOpen;

  React.useEffect(() => {
    if (defaultOpen) {
      toggleItem(id);
    }
  }, []);

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/50 overflow-hidden">
      <button
        onClick={() => toggleItem(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-900/70 transition-colors"
      >
        <span className="font-medium text-white pr-4">{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-slate-400 flex-shrink-0 transition-transform",
            isOpen && "transform rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-slate-400">{answer}</div>
      )}
    </div>
  );
}

