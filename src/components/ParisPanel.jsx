export function ParisPanel({
  game,
  isLoading,
  isRunning,
  onStartCamera,
  onStopCamera,
  tracking,
}) {
  return (
    <aside className="control-panel paris-panel">
      <section className="panel-section">
        <h2>Pastry catch</h2>
        <div className="metric-grid">
          <Metric label="Score" value={game.score} />
          <Metric label="Caught" value={game.caught} />
          <Metric label="Missed" value={`${game.missed}/${game.maxMisses}`} />
          <Metric label="Time" value={`${Math.ceil(game.timeLeft)}s`} />
        </div>
      </section>

      <section className="panel-section">
        <h2>Hand tracking</h2>
        <div className="metric-grid">
          <Metric label="Status" value={tracking.label} />
          <Metric label="Hand" value={tracking.hand} />
          <Metric label="Confidence" value={`${Math.round(tracking.confidence * 100)}%`} />
        </div>
      </section>

      <p className="panel-tip">
        Move your hand to guide the basket. Pinch or drag with the pointer if
        you are playtesting without camera input.
      </p>

      <button
        type="button"
        className="camera-button"
        onClick={isRunning ? onStopCamera : onStartCamera}
        disabled={isLoading}
      >
        {isRunning ? "Stop camera" : isLoading ? "Loading..." : "Start camera"}
      </button>
    </aside>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
