import { useState, useRef, useCallback, useEffect } from 'react'

const API = ''

const EXPIRY_LABELS = { '24h': '24 hours', '2d': '2 days', '7d': '7 days' }

function fileEmoji(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '🎬'
  if (['mp3','wav','flac','aac'].includes(ext))        return '🎵'
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️'
  if (['pdf'].includes(ext))                           return '📄'
  if (['zip','rar','7z','tar','gz'].includes(ext))     return '🗜️'
  if (['doc','docx','txt','md'].includes(ext))         return '📝'
  if (['xls','xlsx','csv'].includes(ext))              return '📊'
  if (['ppt','pptx'].includes(ext))                    return '📋'
  return '📁'
}

function quotaColor(left, limit) {
  const pct = left / limit
  if (pct <= 0.2) return 'var(--danger)'
  if (pct <= 0.5) return '#f59e0b'
  return 'var(--primary)'
}

function getOrCreateOwnerToken() {
  let token = localStorage.getItem('droplink_owner_token')
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '')
    localStorage.setItem('droplink_owner_token', token)
  }
  return token
}

function timeUntilReset() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  const diff = midnight - now
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Home() {
  const [dragging, setDragging]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const [result, setResult]         = useState(null)
  const [selectedFile, setSelected] = useState(null)
  const [copied, setCopied]         = useState(false)
  const [expiry, setExpiry]         = useState('24h')
  const [tokens, setTokens]         = useState(null)
  const ownerToken = getOrCreateOwnerToken()
  const fileRef = useRef()

  useEffect(() => {
    fetch(`${API}/api/tokens`)
      .then(r => r.json())
      .then(setTokens)
      .catch(() => {})
  }, [])

  const startUpload = useCallback((file) => {
    if (!file) return
    setSelected(file)
    setUploading(true)
    setProgress(0)

    const xhr  = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    form.append('expires_in', expiry)
    form.append('owner_token', ownerToken)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText)
      if (xhr.status === 201) {
        setResult(data)
        setTokens(t => t ? { ...t, left: data.tokens_left, used: t.limit - data.tokens_left } : null)
      } else {
        alert(data.error || 'Upload failed')
      }
      setUploading(false)
    }
    xhr.onerror = () => { alert('Upload failed'); setUploading(false) }
    xhr.open('POST', `${API}/api/upload`)
    xhr.send(form)
  }, [expiry])

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) startUpload(file)
  }

  const onFileChange = (e) => {
    const file = e.target.files[0]
    if (file) startUpload(file)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/d/${result.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const reset = () => {
    setResult(null); setSelected(null); setProgress(0); setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const shareUrl = result ? `${window.location.origin}/d/${result.token}` : ''

  return (
    <div>
      <nav className="nav">
        <div className="nav-logo">Drop<span>Link</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tokens !== null && (
            <div className="token-badge">
              <span className="token-count" style={{ color: quotaColor(tokens.left, tokens.limit) }}>
                {tokens.left}/{tokens.limit}
              </span>
              <span className="token-label">tokens · Resets in {timeUntilReset()}</span>
            </div>
          )}
          <a href={`/my/${ownerToken}`} className="nav-my-files">My Files</a>
        </div>
      </nav>

      {!uploading && !result && (
        <>
          <div className="hero">
            <h1>Share files <em>instantly</em><br />with anyone</h1>
            <p>Upload any file up to 5GB. Get a shareable link. Done. No sign-up, no hassle.</p>
          </div>

          <div className="upload-zone">
            <div
              className={`drop-area ${dragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
            >
              <span className="drop-icon">☁️</span>
              <div className="drop-title">Drop your file here</div>
              <div className="drop-sub">or click to browse — any file type, up to 5 GB</div>
              <button className="btn-browse" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>
                Choose File
              </button>
              <input ref={fileRef} type="file" className="file-input" onChange={onFileChange} />
            </div>

            <div className="expiry-row">
              <span className="expiry-label">Keep for:</span>
              <div className="expiry-opts">
                {Object.entries(EXPIRY_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    className={`expiry-opt ${expiry === val ? 'active' : ''}`}
                    onClick={() => setExpiry(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="how">
            <h2>How it works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <h3>Upload</h3>
                <p>Drag & drop or browse your file. Any format — movies, docs, archives, images.</p>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <h3>Get Link</h3>
                <p>You instantly get a unique shareable link. Copy it with one click.</p>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <h3>Share</h3>
                <p>Send the link to anyone. They download directly — no account needed.</p>
              </div>
            </div>
          </div>

          <div className="features">
            <h2>Why DropLink?</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>No account needed</h3>
                <p>Zero sign-up. Just upload and share. Your files are identified by a private link only you have.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Instant transfer</h3>
                <p>Files go straight to the server the moment you drop them. Progress bar shows real-time speed.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📁</div>
                <h3>Any file type</h3>
                <p>PDFs, videos, ZIPs, PowerPoints, images — if your device can hold it, DropLink can share it.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⏱️</div>
                <h3>You control expiry</h3>
                <p>Choose 24 hours, 2 days, or 7 days. Files are permanently deleted after expiry — no traces left.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Works everywhere</h3>
                <p>Works on any device — phone, tablet, or laptop. No app to install, just open the link.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🗂️</div>
                <h3>Upload history</h3>
                <p>All your uploads saved under My Files. Re-share or delete from any browser, any device.</p>
              </div>
            </div>
          </div>

          <div className="filetypes">
            <h2>Supported file types</h2>
            <div className="type-tags">
              {['🎬 Video','🎵 Audio','🖼️ Images','📄 PDF','📝 Docs','📊 Sheets','📋 Slides','🗜️ Archives','📁 Any file'].map(t => (
                <span key={t} className="type-tag">{t}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {uploading && selectedFile && (
        <div style={{ padding: '60px 20px' }}>
          <div className="upload-progress">
            <div className="file-meta">
              <div className="file-icon">{fileEmoji(selectedFile.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="file-name">{selectedFile.name}</div>
                <div className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
            <div className="progress-bar-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-text">{progress}% uploaded</div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ padding: '60px 20px' }}>
          <div className="success-card">
            <div className="success-icon">✓</div>
            <div className="success-title">File uploaded!</div>
            <div className="success-sub">
              Ready to share. Expires in {EXPIRY_LABELS[result.expires_in] || '24 hours'}.
            </div>

            <div className="file-details">
              <div className="detail-item">
                <div className="detail-label">File</div>
                <div className="detail-value">
                  {fileEmoji(result.name)} {result.name.length > 22 ? result.name.slice(0, 22) + '…' : result.name}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Size</div>
                <div className="detail-value">{result.size}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Expires</div>
                <div className="detail-value">{EXPIRY_LABELS[result.expires_in] || '24 hours'}</div>
              </div>
            </div>

            <div className="link-section-label">Share link — send this to your friend</div>
            <div className="link-box">
              <span className="link-url">{shareUrl}</span>
              <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={copyLink}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>

            <button className="btn-new" onClick={reset} style={{ marginTop: 20 }}>Upload another file</button>
          </div>
        </div>
      )}

      <footer className="footer">
        DropLink · Files deleted after expiry · No account required
      </footer>
    </div>
  )
}
