import { describe, it, expect } from 'vitest';
import { 
    getWorkingDays, 
    calculateEngineerScore, 
    mapType 
} from './calculations';

describe('calculations.js - Business Logic Tests', () => {

    describe('getWorkingDays()', () => {
        it('應該正確計算一般日期的工作天 (排除週末)', () => {
            const start = new Date('2026-04-06'); // 週一 (國定假日清單中有，但如果我們不傳自訂，預設用 config)
            const end = new Date('2026-04-10');   // 週五
            
            // 測試無假日的正常情況
            const days = getWorkingDays(new Date('2026-04-13'), new Date('2026-04-17'), [], []);
            expect(days).toBe(5);
        });

        it('應該跨週末正確計算', () => {
            // 2026-04-10 (五) 到 2026-04-13 (一)
            const days = getWorkingDays('2026-04-10', '2026-04-13', [], []);
            expect(days).toBe(2); // 五、一
        });

        it('應該正確扣除國定假日', () => {
            // 2026-04-02(三) 到 2026-04-06(日)
            const holidays = ['2026-04-03', '2026-04-06']; 
            const days = getWorkingDays('2026-04-02', '2026-04-06', holidays, []);
            expect(days).toBe(1); // 只有 04-02 (四)，04-03是假日，04-04/05週末，04-06假日(雖是週末但已排除)
        });

        it('應該正確將補班日算作工作天', () => {
            // 2026-02-27 (五) 到 2026-03-01 (日)
            // 假設 02-28(六) 是補班日
            const makeUpDays = ['2026-02-28'];
            const days = getWorkingDays('2026-02-27', '2026-03-01', [], makeUpDays);
            expect(days).toBe(2); // 27日(五)，28日(六/補班)
        });

        it('邊界條件：開始日期大於結束日期', () => {
            const days = getWorkingDays('2026-05-10', '2026-05-01');
            expect(days).toBe(0);
        });

        it('邊界條件：傳入無效日期', () => {
            const days = getWorkingDays('invalid', 'date');
            expect(days).toBe(0);
        });
    });

    describe('calculateEngineerScore()', () => {
        // weights: tat(30%), achv(30%), rwo(20%), coop(20%)
        // tatScores: <=3=100, <=4=90, <=5=80, else 60
        // rwoScores: <=0=100, <=2=90, else 60

        it('全完美情況：TAT <= 3 (100), achv=100, rwo=0 (100), coop=100', () => {
            const score = calculateEngineerScore(2.5, 100, 0, 100);
            const expected = (100*0.3) + (100*0.3) + (100*0.2) + (100*0.2); // 100
            expect(score).toBe(expected);
        });

        it('部分扣分情況：TAT 4.5 (80), achv=85, rwo=1 (90), coop=80', () => {
            const score = calculateEngineerScore(4.5, 85, 1, 80);
            const expected = (80*0.3) + (85*0.3) + (90*0.2) + (80*0.2); // 24 + 25.5 + 18 + 16 = 83.5
            expect(score).toBe(83.5);
        });

        it('邊界條件：輸入極端大/小數值', () => {
            // 達成率上限 100
            const score = calculateEngineerScore(50, 150, 50, 150);
            // TAT=50 (60分), Achv=150->100分, RWO=50->60分, Coop=150
            const expected = (60*0.3) + (100*0.3) + (60*0.2) + (150*0.2); // 18 + 30 + 12 + 30 = 90
            expect(score).toBe(90);
        });

        it('邊界條件：null 傳遞', () => {
            const score = calculateEngineerScore(null, null, null, null);
            // TAT=0 (100), achv=0, rwo=0 (100), coop=0
            const expected = (100 * 0.3) + (0) + (100 * 0.2) + 0; // 50
            expect(score).toBe(50);
        });
    });

    describe('mapType()', () => {
        it('應該能正確映射常規類型', () => {
            expect(mapType('這是睡眠中心設備')).toBe('睡眠中心');
            expect(mapType('設備檢測與更換')).toBe('簡易檢測');
            expect(mapType('醫院設備安裝協助')).toBe('醫院安裝');
        });

        it('應該回傳防呆預設陣列 (無匹配字串)', () => {
            expect(mapType('這是一個完全不相干的需求')).toBe('其他預設');
        });

        it('邊界條件：傳入 null/undefined/空字串', () => {
            expect(mapType(null)).toBe('其他預設');
            expect(mapType(undefined)).toBe('其他預設');
            expect(mapType('')).toBe('其他預設');
        });
    });
});
