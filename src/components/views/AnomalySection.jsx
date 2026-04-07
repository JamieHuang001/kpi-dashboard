import { useState } from "react";
import { resetThresholds, saveThresholds } from "../../utils/anomalyConfig";

export default function AnomalySection({
  sectorAnomalies,
  dismissedAnomalies,
  dismissAnomaly,
  resetDismissed,
  anomalyThresholds,
  updateAnomalyThresholds,
  openAnomalyModal,
}) {
  const [showAnomalyConfig, setShowAnomalyConfig] = useState(false);
  const [expandedAnomalies, setExpandedAnomalies] = useState(new Set());

  if (!sectorAnomalies || sectorAnomalies.length === 0) return null;

  const activeAnomalies = sectorAnomalies.filter((a) => !dismissedAnomalies.has(a.id));
  const dismissedList = sectorAnomalies.filter((a) => dismissedAnomalies.has(a.id));

  const severityColors = {
    critical: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.25)', accent: '#dc2626', barBg: 'rgba(239,68,68,0.15)', barFill: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', accent: '#d97706', barBg: 'rgba(245,158,11,0.15)', barFill: '#f59e0b' },
    info: { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', accent: '#2563eb', barBg: 'rgba(59,130,246,0.12)', barFill: '#3b82f6' },
  };
  const severityLabels = { critical: '嚴重', warning: '警告', info: '資訊' };

  const toggleExpand = (id) => {
    setExpandedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="anomaly-section" style={{ marginBottom: 24 }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "var(--color-text)",
            }}
          >
            ⚠️ 異常趨勢偵測
          </h3>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {activeAnomalies.filter((a) => a.severity === 'critical').length > 0 && (
              <span className="anomaly-severity-pill anomaly-severity-pill--critical">
                {activeAnomalies.filter((a) => a.severity === 'critical').length} 嚴重
              </span>
            )}
            {activeAnomalies.filter((a) => a.severity === 'warning').length > 0 && (
              <span className="anomaly-severity-pill anomaly-severity-pill--warning">
                {activeAnomalies.filter((a) => a.severity === 'warning').length} 警告
              </span>
            )}
            {activeAnomalies.filter((a) => a.severity === 'info').length > 0 && (
              <span className="anomaly-severity-pill anomaly-severity-pill--info">
                {activeAnomalies.filter((a) => a.severity === 'info').length} 資訊
              </span>
            )}
          </div>
          {dismissedAnomalies.size > 0 && (
            <button
              onClick={resetDismissed}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "0.68rem",
                fontWeight: 600,
                background: "var(--color-surface-alt)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
              }}
            >
              重設已讀 ({dismissedAnomalies.size})
            </button>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowAnomalyConfig((prev) => !prev)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: "0.78rem",
              fontWeight: 700,
              background: showAnomalyConfig
                ? "var(--color-primary)"
                : "var(--color-surface-alt)",
              color: showAnomalyConfig
                ? "white"
                : "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
          >
            ⚙️ 閾值設定
          </button>
          {showAnomalyConfig && (
            <div
              className="anomaly-config-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "var(--color-text)",
                  }}
                >
                  ⚙️ 異常偵測閾值設定
                </div>
                <button
                  onClick={() => {
                    const defaults = resetThresholds();
                    updateAnomalyThresholds({ ...defaults });
                  }}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#dc2626",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    cursor: "pointer",
                  }}
                >
                  重設預設值
                </button>
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                修改後會即時生效並存入瀏覽器。不同裝置的設定會獨立保存。
              </div>
              {Object.entries(anomalyThresholds).map(([ruleKey, rule]) => {
                const numericFields = Object.entries(rule).filter(
                  ([k, v]) => typeof v === "number",
                );
                if (numericFields.length === 0) return null;
                return (
                  <div key={ruleKey} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>{rule.icon || "📌"}</span>
                      <span>{rule.label || ruleKey}</span>
                    </div>
                    {numericFields.map(([field, value]) => {
                      const fieldLabels = {
                        minCount: "最少件數",
                        minPct: "最低佔比(%)",
                        minPctIncrease: "增幅(%)",
                        minAbsDelta: "增加件數",
                        remainDays: "剩餘天數",
                        minPerSN: "每SN次數",
                        minGroups: "最少組數",
                      };
                      return (
                        <div key={field} className="anomaly-config-row">
                          <label>{fieldLabels[field] || field}</label>
                          <input
                            type="number"
                            min="0"
                            value={value}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const next = {
                                ...anomalyThresholds,
                                [ruleKey]: {
                                  ...anomalyThresholds[ruleKey],
                                  [field]: v,
                                },
                              };
                              updateAnomalyThresholds(next);
                              saveThresholds(next);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Anomaly Detail Cards */}
      <div className="anomaly-detail-grid">
        {activeAnomalies.map((a) => {
          const sc = severityColors[a.severity] || severityColors.info;
          const isExpanded = expandedAnomalies.has(a.id);
          const m = a.metrics || {};
          const breakdown = m.breakdown || [];
          const maxVal = breakdown.length > 0 ? Math.max(...breakdown.map((b) => b.value)) : 1;

          return (
            <div
              key={a.id}
              className={`anomaly-detail-card anomaly-detail-card--${a.severity}`}
              style={{
                '--anomaly-accent': sc.accent,
                '--anomaly-bg': sc.bg,
                '--anomaly-border': sc.border,
                '--anomaly-bar-bg': sc.barBg,
                '--anomaly-bar-fill': sc.barFill,
              }}
            >
              {/* Card Header */}
              <div className="anomaly-detail-header" onClick={() => toggleExpand(a.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span className={`anomaly-severity-dot anomaly-severity-dot--${a.severity}`} />
                  <span className="anomaly-detail-title">{a.title}</span>
                  <span className={`anomaly-severity-tag anomaly-severity-tag--${a.severity}`}>
                    {severityLabels[a.severity]}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {a.relatedCases && a.relatedCases.length > 0 && (
                    <button
                      className="anomaly-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAnomalyModal(a);
                      }}
                      title="查看完整案件明細"
                    >
                      📋 {a.relatedCases.length} 件明細
                    </button>
                  )}
                  <button
                    className="anomaly-dismiss-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        dismissAnomaly(a.id);
                    }}
                    title="標記為已讀"
                  >
                    ✕
                  </button>
                  <span
                    className="anomaly-expand-arrow"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {/* Summary Stats Row — always visible */}
              <div className="anomaly-detail-stats">
                <div className="anomaly-stat-item">
                  <div className="anomaly-stat-label">數量</div>
                  <div className="anomaly-stat-value" style={{ color: sc.accent }}>
                    {m.current ?? '-'}
                  </div>
                </div>
                {m.total !== undefined && (
                  <div className="anomaly-stat-item">
                    <div className="anomaly-stat-label">總量</div>
                    <div className="anomaly-stat-value">{m.total}</div>
                  </div>
                )}
                {m.percentage !== undefined && (
                  <div className="anomaly-stat-item">
                    <div className="anomaly-stat-label">佔比</div>
                    <div className="anomaly-stat-value" style={{ color: sc.accent }}>
                      {m.percentage}%
                    </div>
                  </div>
                )}
                {m.delta !== undefined && (
                  <div className="anomaly-stat-item">
                    <div className="anomaly-stat-label">變化</div>
                    <div className="anomaly-stat-value" style={{ color: m.delta > 0 ? '#dc2626' : '#059669' }}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </div>
                  </div>
                )}
                {m.deltaPercent !== undefined && (
                  <div className="anomaly-stat-item">
                    <div className="anomaly-stat-label">增幅</div>
                    <div className="anomaly-stat-value" style={{ color: m.deltaPercent > 0 ? '#dc2626' : '#059669' }}>
                      {m.deltaPercent > 0 ? '+' : ''}{m.deltaPercent}%
                    </div>
                  </div>
                )}
                {m.avgTat !== undefined && (
                  <div className="anomaly-stat-item">
                    <div className="anomaly-stat-label">均 TAT</div>
                    <div className="anomaly-stat-value" style={{ color: '#d97706' }}>
                      {m.avgTat}天
                    </div>
                  </div>
                )}
                {/* 佔比 gauge */}
                {m.percentage !== undefined && (
                  <div className="anomaly-stat-item" style={{ flex: '1 1 100px' }}>
                    <div className="anomaly-stat-label">佔比視覺</div>
                    <div className="anomaly-gauge-track">
                      <div
                        className="anomaly-gauge-fill"
                        style={{ width: `${Math.min(m.percentage, 100)}%` }}
                      />
                      {m.threshold !== undefined && (
                        <div
                          className="anomaly-gauge-threshold"
                          style={{ left: `${Math.min(m.threshold, 100)}%` }}
                          title={`閾值 ${m.threshold}%`}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded Detail — breakdown chart + insight */}
              {isExpanded && (
                <div className="anomaly-detail-expanded">
                  {/* Inline Bar Chart */}
                  {breakdown.length > 0 && (
                    <div className="anomaly-chart-section">
                      <div className="anomaly-chart-title">📊 分佈明細</div>
                      <div className="anomaly-bar-chart">
                        {breakdown.map((item, idx) => (
                          <div key={idx} className="anomaly-bar-row">
                            <div className="anomaly-bar-label" title={item.fullSN || item.label}>
                              {item.label}
                            </div>
                            <div className="anomaly-bar-track">
                              <div
                                className={`anomaly-bar-fill ${item.highlight ? 'anomaly-bar-fill--highlight' : ''}`}
                                style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }}
                              />
                            </div>
                            <div className="anomaly-bar-value">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Explanation */}
                  <div className="anomaly-insight-section">
                    <div className="anomaly-insight-title">💡 數據說明</div>
                    <div className="anomaly-insight-text">
                      {a.description}
                    </div>
                    {m.insight && (
                      <div className="anomaly-insight-recommendation">
                        <strong>建議：</strong>{m.insight}
                      </div>
                    )}
                  </div>

                  {/* Related cases preview */}
                  {a.relatedCases && a.relatedCases.length > 0 && (
                    <div className="anomaly-cases-preview">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="anomaly-chart-title">📝 相關案件（前 5 筆）</span>
                        <button
                          className="anomaly-action-btn"
                          onClick={() => openAnomalyModal(a)}
                        >
                          查看全部 {a.relatedCases.length} 件 →
                        </button>
                      </div>
                      <div className="anomaly-cases-table">
                        <div className="anomaly-cases-row anomaly-cases-row--header">
                          <span>單號</span>
                          <span>客戶</span>
                          <span>機型</span>
                          <span>TAT</span>
                          <span>工程師</span>
                        </div>
                        {a.relatedCases.slice(0, 5).map((c, idx) => (
                          <div key={idx} className="anomaly-cases-row">
                            <span>{c.id || '-'}</span>
                            <span>{c.client || '-'}</span>
                            <span>{c.model || '-'}</span>
                            <span style={{ fontWeight: 700, color: c.tat > 5 ? '#dc2626' : 'inherit' }}>{c.tat ?? '-'}天</span>
                            <span>{c.engineer || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dismissed anomalies — collapsed summary */}
      {dismissedList.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            已讀項目（{dismissedList.length}）
          </div>
          <div className="anomaly-strip">
            {dismissedList.map((a) => (
              <div
                key={a.id}
                className={`anomaly-badge anomaly-badge--${a.severity} anomaly-badge--dismissed`}
                onClick={() => openAnomalyModal(a)}
                title={`${a.description}（點擊查看明細）`}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.title}
                </span>
                <button
                  className="anomaly-dismiss-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetDismissed();
                  }}
                  title="取消已讀"
                >
                  ↺
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
