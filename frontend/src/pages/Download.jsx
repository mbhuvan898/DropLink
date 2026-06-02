import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

const API = ''

function getOwnerToken() {
  return localStorage.getItem('droplink_owner_token')
}

function fileEmoji(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '🎬'
  if (['mp3','wav','flac','aac'].includes(ext))        return '🎵'
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️'
  if (['pdf'].includes(ext))                           return '📄'
  if (['zip','rar','7z','tar','gz'].includes(ext))     return '🗜️'
  if (['doc','docx','txt','md'].includes(ext))         return '📝'
  if (['xls','xlsx','csv'].includes(ext))              return '📊'
  return '📁'
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export default function Download() {
  const { token } = useParams()
  const [file, setFile]               = useState(null)
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [previewErr, setPreviewErr]   = useState(false)

  useEffect(() => {
    fetch(`${API}/api/file/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setFile(data)
      })
      .catch(() => setError('Could not reach server'))
      .finally(() => setLoading(false))
  }, [token])

  const download = async () => {
    setDownloading(true)
    const a = document.createElement('a')
    a.href = `${API}/api/download/${token}`
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => setDownloading(false), 2000)
  }

  const ownerToken   = getOwnerToken()
  const isImage      = file && file.mimetype && file.mimetype.startsWith('image/')

  return (
    <div className="download-page">
      <nav className="nav">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="nav-logo">Drop<span>Link</span></div>
        </Link>
        {ownerToken
          ? <a href={`/my/${ownerToken}`} className="nav-my-files">My Files</a>
          : <Link to="/" className="nav-my-files">Upload a file</Link>
        }
      </nav>

      <div className="download-wrap">
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ fontSize: 32 }}>⟳</span>
            <p style={{ marginTop: 12 }}>Loading file info…</p>
          </div>
        )}

        {error && (
          <div className="download-card">
            <span className="expired-icon">🔗</span>
            <div className="expired-title">
              {error === 'This link has expired' || error === 'Link expired' ? 'Link Expired' : 'File Not Found'}
            </div>
            <div className="expired-sub" style={{ marginBottom: 28 }}>
              {error === 'This link has expired' || error === 'Link expired'
                ? 'This download link has expired. Files are automatically deleted after their set duration.'
                : 'This file could not be found. It may have been deleted or the link is incorrect.'}
            </div>
            <Link to="/"><button className="btn-download">Upload your own file</button></Link>
          </div>
        )}

        {file && (
          <div className="download-card">
            {isImage && !previewErr && (
              <div className="dl-preview">
                <img
                  src={`${API}/api/preview/${token}`}
                  alt={file.name}
                  onError={() => setPreviewErr(true)}
                />
              </div>
            )}

            {!isImage && (
              <span className="dl-file-icon">{fileEmoji(file.name)}</span>
            )}

            <div className="dl-filename">{file.name}</div>

            <div className="dl-meta" style={{ marginBottom: 28 }}>
              <div className="dl-meta-item">
                <div className="dl-meta-label">Size</div>
                <div className="dl-meta-value">{file.size}</div>
              </div>
              <div className="dl-meta-item">
                <div className="dl-meta-label">Expires in</div>
                <div className="dl-meta-value" style={{ color: 'var(--primary)' }}>
                  {timeLeft(file.expires_at)}
                </div>
              </div>
            </div>

            <button className="btn-download" onClick={download} disabled={downloading}>
              {downloading ? '⟳ Starting download…' : '⬇ Download File'}
            </button>
            <div className="dl-note">File auto-deleted after expiry · No account needed</div>

            <div className="dl-divider" />
            <Link to="/" className="btn-upload-own">
              ☁️ Share your own file on DropLink
            </Link>
          </div>
        )}
      </div>

      <footer className="footer">
        DropLink · Files deleted after expiry · No account required
      </footer>
    </div>
  )
}
