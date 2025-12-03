"use client";

import { createContext, useContext, ReactNode } from "react";
import { Plan } from "@/lib/planLimits";

const PlanContext = createContext<Plan | null>(null);

export function PlanProvider({ 
  children, 
  plan 
}: { 
  children: ReactNode;
  plan: Plan;
}) {
  return (
    <PlanContext.Provider value={plan}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): Plan {
  const plan = useContext(PlanContext);
  if (!plan) {
    return "free_demo"; // Default fallback
  }
  return plan;
}

