import { describe, it, expect, vi } from 'vitest';
import { detectSectorAnomalies } from './anomalyDetector';

describe('anomalyDetector.js - Anomaly Detector Tests', () => {
    // 建立模擬的 customThresholds，確保測試的獨立性不受環境設定影響
    const mockThresholds = {
        sectorVolume: { minPctIncrease: 50, minAbsDelta: 10 },
        repeatSN: { minPerSN: 2, minGroups: 1 },
        modelSurge: { minCount: 5, minPct: 50 },
        slaNearMiss: { remainDays: 1, minCount: 2 }
    };

    const dateRange = { start: '2026-04-01', end: '2026-04-30' };

    it('正常情況：無任何異常時應該回傳空陣列', () => {
        const currentCases = [
            { type: '一般維修', client: 'A診所', model: 'M-1', sn: 'SN01', tat: 1 },
            { type: '一般維修', client: 'B診所', model: 'M-2', sn: 'SN02', tat: 2 }
        ];
        const previousCases = [
            { type: '一般維修', client: 'C診所', model: 'M-3', sn: 'SN03', tat: 1 }
        ];
        const result = detectSectorAnomalies(currentCases, previousCases, dateRange, mockThresholds);
        expect(result).toEqual([]);
    });

    it('應該正確觸發「板塊案量突增 (sectorVolume surge)」', () => {
        // 造出當期有 12 筆維修，上期只有 1 筆維修 (增加 1100%, +11) -> 觸發
        const currentCases = Array.from({ length: 12 }).map((_, i) => ({
            type: '一般維修', client: 'A', model: 'M-1', tat: 1
        }));
        const previousCases = [
            { type: '一般維修', client: 'A', model: 'M-1', tat: 1 }
        ];

        const result = detectSectorAnomalies(currentCases, previousCases, dateRange, mockThresholds);
        
        const surgeAnomaly = result.find(a => a.type === 'sectorVolume');
        expect(surgeAnomaly).toBeDefined();
        expect(surgeAnomaly.severity).toBe('warning');
        expect(surgeAnomaly.title).toContain('案量突增');
    });

    it('應該正確觸發「同序號重複進場 / 返修率過高 (repeatSN recall)」', () => {
        // 造出同 SN 出現 2 次，觸發 repeatSN
        const currentCases = [
            { type: '一般維修', client: 'A', model: 'M-1', sn: 'ERR-SN99', tat: 1 },
            { type: '困難維修', client: 'A', model: 'M-1', sn: 'ERR-SN99', tat: 1 }
        ];
        const previousCases = [];

        const result = detectSectorAnomalies(currentCases, previousCases, dateRange, mockThresholds);
        
        const recallAnomaly = result.find(a => a.type === 'repeatSN');
        expect(recallAnomaly).toBeDefined();
        expect(recallAnomaly.severity).toBe('warning');
        expect(recallAnomaly.description).toContain('ERR-SN99(2次)');
    });

    it('邊界條件：傳入 null 或空陣列', () => {
        expect(detectSectorAnomalies(null, null, dateRange, mockThresholds)).toEqual([]);
        expect(detectSectorAnomalies([], [], dateRange, mockThresholds)).toEqual([]);
    });

    it('邊界條件：當期案量很大，但上期為空陣列 (沒有歷史資料)', () => {
         const currentCases = Array.from({ length: 15 }).map(() => ({
             type: '一般維修', client: 'A', model: 'M-1', tat: 1
         }));
         const previousCases = [];
         
         const result = detectSectorAnomalies(currentCases, previousCases, dateRange, mockThresholds);
         // prevSectorCounts 若為空就不會檢查 volumeSurge (因為無法比對上期)
         const surgeAnomaly = result.find(a => a.type === 'sectorVolume');
         expect(surgeAnomaly).toBeUndefined();
    });
});
