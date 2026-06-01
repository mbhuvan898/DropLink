import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

const API = ''

function fileEmoji(name = '') {
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

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export default function Manage() {
  const { ownerToken } = useParams()
  const [files, setFiles]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [copied, setCopied]       = useState({})
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/my/${ownerToken}`)
      .then(r => r.json())
      .then(d => { setFiles(d.files || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ownerToken])

  const copyShareLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/d/${token}`)
    setCopied(c => ({ ...c, [token]: true }))
    setTimeout(() => setCopied(c => ({ ...c, [token]: false })), 2500)
  }

  const downloadFile = (f) => {
    setDownloading(f.token)
    const a = document.createElement('a')
    a.href = `${API}/api/download/${f.token}`
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => setDownloading(null), 2000)
  }

  const deleteFile = async (token) => {
    if (!window.confirm('Delete this file? This cannot be undone.')) return
    await fetch(`${API}/api/my/${ownerToken}/${token}`, { method: 'DELETE' })
    setFiles(f => f.filter(x => x.token !== token))
  }

  const activeFiles  = files.filter(f => !f.expired)
  const expiredFiles = files.filter(f => f.expired)

  return (
    <div className="manage-page">
      <nav className="nav">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="nav-logo">Drop<span>Link</span></div>
        </Link>
        <div className="nav-tagline">Your uploaded files</div>
      </nav>

      <div className="manage-wrap">
        {loading && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>
            <span className="spinner" style={{ fontSize: 28 }}>⟳</span>
            <p style={{ marginTop: 10 }}>Loading…</p>
          </div>
        )}

        {!loading && files.length === 0 && (
          <div className="manage-empty">
            <Link to="/" className="btn-back" style={{ marginBottom: 24, display: 'inline-block' }}>← Back</Link>
            <div className="manage-empty-icon">📭</div>
            <div className="manage-empty-title">No files yet</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              Files you upload from this browser will appear here.
            </div>
            <Link to="/"><button className="btn-download">Upload a file</button></Link>
          </div>
        )}

        {!loading && files.length > 0 && (
          <>
            <div className="manage-header">
              <Link to="/" className="btn-back">← Back</Link>
              <div className="manage-title">Your Files</div>
              <div className="manage-sub">
                {activeFiles.length} active · {expiredFiles.length} expired
                &nbsp;·&nbsp; Bookmark this page to access from any browser
              </div>
            </div>

            {activeFiles.map(f => (
              <FileRow
                key={f.token}
                f={f}
                copied={copied[f.token]}
                downloading={downloading === f.token}
                onCopy={() => copyShareLink(f.token)}
                onDownload={() => downloadFile(f)}
                onDelete={() => deleteFile(f.token)}
              />
            ))}

            {expiredFiles.length > 0 && (
              <>
                <div className="expired-section-label">Expired</div>
                {expiredFiles.map(f => (
                  <FileRow
                    key={f.token}
                    f={f}
                    expired
                    onDelete={() => deleteFile(f.token)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <footer className="footer">
        DropLink · Files deleted after expiry · No account required
      </footer>
    </div>
  )
}

function FileRow({ f, copied, downloading, onCopy, onDownload, onDelete, expired }) {
  const left = timeLeft(f.expires_at)
  return (
    <div className={`file-row ${expired ? 'file-row-expired' : ''}`}>
      <div className="file-row-icon">{fileEmoji(f.name)}</div>
      <div className="file-row-info">
        <div className="file-row-name" title={f.name}>{f.name}</div>
        <div className="file-row-meta">
          <span>{f.size}</span>
          <span>{f.downloads} download{f.downloads !== 1 ? 's' : ''}</span>
          <span className={expired ? 'meta-expired' : 'meta-active'}>
            {expired ? 'Expired' : left}
          </span>
        </div>
      </div>
      <div className="file-row-actions">
        {!expired && (
          <>
            <button
              className="btn-row-dl"
              onClick={onDownload}
              disabled={downloading}
            >
              {downloading ? '⟳' : '⬇'}
            </button>
            <button
              className={`btn-row-copy ${copied ? 'copied' : ''}`}
              onClick={onCopy}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </>
        )}
        <button className="btn-row-del" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}
