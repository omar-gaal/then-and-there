export function AmsterdamPanel({ game, isLoading, isRunning, onStartCamera, onStopCamera, tracking }) {
  return (
    <aside className="control-panel amsterdam-panel">
      <section className="panel-section"><h2>Canal run</h2><div className="metric-grid"><Metric label="Score" value={game.score} /><Metric label="Cleared" value={game.cleared} /><Metric label="Lives" value={game.lives} /><Metric label="Time" value={`${Math.ceil(game.timeLeft)}s`} /></div></section>
      <section className="panel-section"><h2>Pose tracking</h2><div className="metric-grid"><Metric label="Status" value={tracking.isCalibrated ? 'Calibrated' : 'Calibrating'} /><Metric label="Jump" value={tracking.isJumping ? 'Detected' : 'Ready'} /><Metric label="Hip rise" value={`${Math.round(tracking.jumpHeight)}px`} /><Metric label="Confidence" value={`${Math.round(tracking.confidence * 100)}%`} /></div></section>
      <p className="panel-tip">Stand still during calibration, then jump when a tulip reaches the runner.</p>
      <button type="button" className="camera-button" onClick={isRunning ? onStopCamera : onStartCamera} disabled={isLoading}>{isRunning ? 'Stop camera' : isLoading ? 'Loading...' : 'Start camera'}</button>
    </aside>
  )
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}
