import { Link } from 'react-router-dom'

export function TrackingTestPage() {
  return (
    <main className="centered-page">
      <p className="eyebrow">Camera & tracking lead</p><h1>Tracking test lab</h1>
      <p className="large-copy">Connect MediaPipe hand and pose detection here before integrating it into the city games.</p>
      <div className="camera-placeholder">Camera preview and landmark overlay</div>
      <Link className="button button--quiet" to="/">Return home</Link>
    </main>
  )
}
