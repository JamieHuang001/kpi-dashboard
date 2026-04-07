import React, { useMemo } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { mapType, getCategory, TICKET_CATEGORIES } from '../../utils/calculations';

export default function MaintenanceDashboard({ displayCases }) {
    // 篩選出「保養」類別的單據
    const maintenanceCases = useMemo(() => {
        return (displayCases || []).filter(c => getCategory(mapType(c.type)) === TICKET_CATEGORIES.MAINTENANCE);
    }, [displayCases]);

    // 分析資料
    const stats = useMemo(() => {
        const total = maintenanceCases.length;
        const completed = maintenanceCases.filter(c => c.status === '完修' || c.status?.includes('完成')).length;
        const pending = total - completed;

        // 區分院內與一般(居家)
        const hospitalCases = maintenanceCases.filter(c => {
            const client = (c.client || '').toLowerCase();
            return client.includes('醫院') || client.includes('診所') || client.includes('護理') || client.includes('長照');
        });
        const homeCases = maintenanceCases.filter(c => {
            const client = (c.client || '').toLowerCase();
            return !(client.includes('醫院') || client.includes('診所') || client.includes('護理') || client.includes('長照'));
        });

        const hospCompleted = hospitalCases.filter(c => c.status === '完修').length;
        const homeCompleted = homeCases.filter(c => c.status === '完修').length;

        // 工程師負載
        const engineers = {};
        maintenanceCases.forEach(c => {
            const eng = c.engineer || '未指派';
            if (!engineers[eng]) engineers[eng] = { total: 0, completed: 0 };
            engineers[eng].total += 1;
            if (c.status === '完修' || c.status?.includes('完成')) engineers[eng].completed += 1;
        });

        // 設備機型統計
        const models = {};
        maintenanceCases.forEach(c => {
            const m = c.model || '未分類';
            models[m] = (models[m] || 0) + 1;
        });

        // 取前 5 大工程師
        const topEngineers = Object.entries(engineers)
            .map(([name, s]) => ({
                name,
                total: s.total,
                completed: s.completed,
                rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total).slice(0, 5);

        return {
            total, completed, pending,
            hospital: { total: hospitalCases.length, completed: hospCompleted },
            home: { total: homeCases.length, completed: homeCompleted },
            topEngineers,
            topModels: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 5)
        };
    }, [maintenanceCases]);

    if (!displayCases || displayCases.length === 0) {
        return <div className="p-8 text-center text-slate-500">尚無資料，請先載入工單。</div>;
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 12 } } },
        },
        cutout: '70%',
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">
                🛡️ 綜合保養管理面板
            </h2>

            {/* 核心指標 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">保養總工單</div>
                    <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.total}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-500/20 text-center">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">已完成保養</div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-5 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-500/20 text-center">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mb-1">待處理/安排中</div>
                    <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-500/20 text-center">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">整體達成率</div>
                    <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                        {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 達成率圖表 */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 text-center">保養任務達成率</h3>
                    <div className="h-[250px] relative">
                        <Doughnut
                            data={{
                                labels: ['已完修', '未完修'],
                                datasets: [{
                                    data: [stats.completed, stats.pending],
                                    backgroundColor: ['#10b981', '#cbd5e1'],
                                    borderWidth: 0
                                }]
                            }}
                            options={chartOptions}
                        />
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-3">
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* 分類狀況 */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6">保養客戶類型分佈</h3>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span className="text-blue-600 dark:text-blue-400">🏥 院內保養 ({stats.hospital.total} 件)</span>
                                <span className="text-slate-500">{stats.hospital.completed} 完成</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full transition-all" 
                                    style={{ width: `${stats.hospital.total > 0 ? (stats.hospital.completed / stats.hospital.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span className="text-emerald-600 dark:text-emerald-400">🏠 居家保養 ({stats.home.total} 件)</span>
                                <span className="text-slate-500">{stats.home.completed} 完成</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all" 
                                    style={{ width: `${stats.home.total > 0 ? (stats.home.completed / stats.home.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 下方兩欄：工程師與熱門機型 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">👷 負責工程師負載 (Top 5)</h3>
                    <div className="space-y-3">
                        {stats.topEngineers.map(eng => (
                            <div key={eng.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="font-semibold text-sm dark:text-slate-200">{eng.name}</div>
                                <div className="flex items-center gap-3">
                                    <div className="text-xs text-slate-500">進度: <span className="text-slate-800 dark:text-slate-100 font-bold">{eng.completed}/{eng.total}</span></div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${eng.rate === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                        {eng.rate}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">📱 熱門保養機型</h3>
                    <div className="flex flex-wrap gap-2">
                        {stats.topModels.map(([model, count], idx) => (
                            <div key={model} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                                <span className="text-sm font-semibold dark:text-slate-200">{model}</span>
                                <span className="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 rounded-full">{count} 件</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
