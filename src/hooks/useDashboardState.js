import { useState, useCallback } from "react";
import { STORAGE_KEYS } from "../config/storageKeys";
import { loadThresholds, saveThresholds } from "../utils/anomalyConfig";
import { DEFAULT_POINTS, KpiConfig } from "../utils/calculations";

export function useDashboardState() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [points, setPoints] = useState({ ...DEFAULT_POINTS });
  const [targetPoints, setTargetPoints] = useState(
    KpiConfig.defaultTargetPoints,
  );
  const [drillDownLabel, setDrillDownLabel] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [granularity, setGranularity] = useState("month");

  // 異常趨勢 — 已讀管理
  const [dismissedAnomalies, setDismissedAnomalies] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DISMISSED_ANOMALIES);
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {
      /* ignore */
    }
    return new Set();
  });
  const [anomalyThresholds, setAnomalyThresholds] = useState(() =>
    loadThresholds(),
  );

  const applyDrillDown = useCallback((label) => {
    setDrillDownLabel(label);
  }, []);

  const clearDrillDown = useCallback(() => {
    setDrillDownLabel(null);
    setSelectedCategory(null);
  }, []);

  const dismissAnomaly = useCallback((anomalyId) => {
    setDismissedAnomalies((prev) => {
      const next = new Set(prev);
      next.add(anomalyId);
      try {
        localStorage.setItem(
          STORAGE_KEYS.DISMISSED_ANOMALIES,
          JSON.stringify([...next]),
        );
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetDismissed = useCallback(() => {
    setDismissedAnomalies(new Set());
    try {
      localStorage.removeItem(STORAGE_KEYS.DISMISSED_ANOMALIES);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const updateAnomalyThresholds = useCallback((newThresholds) => {
    setAnomalyThresholds(newThresholds);
    saveThresholds(newThresholds); // Save when updating
  }, []);

  return {
    dateRange,
    setDateRange,
    points,
    setPoints,
    targetPoints,
    setTargetPoints,
    drillDownLabel,
    setDrillDownLabel,
    granularity,
    setGranularity,
    selectedCategory,
    setSelectedCategory,
    dismissedAnomalies,
    dismissAnomaly,
    resetDismissed,
    anomalyThresholds,
    updateAnomalyThresholds,
    applyDrillDown,
    clearDrillDown,
  };
}
