import { useEffect, useMemo, useRef, useState } from 'react'
import { PARTICIPANTS } from './participants.js'

const STORAGE_KEY = 'lucky-draw-leave-v1'
const LEAVE_DURATION = 24 * 60 * 60 * 1000
const PARTICIPANTS_STORAGE_KEY = 'lucky-draw-participants-v1'
const SEGMENT_COLORS = [
  '#f0a962',
  '#e9c978',
  '#cddba9',
  '#91c9bb',
  '#7ba9b5',
  '#8796be',
  '#a28db8',
  '#cf91a8',
  '#e99a84',
]

function readParticipantList() {
  try {
    const saved = localStorage.getItem(PARTICIPANTS_STORAGE_KEY)
    if (!saved) return { names: PARTICIPANTS, error: '' }

    const parsed = JSON.parse(saved)
    if (
      !Array.isArray(parsed) ||
      parsed.some((name) => typeof name !== 'string' || !name.trim())
    ) {
      return { names: PARTICIPANTS, error: 'Saved participant list could not be read.' }
    }

    const uniqueNames = [...new Map(
      parsed.map((name) => [name.trim().toLocaleLowerCase(), name.trim()]),
    ).values()]
    return { names: uniqueNames, error: '' }
  } catch {
    return { names: PARTICIPANTS, error: 'Saved participant list could not be read.' }
  }
}

function readLeaveEntries(participantNames) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { entries: {}, error: '' }

    const parsed = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: {}, error: 'Saved leave data could not be read.' }
    }

    const now = Date.now()
    const entries = Object.fromEntries(
      Object.entries(parsed).filter(
        ([name, expiresAt]) =>
          participantNames.includes(name) &&
          Number.isFinite(expiresAt) &&
          expiresAt > now,
      ),
    )
    return { entries, error: '' }
  } catch {
    return { entries: {}, error: 'Saved leave data could not be read.' }
  }
}

function pointOnCircle(radius, angle) {
  const radians = (angle * Math.PI) / 180
  return {
    x: 200 + radius * Math.cos(radians),
    y: 200 + radius * Math.sin(radians),
  }
}

function Wheel({ participants, rotation, spinning }) {
  const sliceAngle = 360 / participants.length

  if (participants.length === 0) {
    return (
      <div className="wheel-empty" role="status">
        <span className="empty-sparkle" aria-hidden="true">✳</span>
        <strong>Everyone’s away</strong>
        <span>Your wheel will be ready when someone returns.</span>
      </div>
    )
  }

  return (
    <div className="wheel-frame">
      <div className="wheel-pointer" aria-hidden="true">
        <span />
      </div>
      <svg
        className={`wheel-svg${spinning ? ' is-spinning' : ''}`}
        viewBox="0 0 400 400"
        role="img"
        aria-label={`Lucky draw wheel with ${participants.length} participants`}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <circle cx="200" cy="200" r="197" fill="#fff" />
        {participants.map((name, index) => {
          const startAngle = -90 + index * sliceAngle
          const endAngle = startAngle + sliceAngle
          const start = pointOnCircle(188, startAngle)
          const end = pointOnCircle(188, endAngle)
          const largeArc = sliceAngle > 180 ? 1 : 0
          const midAngle = startAngle + sliceAngle / 2
          const label = pointOnCircle(119, midAngle)
          const readableAngle =
            midAngle > 90 && midAngle < 270 ? midAngle + 180 : midAngle

          return (
            <g key={name}>
              <path
                d={`M 200 200 L ${start.x} ${start.y} A 188 188 0 ${largeArc} 1 ${end.x} ${end.y} Z`}
                fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                stroke="#fffaf2"
                strokeWidth="2"
              />
              <text
                x={label.x}
                y={label.y}
                transform={`rotate(${readableAngle} ${label.x} ${label.y})`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="wheel-label"
              >
                {name}
              </text>
            </g>
          )
        })}
        <circle cx="200" cy="200" r="187" fill="none" stroke="#fff" strokeWidth="3" />
      </svg>
      <div className="wheel-hub" aria-hidden="true" />
    </div>
  )
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 34 }, (_, index) => (
        <span
          key={index}
          style={{
            '--i': index,
            '--hue': `${(index * 47) % 360}`,
          }}
        />
      ))}
    </div>
  )
}

