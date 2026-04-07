import EngineerScatter from "../charts/EngineerScatter";
import ChartErrorBoundary from "../common/ChartErrorBoundary";
import { EngineerTable, PartsTable } from "../tables/Tables";

export default function EngineersView({
  stats,
  targetPoints,
  openEngineerModal,
  coopScores,
  updateCoopScore,
}) {
  return (
    <>
      <ChartErrorBoundary>
        <EngineerScatter engStats={stats?.sortedEng || []} />
      </ChartErrorBoundary>

      <div id="engineers" style={{ marginBottom: 24, marginTop: 24 }}>
        <EngineerTable
          engStats={stats?.sortedEng || []}
          targetPoints={targetPoints}
          onEngineerClick={openEngineerModal}
          coopScores={coopScores}
          onCoopChange={updateCoopScore}
        />
      </div>

      <div id="parts" style={{ marginBottom: 24 }}>
        <PartsTable sortedParts={stats?.sortedParts || []} />
      </div>
    </>
  );
}
