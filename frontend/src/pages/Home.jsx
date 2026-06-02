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
  const [error, setError]           = useState(null)
  const ownerToken = getOrCreateOwnerToken()
  const fileRef = useRef()

  useEffect(() => {
    fetch(`${API}/api/tokens`, { headers: { 'X-Device-Token': ownerToken } })
      .then(r => r.json())
      .then(setTokens)
      .catch(() => {})
  }, [ownerToken])

  const startUpload = useCallback((file) => {
    if (!file) return
    setSelected(file)
    setUploading(true)
    setProgress(0)
    setError(null)

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
        setTokens({ limit: data.tokens_limit, left: data.tokens_left, used: data.tokens_limit - data.tokens_left })
      } else {
        setError(data.error || 'Upload failed')
      }
      setUploading(false)
    }
    xhr.onerror = () => { setError('Network error — upload failed'); setUploading(false) }
    xhr.open('POST', `${API}/api/upload`)
    xhr.setRequestHeader('X-Device-Token', ownerToken)
    xhr.send(form)
  }, [expiry, ownerToken])

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
    setResult(null); setSelected(null); setProgress(0); setUploading(false); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const shareUrl  = result ? `${window.location.origin}/d/${result.token}` : ''
  const shareText = result ? `Here's a file for you: ${result.name}` : ''

  return (
    <div>
      <nav className="nav">
        <div className="nav-logo">Drop<span>Link</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tokens !== null && (
            <div className="token-badge">
              <div className="token-dots">
                {Array.from({ length: tokens.limit }).map((_, i) => (
                  <div key={i} className={`token-dot ${i < tokens.used ? 'used' : ''}`} />
                ))}
              </div>
              <span className="token-count" style={{ color: quotaColor(tokens.left, tokens.limit) }}>
                {tokens.left}/{tokens.limit}
              </span>
              <span className="token-label">· resets {timeUntilReset()}</span>
            </div>
          )}
          <a href={`/my/${ownerToken}`} className="nav-my-files">My Files</a>
        </div>
      </nav>

      {!uploading && !result && !error && (
        <>
          <div className="hero">
            <h1>Share files <em>instantly</em><br />with anyone</h1>
            <p>Upload any file up to 1 GB. Get a shareable link. Done. No sign-up required.</p>
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
              <div className="drop-sub">or click to browse — any file type, up to 1 GB</div>
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

      {error && !uploading && !result && (
        <div style={{ padding: '60px 20px' }}>
          <div className="error-card">
            <div className="error-icon">⚠</div>
            <div className="error-title">Upload failed</div>
            <div className="error-msg">{error}</div>
            <button className="btn-new" onClick={reset} style={{ marginTop: 20 }}>Try again</button>
          </div>
        </div>
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
                <div className="detail-label">Tokens used</div>
                <div className="detail-value">{result.tokens_used} <span style={{color:'var(--text-muted)',fontWeight:400}}>({result.tokens_left} left)</span></div>
              </div>
            </div>

            <div className="link-section-label">Share link</div>
            <div className="link-box">
              <span className="link-url">{shareUrl}</span>
              <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={copyLink}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <div className="share-row">
              <a
                className="share-btn share-wa"
                href={`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`}
                target="_blank" rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                className="share-btn share-tg"
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank" rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
              <button className="share-btn share-copy" onClick={copyLink}>
                {copied ? '✓ Copied' : '🔗 Copy link'}
              </button>
            </div>

            <a href={`/my/${ownerToken}`} className="btn-manage-link">View all my uploads →</a>
            <button className="btn-new" onClick={reset} style={{ marginTop: 10 }}>Upload another file</button>
          </div>
        </div>
      )}

      {/* Cloud Safety Section */}
      <div className="safety-section">
        <h2>Your files are protected</h2>
        <p className="safety-sub">Every claim below is backed by real code — not marketing.</p>
        <div className="safety-grid">
          <div className="safety-card">
            <div className="safety-icon">🔐</div>
            <h3>AES-256 encrypted storage</h3>
            <p>Files are stored on Supabase cloud infrastructure, which applies AES-256 encryption at rest on every object. DropLink never stores files on an unencrypted disk.</p>
          </div>
          <div className="safety-card">
            <div className="safety-icon">🔗</div>
            <h3>Private link — never indexed</h3>
            <p>Access requires your exact 10-character random hex token. There is no search, no directory, and no API to list files. Brute-forcing the token space (16¹⁰ combinations) is computationally infeasible.</p>
          </div>
          <div className="safety-card">
            <div className="safety-icon">🗑️</div>
            <h3>Proactive permanent deletion</h3>
            <p>Expired files are deleted from cloud storage on every upload cycle — not lazily. Once gone, there is no backup or recovery path. The <code>/api/cleanup</code> endpoint can also be called on a schedule.</p>
          </div>
          <div className="safety-card">
            <div className="safety-icon">🚫</div>
            <h3>Rate-limit data auto-purged daily</h3>
            <p>The only data stored is a daily upload token count per browser (not linked to any identity). It is automatically deleted at the end of each UTC day — no data persists beyond 24 hours.</p>
          </div>
        </div>
      </div>

      {/* Enterprise API — Upcoming Feature */}
      <div className="enterprise-section">
        <div className="enterprise-inner">
          <div className="enterprise-badge">Coming Soon</div>
          <h2>DropLink Enterprise API</h2>
          <p className="enterprise-sub">
            Programmatic file transfers for teams, apps, and workflows — no UI required.
          </p>

          <div className="enterprise-cols">
            <div className="enterprise-features">
              <div className="ent-feature">
                <span className="ent-icon">🔑</span>
                <div>
                  <strong>API key authentication</strong>
                  <p>Secure your integration with per-app API keys. Rotate or revoke at any time.</p>
                </div>
              </div>
              <div className="ent-feature">
                <span className="ent-icon">📤</span>
                <div>
                  <strong>Bulk file transfers</strong>
                  <p>Upload and manage hundreds of files in one API call. Built for automation.</p>
                </div>
              </div>
              <div className="ent-feature">
                <span className="ent-icon">🪝</span>
                <div>
                  <strong>Webhook notifications</strong>
                  <p>Get notified instantly when a file is downloaded or a link expires.</p>
                </div>
              </div>
              <div className="ent-feature">
                <span className="ent-icon">📈</span>
                <div>
                  <strong>Higher limits &amp; priority CDN</strong>
                  <p>Larger files, more daily tokens, and faster delivery through global edge nodes.</p>
                </div>
              </div>
            </div>

            <div className="enterprise-code">
              <div className="code-label">Example · Upload via API</div>
              <pre className="code-block">{`POST /api/enterprise/upload
Authorization: Bearer dk_live_••••••••••

{
  "expires_in": "7d",
  "webhook_url": "https://yourapp.com/hook"
}

→ 201 Created
{
  "token": "a3f9c12e01",
  "share_url": "https://droplink.app/d/a3f9c12e01",
  "expires_at": "2026-06-09T10:00:00Z"
}`}</pre>
            </div>
          </div>

          <div className="enterprise-cta">
            <button className="btn-waitlist" onClick={() => alert('Thanks! We will reach out when the API launches.')}>
              Join the Waitlist →
            </button>
            <span className="waitlist-note">Be the first to get access. No spam, ever.</span>
          </div>
        </div>
      </div>

      <footer className="footer">
        DropLink · Files deleted after expiry · No account required
      </footer>
    </div>
  )
}