function App() {
  const [initialParticipants] = useState(readParticipantList)
  const [participants, setParticipants] = useState(initialParticipants.names)
  const [initialLeaves] = useState(() => readLeaveEntries(initialParticipants.names))
  const [leaveEntries, setLeaveEntries] = useState(initialLeaves.entries)
  const [storageError, setStorageError] = useState(
    initialParticipants.error || initialLeaves.error,
  )
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaveName, setLeaveName] = useState('')
  const [leaveMessage, setLeaveMessage] = useState('')
  const [newName, setNewName] = useState('')
  const [participantMessage, setParticipantMessage] = useState('')
  const [confirmDeleteName, setConfirmDeleteName] = useState('')
  const settingsRef = useRef(null)

  const activeParticipants = useMemo(
    () => participants.filter((name) => !leaveEntries[name]),
    [participants, leaveEntries],
  )

  useEffect(() => {
    try {
      localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(participants))
      setStorageError('')
    } catch {
      setStorageError('Could not save participants. Check your browser storage settings.')
    }
  }, [participants])

  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leaveEntries))
        setStorageError('')
      } catch {
        setStorageError('Could not save leave status. Check your browser storage settings.')
      }
    }

    persist()
  }, [leaveEntries])

  useEffect(() => {
    const refreshExpiredEntries = () => {
      const now = Date.now()
      setLeaveEntries((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, expiresAt]) => expiresAt > now),
        )
        return Object.keys(next).length === Object.keys(current).length
          ? current
          : next
      })
    }

    const interval = window.setInterval(refreshExpiredEntries, 30_000)
    window.addEventListener('focus', refreshExpiredEntries)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshExpiredEntries)
    }
  }, [])

  useEffect(() => {
    if (!settingsOpen) return undefined

    const handleOutsideClick = (event) => {
      if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!winner) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') setWinner('')
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [winner])

  useEffect(() => {
    if (!confirmDeleteName) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') setConfirmDeleteName('')
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [confirmDeleteName])

  const spin = () => {
    if (spinning || activeParticipants.length === 0) return

    const winnerIndex = Math.floor(Math.random() * activeParticipants.length)
    const selected = activeParticipants[winnerIndex]
    const sliceAngle = 360 / activeParticipants.length
    const winnerCenter = -90 + winnerIndex * sliceAngle + sliceAngle / 2
    const desiredRotation = (-90 - winnerCenter + 360) % 360
    const currentNormalized = ((rotation % 360) + 360) % 360
    const alignmentOffset = (desiredRotation - currentNormalized + 360) % 360
    const nextRotation = rotation + 360 * 6 + alignmentOffset

    setWinner('')
    setSpinning(true)
    setRotation(nextRotation)
    window.setTimeout(() => {
      setSpinning(false)
      setWinner(selected)
    }, 5200)
  }

  const leave = (event) => {
    event.preventDefault()
    const name = leaveName.trim()

    if (!name) {
      setLeaveMessage('Enter a name to continue.')
      return
    }
    if (!participants.includes(name)) {
      setLeaveMessage('That name isn’t on the participant list.')
      return
    }
    if (leaveEntries[name]) {
      setLeaveMessage(`${name} is already marked as away.`)
      return
    }

    setLeaveEntries((current) => ({
      ...current,
      [name]: Date.now() + LEAVE_DURATION,
    }))
    setLeaveMessage(`${name} has been removed for 24 hours.`)
    setLeaveName('')
  }

  const addParticipant = (event) => {
    event.preventDefault()
    const name = newName.trim()

    if (!name) {
      setParticipantMessage('Enter a name to add.')
      return
    }
    if (participants.some((participant) => participant.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setParticipantMessage(`${name} is already on the participant list.`)
      return
    }

    setParticipants((current) => [...current, name])
    setNewName('')
    setParticipantMessage(`${name} has been added to the draw.`)
  }

  const deleteParticipant = () => {
    if (!confirmDeleteName) return

    const nameToDelete = confirmDeleteName
    setParticipants((current) => current.filter((name) => name !== nameToDelete))
    setLeaveEntries((current) => {
      const next = { ...current }
      delete next[nameToDelete]
      return next
    })
    setParticipantMessage(`${nameToDelete} has been permanently removed.`)
    setConfirmDeleteName('')
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Lucky Draw home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>little<span className="brand-accent">luck</span></span>
        </a>
        <div className="settings-anchor" ref={settingsRef}>
          <button
            className={`settings-button${settingsOpen ? ' active' : ''}`}
            type="button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
              <path d="m19.4 13.5 1.1.85-1.1 1.9-1.3-.5a7.6 7.6 0 0 1-1.6.95l-.2 1.4h-2.2l-.2-1.4a7.6 7.6 0 0 1-1.8 0l-.2 1.4H9.7l-.2-1.4a7.6 7.6 0 0 1-1.6-.95l-1.3.5-1.1-1.9 1.1-.85a7 7 0 0 1-.4-1.7l-1.3-.55v-2.2l1.3-.55a7 7 0 0 1 .4-1.7l-1.1-.85 1.1-1.9 1.3.5a7.6 7.6 0 0 1 1.6-.95l.2-1.4h2.2l.2 1.4a7.6 7.6 0 0 1 1.8 0l.2-1.4h2.2l.2 1.4a7.6 7.6 0 0 1 1.6.95l1.3-.5 1.1 1.9-1.1.85a7 7 0 0 1 .4 1.7l1.3.55v2.2l-1.3.55a7 7 0 0 1-.4 1.7Z" />
            </svg>
          </button>
          {settingsOpen && (
            <section className="settings-popover" aria-label="Settings">
              <div className="popover-heading">
                <span className="popover-icon" aria-hidden="true">↗</span>
                <div>
                  <h2>Manage your draw</h2>
                  <p>Add participants or manage who’s taking a break.</p>
                </div>
              </div>
              <div className="participant-manager">
                <h3>Participants</h3>
                <form className="add-name-form" onSubmit={addParticipant}>
                  <label htmlFor="new-name">Add a name</label>
                  <div className="leave-form-row">
                    <input
                      id="new-name"
                      type="text"
                      autoComplete="off"
                      disabled={spinning}
                      value={newName}
                      onChange={(event) => {
                        setNewName(event.target.value)
                        setParticipantMessage('')
                      }}
                      placeholder="Enter participant name"
                    />
                    <button className="leave-button" type="submit" disabled={spinning}>
                      Add
                    </button>
                  </div>
                </form>
                <ul className="participant-list" aria-label="Current participants">
                  {participants.map((name) => (
                    <li className="participant-row" key={name}>
                      <span className="participant-name">{name}</span>
                      {leaveEntries[name] && <span className="away-indicator">Away</span>}
                      <button
                        className="delete-name-button"
                        type="button"
                        aria-label={`Permanently remove ${name}`}
                        disabled={spinning}
                        onClick={() => setConfirmDeleteName(name)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {participantMessage && (
                  <p className="leave-message" role="status">{participantMessage}</p>
                )}
              </div>
              <div className="settings-section">
                <div className="section-heading">
                  <h3>Taking a break?</h3>
                  <p>Temporarily remove someone for 24 hours.</p>
                </div>
                <form onSubmit={leave}>
                  <label htmlFor="leave-name">Participant name</label>
                  <div className="leave-form-row">
                    <input
                      id="leave-name"
                      type="text"
                      autoComplete="off"
                      disabled={spinning}
                      value={leaveName}
                      onChange={(event) => {
                        setLeaveName(event.target.value)
                        setLeaveMessage('')
                      }}
                      placeholder="Enter exact name"
                    />
                    <button className="leave-button" type="submit" disabled={spinning}>
                      Leave
                    </button>
                  </div>
                </form>
                {leaveMessage && (
                  <p className="leave-message" role="status">{leaveMessage}</p>
                )}
                {storageError && (
                  <p className="leave-message error-message" role="alert">{storageError}</p>
                )}
                <p className="storage-note">
                  <span aria-hidden="true">◷</span>
                  They’ll automatically return after 24 hours.
                </p>
                {Object.keys(leaveEntries).length > 0 && (
                  <div className="away-list">
                    <span className="away-list-label">AWAY RIGHT NOW</span>
                    {Object.keys(leaveEntries).map((name) => (
                      <span className="away-chip" key={name}>{name}</span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </header>

      <section className="draw-content">
        <div className="intro">
          <div className="eyebrow"><span /> THE MOMENT OF TRUTH</div>
          <h1>A little <span>luck</span><br />goes a long way.</h1>
          <p>Gather your people. Give it a spin.<br className="desktop-break" /> See where the good luck lands.</p>
        </div>

        <div className="wheel-wrap">
          <div className="wheel-shadow" />
          <Wheel
            participants={activeParticipants}
            rotation={rotation}
            spinning={spinning}
          />
          <button
            className={`spin-button${spinning ? ' is-disabled' : ''}`}
            type="button"
            onClick={spin}
            disabled={spinning || activeParticipants.length === 0}
            aria-label={spinning ? 'Wheel is spinning' : 'Spin the wheel'}
          >
            <span className="spin-button-label">{spinning ? 'GOOD LUCK' : 'SPIN'}</span>
            <span className="spin-button-arrow" aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="draw-footer">
          <span className="participant-count">
            <span className="live-dot" />
            {activeParticipants.length} {activeParticipants.length === 1 ? 'PERSON' : 'PEOPLE'} IN THE DRAW
          </span>
          <span className="footer-divider" />
          <span className="footer-hint">
            {spinning ? 'The wheel is in motion…' : 'Feeling lucky? Tap the wheel.'}
          </span>
        </div>
      </section>

      <footer className="page-footer">
        <span>MADE FOR THE FUN OF IT <span aria-hidden="true">✳</span></span>
        <span>Your draw, your luck.</span>
      </footer>

      {winner && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setWinner('')
          }}
        >
          <section
            className="winner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
          >
            <Confetti />
            <button
              className="modal-close"
              type="button"
              aria-label="Close winner announcement"
              onClick={() => setWinner('')}
            >
              ×
            </button>
            <div className="winner-sparkle" aria-hidden="true">✳</div>
            <p className="winner-kicker">THE WHEEL HAS SPOKEN</p>
            <h2 id="winner-title">🎉 Congratulations!</h2>
            <p className="winner-name">{winner}</p>
            <p className="winner-subtitle">Today’s lucky one. Make it count!</p>
            <button
              className="again-button"
              type="button"
              onClick={() => {
                setWinner('')
                spin()
              }}
            >
              Spin Again <span aria-hidden="true">↗</span>
            </button>
          </section>
        </div>
      )}
      {confirmDeleteName && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDeleteName('')
          }}
        >
          <section
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-description"
          >
            <div className="confirm-icon" aria-hidden="true">!</div>
            <h2 id="confirm-delete-title">Remove participant?</h2>
            <p id="confirm-delete-description">
              Are you sure you want to permanently delete <strong>{confirmDeleteName}</strong> from this draw?
            </p>
            <div className="confirm-actions">
              <button
                className="cancel-delete-button"
                type="button"
                onClick={() => setConfirmDeleteName('')}
              >
                Keep name
              </button>
              <button
                className="confirm-delete-button"
                type="button"
                disabled={spinning}
                onClick={deleteParticipant}
              >
                Delete permanently
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
