import { BIKE_PARTS, TOTAL_PARTS } from "../hooks/useBikeGame";

export function ControlPanel({
  game,
  isLoading,
  isRunning,
  onFullRestart,
  onResetAssembly,
  onRestartSearch,
  onStartCamera,
  onStopCamera,
  playtestSettings,
  setPlaytestSettings,
  tracking
}) {
  const completedPercent = Math.round((game.found.length / TOTAL_PARTS) * 100)

  return (
    <aside className="control-panel">
      <section className="panel-section inventory-summary" aria-label="Bike game">
        <h2>Bike Hunt</h2>
        <div className="progress-summary">
          <div>
            <span>Progress</span>
            <strong>{game.found.length} / {TOTAL_PARTS} parts</strong>
          </div>
        </div>
        <div className="completion-meter" aria-label={`Completed ${completedPercent} percent`}>
          <span style={{ "--progress": `${completedPercent}%` }}></span>
        </div>
        <div className="metric-grid is-compact">
          <Metric label="Score" value={game.score} />
          <Metric label="Time" value={formatTime(game.timeLeft)} />
        </div>
      </section>

      <section className="panel-section" aria-label="Inventory">
        <h2>Inventory</h2>
        <div className="part-list">
          {BIKE_PARTS.map((part) => (
            <InventoryPart key={part.kind} part={part} found={game.found.includes(part.kind)} />
          ))}
        </div>
      </section>

      <details className="panel-section playtest-panel">
        <summary>Controls</summary>
        <div className="tracking-status">
          <StatusDot label="Body" active={isBodyVisible(tracking)} />
          <StatusDot label="Hand" active={Boolean(tracking.handReach?.visible)} />
        </div>
        <div className="settings-grid">
          <SliderSetting
            label="Hand smoothing"
            max="1.8"
            min="0.5"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "handReachSmoothing", value)}
            step="0.05"
            value={playtestSettings.handReachSmoothing}
          />
          <SliderSetting
            label="Pickup radius"
            max="1.8"
            min="0.6"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "pickupScreenRadiusMultiplier", value)}
            step="0.05"
            value={playtestSettings.pickupScreenRadiusMultiplier}
          />
          <SliderSetting
            label="Snap radius"
            max="1.8"
            min="0.6"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "assemblySnapRadiusMultiplier", value)}
            step="0.05"
            value={playtestSettings.assemblySnapRadiusMultiplier}
          />
          <SliderSetting
            label="Deselect ms"
            max="1800"
            min="400"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "deselectTimeoutMs", value)}
            step="50"
            value={playtestSettings.deselectTimeoutMs}
          />
          <ToggleSetting
            checked={playtestSettings.showHandMarker}
            label="Hand marker"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "showHandMarker", value)}
          />
          <ToggleSetting
            checked={playtestSettings.showPickupDebug}
            label="Pickup debug"
            onChange={(value) => updatePlaytestSetting(setPlaytestSettings, "showPickupDebug", value)}
          />
        </div>
        <div className="reset-actions">
          <button type="button" onClick={onRestartSearch} disabled={!isRunning}>
            Restart Search
          </button>
          <button type="button" onClick={onResetAssembly} disabled={!isRunning || game.found.length !== TOTAL_PARTS}>
            Reset Assembly
          </button>
          <button type="button" onClick={onFullRestart}>
            Full Restart
          </button>
        </div>
      </details>

      <button
        type="button"
        className="camera-button"
        onClick={isRunning ? onStopCamera : onStartCamera}
        disabled={isLoading}
      >
        {getCameraButtonLabel(isRunning, isLoading)}
      </button>
    </aside>
  );
}

function InventoryPart({ found, part }) {
  return (
    <span className={found ? "is-found" : "is-missing"}>
      <b aria-hidden="true">{found ? "✓" : ""}</b>
      <i aria-hidden="true">{part.shortLabel}</i>
      <em>{part.label}</em>
      <small>{found ? "Collected" : "Missing"}</small>
    </span>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ active, label }) {
  return (
    <span className={active ? "is-active" : ""}>
      <i aria-hidden="true"></i>
      <b>{label}</b>
      {active ? "Yes" : "No"}
    </span>
  )
}

function SliderSetting({ label, max, min, onChange, step, value }) {
  return (
    <label>
      <span>
        {label}
        <b>{formatSettingValue(value)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ToggleSetting({ checked, label, onChange }) {
  return (
    <label className="toggle-setting">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function updatePlaytestSetting(setPlaytestSettings, key, value) {
  setPlaytestSettings((settings) => ({
    ...settings,
    [key]: value,
  }))
}

function formatSettingValue(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2)
}

function getCameraButtonLabel(isRunning, isLoading) {
  if (isRunning) {
    return "Stop camera";
  }

  if (isLoading) {
    return "Loading...";
  }

  return "Start camera";
}

function isBodyVisible(tracking) {
  return tracking.body && tracking.body !== "No pose"
}

function formatTime(timeLeft) {
  return `${Math.ceil(timeLeft)}s`;
}
