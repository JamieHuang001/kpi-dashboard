import { useState, useCallback } from "react";
import { parseCSVFile, processCSVText } from "../utils/dataParser";
import {
  fetchRepairRecordsCSV,
  fetchAssetInventoryCSV,
  parseAssetCSV,
} from "../utils/googleSheetsLoader";

export function useDataLoader({ setDateRange }) {
  const [allCases, setAllCases] = useState([]);
  const [assetData, setAssetData] = useState([]);
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [encoding, setEncoding] = useState("UTF-8");

  const updateDateRangeFromCases = useCallback(
    (cases) => {
      const validDates = cases
        .map((c) => c.date)
        .filter((d) => d)
        .sort((a, b) => a - b);
      if (validDates.length > 0) {
        const last = validDates[validDates.length - 1];
        const y = last.getFullYear();
        const m = String(last.getMonth() + 1).padStart(2, "0");
        const d = String(last.getDate()).padStart(2, "0");
        setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${d}` });
      }
    },
    [setDateRange],
  );

  const loadFile = useCallback(
    async (file) => {
      try {
        setStatus("載入中...");
        const cases = await parseCSVFile(file, encoding);
        setAllCases(cases);
        updateDateRangeFromCases(cases);
        setStatus(`✅ 成功讀取 ${cases.length} 筆工單`);
        setIsLoaded(true);
      } catch (err) {
        setStatus(`❌ ${err.message}`);
      }
    },
    [encoding, updateDateRangeFromCases],
  );

  const loadFromGoogleSheets = useCallback(async () => {
    try {
      setIsGoogleLoading(true);
      setStatus("☁️ 正在從 Google Sheets 下載維修紀錄...");
      const csvText = await fetchRepairRecordsCSV();
      const cases = processCSVText(csvText);
      setAllCases(cases);
      updateDateRangeFromCases(cases);
      setStatus(`✅ Google Sheets 成功讀取 ${cases.length} 筆工單`);
      setIsLoaded(true);
    } catch (err) {
      setStatus(`❌ Google Sheets 下載失敗：${err.message}`);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [updateDateRangeFromCases]);

  const loadAssetSheet = useCallback(async () => {
    try {
      setAssetStatus("☁️ 正在下載財產總表...");
      const csvText = await fetchAssetInventoryCSV();
      const assets = parseAssetCSV(csvText);
      setAssetData(assets);
      setAssetStatus(`✅ 成功讀取 ${assets.length} 筆財產資料`);
    } catch (err) {
      setAssetStatus(`❌ 財產總表下載失敗：${err.message}`);
    }
  }, []);

  return {
    allCases,
    setAllCases,
    assetData,
    setAssetData,
    status,
    setStatus,
    isLoaded,
    setIsLoaded,
    isGoogleLoading,
    setIsGoogleLoading,
    assetStatus,
    setAssetStatus,
    encoding,
    setEncoding,
    loadFile,
    loadFromGoogleSheets,
    loadAssetSheet,
  };
}
