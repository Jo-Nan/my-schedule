import { useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const formatFileSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const sanitizeFilename = (filename = '') => {
  const withoutControlChars = Array.from(String(filename || 'file'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  const normalized = withoutControlChars
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'file';
};

const parsePathnameFromUrl = (urlValue) => {
  if (typeof urlValue !== 'string' || !urlValue) {
    return '';
  }

  try {
    const parsed = new URL(urlValue);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
};

const resolveAttachmentPathname = (attachment) => {
  if (typeof attachment?.pathname === 'string' && attachment.pathname.trim()) {
    return attachment.pathname.trim();
  }
  return parsePathnameFromUrl(attachment?.url || '');
};

const isImageAttachment = (attachment) => String(attachment?.contentType || '').startsWith('image/');

const isPdfAttachment = (attachment) => {
  const contentType = String(attachment?.contentType || '').toLowerCase();
  if (contentType === 'application/pdf') {
    return true;
  }
  return String(attachment?.name || '').toLowerCase().endsWith('.pdf');
};

const getAttachmentTypeLabel = (attachment) => {
  if (isImageAttachment(attachment)) return 'Image';
  if (isPdfAttachment(attachment)) return 'PDF';

  const name = String(attachment?.name || '').toLowerCase();
  if (name.endsWith('.doc') || name.endsWith('.docx')) return 'Word';
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'Excel';
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) return 'PowerPoint';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'Archive';

  return 'File';
};

const getAttachmentTileIcon = (attachment) => {
  if (isImageAttachment(attachment)) return '🖼️';
  if (isPdfAttachment(attachment)) return '📄';

  const label = getAttachmentTypeLabel(attachment);
  if (label === 'Word') return '📝';
  if (label === 'Excel') return '📊';
  if (label === 'PowerPoint') return '📽️';
  if (label === 'Archive') return '🗜️';
  return '📎';
};

const buildAttachmentRecord = (blob, file, fallbackPathname) => ({
  id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: file.name || sanitizeFilename(fallbackPathname),
  url: blob.url,
  pathname: blob.pathname || fallbackPathname,
  size: Number.isFinite(blob.size) ? blob.size : file.size,
  contentType: blob.contentType || file.type || '',
  uploadedAt: new Date().toISOString(),
});

const PlanDetailModal = ({ isOpen, onClose, plan, updatePlan, t, activeUserId }) => {
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState('');
  const [previewAttachmentId, setPreviewAttachmentId] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState('');
  const [dropActive, setDropActive] = useState(false);

  const ownerId = activeUserId || 'unknown-user';

  const attachments = useMemo(
    () => (Array.isArray(plan?.attachments) ? plan.attachments : []),
    [plan?.attachments],
  );

  const previewAttachment = attachments.find((attachment) => attachment.id === previewAttachmentId) || null;

  if (!isOpen || !plan) {
    return null;
  }

  const updateAttachments = (nextAttachments) => {
    updatePlan(
      plan.id,
      {
        attachments: nextAttachments,
      },
      { saveStrategy: 'general' },
    );
  };

  const buildAttachmentAccessUrl = (attachment, mode = 'inline') => {
    const pathname = resolveAttachmentPathname(attachment);
    if (!pathname) {
      return attachment?.url || '';
    }

    const params = new URLSearchParams({
      action: 'read',
      pathname,
      targetUserId: ownerId,
      mode: mode === 'download' ? 'download' : 'inline',
    });
    if (typeof attachment?.name === 'string' && attachment.name.trim()) {
      params.set('filename', attachment.name.trim());
    }
    return `/api/attachments?${params.toString()}`;
  };

  const uploadAttachment = async (file) => {
    const filename = sanitizeFilename(file.name);
    const pathname = `attachments/${ownerId}/${plan.id}/${Date.now()}-${filename}`;

    const blob = await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/attachments?action=upload',
      clientPayload: JSON.stringify({
        targetUserId: ownerId,
        planId: plan.id,
      }),
      multipart: file.size > 5 * 1024 * 1024,
    });

    return buildAttachmentRecord(blob, file, pathname);
  };

  const deleteAttachmentBlob = async (attachment) => {
    await fetch('/api/attachments?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        targetUserId: ownerId,
        pathname: resolveAttachmentPathname(attachment),
        url: attachment.url || '',
      }),
    });
  };

  const handleUploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return;
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      alert(
        t.attachmentTooLarge
        || `Files larger than ${formatFileSize(MAX_FILE_SIZE_BYTES)} are not allowed.`,
      );
    }

    const validFiles = files.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    if (validFiles.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const uploadedAttachments = [];

      for (const file of validFiles) {
        const record = await uploadAttachment(file);
        uploadedAttachments.push(record);
      }

      if (uploadedAttachments.length > 0) {
        updateAttachments([...attachments, ...uploadedAttachments]);
      }
    } catch (error) {
      alert(error.message || (t.attachmentUploadError || 'Failed to upload attachment.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!attachment) {
      return;
    }

    const confirmed = window.confirm(
      `${t.attachmentDeleteConfirm || 'Delete attachment'} "${attachment.name}"?`,
    );
    if (!confirmed) {
      return;
    }

    setBusyAttachmentId(attachment.id);
    try {
      await deleteAttachmentBlob(attachment);
    } catch {
      // Remove local reference even if blob cleanup fails.
    } finally {
      const nextAttachments = attachments.filter((item) => item.id !== attachment.id);
      updateAttachments(nextAttachments);
      if (previewAttachmentId === attachment.id) {
        setPreviewAttachmentId('');
      }
      setBusyAttachmentId('');
    }
  };

  const triggerReplace = (attachmentId) => {
    setReplaceTargetId(attachmentId);
    replaceInputRef.current?.click();
  };

  const handleReplaceAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !replaceTargetId) {
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(
        t.attachmentTooLarge
        || `Files larger than ${formatFileSize(MAX_FILE_SIZE_BYTES)} are not allowed.`,
      );
      event.target.value = '';
      return;
    }

    const target = attachments.find((attachment) => attachment.id === replaceTargetId);
    if (!target) {
      event.target.value = '';
      return;
    }

    setBusyAttachmentId(target.id);
    try {
      const replacement = await uploadAttachment(file);
      replacement.id = target.id;

      const nextAttachments = attachments.map((attachment) => (
        attachment.id === target.id ? replacement : attachment
      ));
      updateAttachments(nextAttachments);

      try {
        await deleteAttachmentBlob(target);
      } catch {
        // Ignore cleanup failure.
      }
    } catch (error) {
      alert(error.message || (t.attachmentReplaceError || 'Failed to replace attachment.'));
    } finally {
      setBusyAttachmentId('');
      setReplaceTargetId('');
      event.target.value = '';
    }
  };

  const handleDropZoneDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dropActive) {
      setDropActive(true);
    }
  };

  const handleDropZoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setDropActive(false);
  };

  const handleDropZoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    handleUploadFiles(event.dataTransfer?.files || []);
  };

  const previewSrc = previewAttachment ? buildAttachmentAccessUrl(previewAttachment, 'inline') : '';

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>{t.planDetailTitle || 'Plan Detail (Read-Only)'}</h3>
          <button type="button" onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t.eventLabel || 'Event'}</label>
            <input className="glass-input" style={styles.readonlyInput} value={plan.event || ''} readOnly />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>{t.timeLabel || 'Time'}</label>
              <input className="glass-input" style={styles.readonlyInput} value={plan.time || ''} readOnly />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t.personLabel || 'Person'}</label>
              <input className="glass-input" style={styles.readonlyInput} value={plan.person || ''} readOnly />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.ddlLabel || 'DDL'}</label>
            <input className="glass-input" style={styles.readonlyInput} value={plan.ddl || ''} readOnly />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.detailLabel || 'Details'}</label>
            <textarea
              className="glass-input"
              style={{ ...styles.readonlyInput, ...styles.detailsArea }}
              value={plan.details || ''}
              readOnly
            />
          </div>
        </div>

        <div style={styles.attachmentsSection}>
          <div style={styles.attachmentsHeader}>
            <h4 style={styles.attachmentsTitle}>{t.attachmentsTitle || 'Attachments'}</h4>
            <div style={styles.attachmentActions}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,image/*"
                onChange={(event) => handleUploadFiles(event.target.files)}
              />
              <input
                ref={replaceInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,image/*"
                onChange={handleReplaceAttachment}
              />
              <button
                type="button"
                className="glass-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (t.attachmentUploading || 'Uploading...') : (t.attachmentUpload || 'Upload')}
              </button>
            </div>
          </div>

          <div
            style={{
              ...styles.dropZone,
              ...(dropActive ? styles.dropZoneActive : {}),
            }}
            onDragEnter={handleDropZoneDragOver}
            onDragOver={handleDropZoneDragOver}
            onDragLeave={handleDropZoneDragLeave}
            onDrop={handleDropZoneDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={styles.dropZoneTitle}>
              {dropActive
                ? (t.attachmentDropActive || 'Release to upload files')
                : (t.attachmentDropHint || 'Drop files here, or click to upload')}
            </div>
            <div style={styles.dropZoneSubtitle}>
              {t.attachmentDropTypes || 'PDF / Word / Excel / PowerPoint / Images / ZIP'}
              {' · '}
              {t.attachmentDropSize || 'Up to 100 MB each'}
            </div>
          </div>

          {attachments.length === 0 ? (
            <div style={styles.empty}>{t.noAttachments || 'No attachments yet.'}</div>
          ) : (
            <div style={styles.attachmentGrid}>
              {attachments.map((attachment) => {
                const busy = busyAttachmentId === attachment.id;
                const canPreview = isImageAttachment(attachment) || isPdfAttachment(attachment);
                const typeLabel = getAttachmentTypeLabel(attachment);
                const tileUrl = canPreview ? buildAttachmentAccessUrl(attachment, 'inline') : '';
                const downloadUrl = buildAttachmentAccessUrl(attachment, 'download');

                return (
                  <div key={attachment.id} style={styles.attachmentTile}>
                    <div style={styles.attachmentThumb}>
                      {isImageAttachment(attachment) ? (
                        <img
                          src={tileUrl}
                          alt={attachment.name || 'attachment'}
                          style={styles.thumbImage}
                        />
                      ) : (
                        <div style={styles.thumbIconWrap}>
                          <span style={styles.thumbIcon}>{getAttachmentTileIcon(attachment)}</span>
                          <span style={styles.thumbType}>{typeLabel}</span>
                        </div>
                      )}
                    </div>

                    <div style={styles.tileBody}>
                      <div style={styles.tileName} title={attachment.name || attachment.url}>
                        {attachment.name || attachment.url}
                      </div>
                      <div style={styles.tileMeta}>
                        <span>{typeLabel}</span>
                        <span>·</span>
                        <span>{formatFileSize(attachment.size)}</span>
                      </div>
                    </div>

                    <div style={styles.tileActions}>
                      {canPreview && (
                        <button
                          type="button"
                          className="glass-button"
                          style={styles.smallButton}
                          onClick={() => setPreviewAttachmentId((prev) => (prev === attachment.id ? '' : attachment.id))}
                        >
                          {t.attachmentPreview || 'Preview'}
                        </button>
                      )}
                      <a
                        className="glass-button"
                        style={{ ...styles.smallButton, textDecoration: 'none' }}
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.attachmentDownload || 'Download'}
                      </a>
                      <button
                        type="button"
                        className="glass-button"
                        style={styles.smallButton}
                        onClick={() => triggerReplace(attachment.id)}
                        disabled={busy}
                      >
                        {t.attachmentReplace || 'Replace'}
                      </button>
                      <button
                        type="button"
                        className="glass-button"
                        style={{ ...styles.smallButton, ...styles.dangerButton }}
                        onClick={() => handleDeleteAttachment(attachment)}
                        disabled={busy}
                      >
                        {t.attachmentDelete || 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {previewAttachment && (
            <div style={styles.previewContainer}>
              <div style={styles.previewTitle}>{previewAttachment.name}</div>
              {isImageAttachment(previewAttachment) ? (
                <img src={previewSrc} alt={previewAttachment.name} style={styles.previewImage} />
              ) : isPdfAttachment(previewAttachment) ? (
                <iframe title={previewAttachment.name} src={previewSrc} style={styles.previewIframe} />
              ) : (
                <div style={styles.previewFallback}>
                  {t.attachmentNoPreview || 'Preview is not available for this file type.'}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button type="button" className="glass-button active-tab" onClick={onClose}>
            {t.closeLabel || t.cancel || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12000,
    padding: '1rem',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: 'min(980px, 96vw)',
    maxHeight: '92vh',
    overflow: 'auto',
    padding: '1.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '2rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.9rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  readonlyInput: {
    background: 'rgba(255,255,255,0.08)',
    cursor: 'default',
  },
  detailsArea: {
    minHeight: '130px',
    resize: 'vertical',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
  },
  attachmentsSection: {
    borderTop: '1px solid var(--glass-border)',
    paddingTop: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  attachmentsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.8rem',
    flexWrap: 'wrap',
  },
  attachmentsTitle: {
    margin: 0,
    fontSize: '1rem',
  },
  attachmentActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  dropZone: {
    border: '1px dashed var(--glass-border)',
    borderRadius: '12px',
    padding: '0.95rem',
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dropZoneActive: {
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
    background: 'rgba(59, 130, 246, 0.08)',
  },
  dropZoneTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  dropZoneSubtitle: {
    marginTop: '0.25rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  empty: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  attachmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.75rem',
  },
  attachmentTile: {
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '230px',
  },
  attachmentThumb: {
    height: '118px',
    background: 'rgba(0,0,0,0.18)',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbIconWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
  },
  thumbIcon: {
    fontSize: '1.6rem',
  },
  thumbType: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  tileBody: {
    padding: '0.55rem 0.65rem 0.45rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    flex: 1,
  },
  tileName: {
    fontWeight: 500,
    fontSize: '0.85rem',
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tileMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
  },
  tileActions: {
    padding: '0.5rem 0.55rem 0.6rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    borderTop: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.02)',
  },
  smallButton: {
    padding: '0.28rem 0.6rem',
    fontSize: '0.75rem',
    minHeight: '30px',
  },
  dangerButton: {
    color: 'var(--danger-color)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  previewContainer: {
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  previewTitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  previewImage: {
    width: '100%',
    maxHeight: '420px',
    objectFit: 'contain',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.2)',
  },
  previewIframe: {
    width: '100%',
    height: '460px',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    background: '#fff',
  },
  previewFallback: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    padding: '0.6rem 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
};

export default PlanDetailModal;
