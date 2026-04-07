import { useDataLoader } from "./useDataLoader";
import { useDashboardState } from "./useDashboardState";
import { useKpiCalculations } from "./useKpiCalculations";

export function useKpiData() {
  const dashboardState = useDashboardState();

  const dataLoader = useDataLoader({
    setDateRange: dashboardState.setDateRange,
  });

  const calculations = useKpiCalculations({
    allCases: dataLoader.allCases,
    dateRange: dashboardState.dateRange,
    points: dashboardState.points,
    selectedCategory: dashboardState.selectedCategory,
    drillDownLabel: dashboardState.drillDownLabel,
    granularity: dashboardState.granularity,
    anomalyThresholds: dashboardState.anomalyThresholds,
  });

  return {
    // DataLoader
    ...dataLoader,
    // DashboardState
    ...dashboardState,
    // Calculations
    ...calculations,
    // Dummy recalculate for backward compatibility with App.jsx
    recalculate: () => {},
  };
}
