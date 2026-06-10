export function AmsterdamPanel({ game, isLoading, isRunning, onStartCamera, onStopCamera, tracking }) {
  const threshold = tracking.jumpThreshold ?? 16
  const fillPct = Math.min(100, (tracking.jumpHeight / threshold) * 100)

  return (
    <aside className="control-panel amsterdam-panel">
      <section className="panel-section">
        <h2>Canal run</h2>
        <div className="metric-grid">
          <Metric label="Score" value={game.score} />
          <Metric label="Cleared" value={game.cleared} />
          <Metric label="Lives" value={game.lives} />
          <Metric label="Time" value={`${Math.ceil(game.timeLeft)}s`} />
        </div>
      </section>

      <section className="panel-section">
        <h2>Pose tracking</h2>
        <div className="metric-grid">
          <Metric label="Status" value={tracking.isCalibrated ? 'Calibrated' : 'Calibrating'} />
          <Metric label="Jump" value={tracking.isJumping ? 'Detected!' : 'Ready'} />
          <Metric label="Confidence" value={`${Math.round(tracking.confidence * 100)}%`} />
        </div>
        {tracking.isCalibrated && (
          <div className="jump-bar-wrap">
            <div className="jump-bar-label">
              <span>Hip rise</span>
              <span>{Math.round(tracking.jumpHeight)}px / {Math.round(threshold)}px</span>
            </div>
            <div className="jump-bar-track">
              <div
                className="jump-bar-fill"
                style={{
                  width: `${fillPct}%`,
                  background: fillPct >= 100 ? 'var(--teal)' : fillPct > 60 ? 'var(--amber)' : 'var(--muted)',
                }}
              />
              <div className="jump-bar-threshold" />
            </div>
          </div>
        )}
      </section>

      <p className="panel-tip">Stand 1–2m from camera, full body visible. Calibrate first, then jump when a tulip reaches the runner.</p>
      <button
        type="button"
        className="camera-button"
        onClick={isRunning ? onStopCamera : onStartCamera}
        disabled={isLoading}
      >
        {isRunning ? 'Stop camera' : isLoading ? 'Loading…' : 'Start camera'}
      </button>
    </aside>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
