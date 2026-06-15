import { useEffect } from 'react'
import Webcam from 'react-webcam'
import { useHandTracking } from '../hooks/useHandTracking'
import { VIDEO_CONSTRAINTS } from '../handTracking'
import { StatusPill } from './StatusPill'

export function LandingExperience() {
  const { canvasRef, handleCameraError, handleCameraReady, isLoading, startCamera, stopCamera, tracking, webcamRef } = useHandTracking()

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()
    }
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  const isHandDetected = tracking.mode === 'tracking'

  return (
    <section className="landing-scene" aria-label="Then and There landing page">
      <img className="landing-map" src="/map-svgrepo-com.svg" alt="Illustrated map for the Then and There journey" />

      <div className="landing-vision" aria-hidden="true">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="landing-webcam"
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
        <canvas ref={canvasRef} className="landing-canvas" />
      </div>

      {!isHandDetected && (
        <div className="landing-overlay">
          <div className="landing-card">
            <p className="eyebrow">Then & There</p>
            <h1 className="landing-title">Find the gesture to begin</h1>
            <p className="landing-copy">Hold up a hand in front of the camera. The map stays on screen until a gesture is detected.</p>
            <StatusPill mode={tracking.mode} label={isLoading ? 'Loading model' : tracking.label} />
          </div>
        </div>
      )}
    </section>
  )
}