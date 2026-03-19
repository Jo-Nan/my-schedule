import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { upload } from '@vercel/blob/client';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const EXCEL_PREVIEW_MAX_ROWS = 25;
const EXCEL_PREVIEW_MAX_COLS = 8;

const EMPTY_OFFICE_PREVIEW = {
  status: 'idle',
  type: '',
  html: '',
  sheetName: '',
  rows: [],
  error: '',
};

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

const getAttachmentExt = (attachment) => {
  const name = String(attachment?.name || '').toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
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
  return contentType === 'application/pdf' || getAttachmentExt(attachment) === 'pdf';
};

const isWordAttachment = (attachment) => {
  const ext = getAttachmentExt(attachment);
  if (ext === 'doc' || ext === 'docx') {
    return true;
  }

  const contentType = String(attachment?.contentType || '').toLowerCase();
  return (
    contentType === 'application/msword'
    || contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
};

const isExcelAttachment = (attachment) => {
  const ext = getAttachmentExt(attachment);
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return true;
  }

  const contentType = String(attachment?.contentType || '').toLowerCase();
  return (
    contentType === 'application/vnd.ms-excel'
    || contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || contentType === 'text/csv'
  );
};

const canPreviewAttachment = (attachment) => (
  isImageAttachment(attachment)
  || isPdfAttachment(attachment)
  || isWordAttachment(attachment)
  || isExcelAttachment(attachment)
);

const getAttachmentTypeLabel = (attachment) => {
  if (isImageAttachment(attachment)) return 'Image';
  if (isPdfAttachment(attachment)) return 'PDF';
  if (isWordAttachment(attachment)) return 'Word';
  if (isExcelAttachment(attachment)) return 'Excel';

  const name = String(attachment?.name || '').toLowerCase();
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

const takeWordFirstPageLikeContent = (html) => {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }

  if (typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild;

    if (!container) {
      return html;
    }

    const blockNodes = Array.from(container.children)
      .filter((element) => element.textContent && element.textContent.trim())
      .slice(0, 14);

    if (blockNodes.length === 0) {
      return html;
    }

    return blockNodes.map((element) => element.outerHTML).join('');
  } catch {
    return html;
  }
};

const normalizeExcelRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const maxColumns = Math.min(
    EXCEL_PREVIEW_MAX_COLS,
    safeRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0),
  );

  if (maxColumns <= 0) {
    return [];
  }

  return safeRows.slice(0, EXCEL_PREVIEW_MAX_ROWS).map((row) => (
    Array.from({ length: maxColumns }, (_, columnIndex) => {
      const value = Array.isArray(row) ? row[columnIndex] : '';
      return value === null || value === undefined ? '' : String(value);
    })
  ));
};

const PlanDetailModal = ({ isOpen, onClose, plan, updatePlan, t, activeUserId }) => {
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState('');
  const [previewAttachmentId, setPreviewAttachmentId] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [officePreview, setOfficePreview] = useState(EMPTY_OFFICE_PREVIEW);

  const ownerId = activeUserId || 'unknown-user';

  const attachments = useMemo(
    () => (Array.isArray(plan?.attachments) ? plan.attachments : []),
    [plan?.attachments],
  );

  const previewableAttachments = useMemo(
    () => attachments.filter((attachment) => canPreviewAttachment(attachment)),
    [attachments],
  );

  const previewAttachment = useMemo(() => {
    if (!previewAttachmentId) {
      return previewableAttachments[0] || null;
    }

    return attachments.find((attachment) => attachment.id === previewAttachmentId) || previewableAttachments[0] || null;
  }, [attachments, previewAttachmentId, previewableAttachments]);

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

  const previewSrc = previewAttachment ? buildAttachmentAccessUrl(previewAttachment, 'inline') : '';

  const currentPreviewIndex = previewAttachment
    ? previewableAttachments.findIndex((attachment) => attachment.id === previewAttachment.id)
    : -1;
  const hasMultiplePreviewable = previewableAttachments.length > 1;

  useEffect(() => {
    if (!isOpen) {
      setPreviewAttachmentId('');
      setOfficePreview(EMPTY_OFFICE_PREVIEW);
      return;
    }

    if (previewableAttachments.length === 0) {
      if (previewAttachmentId) {
        setPreviewAttachmentId('');
      }
      return;
    }

    const hasCurrent = previewableAttachments.some((attachment) => attachment.id === previewAttachmentId);
    if (!hasCurrent) {
      setPreviewAttachmentId(previewableAttachments[0].id);
    }
  }, [isOpen, previewAttachmentId, previewableAttachments]);

  useEffect(() => {
    let cancelled = false;

    const loadOfficePreview = async () => {
      if (!isOpen || !previewAttachment) {
        setOfficePreview(EMPTY_OFFICE_PREVIEW);
        return;
      }

      if (!isWordAttachment(previewAttachment) && !isExcelAttachment(previewAttachment)) {
        setOfficePreview(EMPTY_OFFICE_PREVIEW);
        return;
      }

      setOfficePreview((prev) => ({
        ...prev,
        status: 'loading',
        type: isWordAttachment(previewAttachment) ? 'word' : 'excel',
        error: '',
      }));

      try {
        const response = await fetch(previewSrc, { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error('Preview fetch failed');
        }

        const arrayBuffer = await response.arrayBuffer();

        if (isWordAttachment(previewAttachment)) {
          const mammothModule = await import('mammoth/mammoth.browser');
          const mammoth = mammothModule.default || mammothModule;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const html = takeWordFirstPageLikeContent(result.value || '');

          if (!cancelled) {
            setOfficePreview({
              status: 'ready',
              type: 'word',
              html,
              sheetName: '',
              rows: [],
              error: '',
            });
          }
          return;
        }

        const xlsxModule = await import('xlsx');
        const XLSX = xlsxModule.default || xlsxModule;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames?.[0] || '';
        const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        const rawRows = worksheet
          ? XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, blankrows: false })
          : [];
        const rows = normalizeExcelRows(rawRows);

        if (!cancelled) {
          setOfficePreview({
            status: 'ready',
            type: 'excel',
            html: '',
            sheetName: firstSheetName,
            rows,
            error: '',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setOfficePreview((prev) => ({
            ...prev,
            status: 'error',
            error: error?.message || 'Preview unavailable',
          }));
        }
      }
    };

    loadOfficePreview();

    return () => {
      cancelled = true;
    };
  }, [isOpen, previewAttachment, previewSrc]);

  useEffect(() => {
    if (!isOpen || !hasMultiplePreviewable) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;

      if (currentPreviewIndex < 0) {
        return;
      }

      const nextIndex = (currentPreviewIndex + direction + previewableAttachments.length) % previewableAttachments.length;
      setPreviewAttachmentId(previewableAttachments[nextIndex].id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPreviewIndex, hasMultiplePreviewable, isOpen, previewableAttachments]);

  if (!isOpen || !plan || typeof document === 'undefined') {
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
        const nextAttachments = [...attachments, ...uploadedAttachments];
        updateAttachments(nextAttachments);

        const firstPreviewable = uploadedAttachments.find((attachment) => canPreviewAttachment(attachment));
        if (firstPreviewable && !previewAttachmentId) {
          setPreviewAttachmentId(firstPreviewable.id);
        }
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
        const nextPreviewable = nextAttachments.find((item) => canPreviewAttachment(item));
        setPreviewAttachmentId(nextPreviewable ? nextPreviewable.id : '');
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

      if (previewAttachmentId === target.id) {
        setPreviewAttachmentId(replacement.id);
      }

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

  const shiftPreview = (direction) => {
    if (!hasMultiplePreviewable || currentPreviewIndex < 0) {
      return;
    }

    const nextIndex = (currentPreviewIndex + direction + previewableAttachments.length) % previewableAttachments.length;
    setPreviewAttachmentId(previewableAttachments[nextIndex].id);
  };

  const renderPreviewBody = () => {
    if (!previewAttachment) {
      return (
        <div style={styles.previewFallback}>
          {t.noAttachments || 'No attachments yet.'}
        </div>
      );
    }

    if (isImageAttachment(previewAttachment)) {
      return (
        <div style={styles.previewMediaStage}>
          <img src={previewSrc} alt={previewAttachment.name} style={styles.previewImage} />
          {hasMultiplePreviewable && (
            <>
              <button
                type="button"
                className="glass-button"
                style={{ ...styles.previewArrow, ...styles.previewArrowLeft }}
                onClick={() => shiftPreview(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="glass-button"
                style={{ ...styles.previewArrow, ...styles.previewArrowRight }}
                onClick={() => shiftPreview(1)}
              >
                ›
              </button>
            </>
          )}
        </div>
      );
    }

    if (isPdfAttachment(previewAttachment)) {
      return <iframe title={previewAttachment.name} src={previewSrc} style={styles.previewIframe} />;
    }

    if (isWordAttachment(previewAttachment)) {
      if (officePreview.status === 'loading') {
        return <div style={styles.previewFallback}>{t.attachmentPreviewLoading || 'Generating preview...'}</div>;
      }

      if (officePreview.status === 'error') {
        return (
          <div style={styles.previewFallback}>
            {t.attachmentWordPreviewFallback || 'Word preview is unavailable for this file. Please download.'}
          </div>
        );
      }

      return (
        <div style={styles.wordPreviewWrap}>
          <div style={styles.previewHint}>{t.attachmentFirstPageHint || 'Showing first page / first sheet preview'}</div>
          <div
            style={styles.wordPreviewBody}
            dangerouslySetInnerHTML={{ __html: officePreview.html || '' }}
          />
        </div>
      );
    }

    if (isExcelAttachment(previewAttachment)) {
      if (officePreview.status === 'loading') {
        return <div style={styles.previewFallback}>{t.attachmentPreviewLoading || 'Generating preview...'}</div>;
      }

      if (officePreview.status === 'error') {
        return (
          <div style={styles.previewFallback}>
            {t.attachmentExcelPreviewFallback || 'Excel preview is unavailable for this file. Please download.'}
          </div>
        );
      }

      return (
        <div style={styles.excelPreviewWrap}>
          <div style={styles.previewHint}>
            {t.attachmentFirstPageHint || 'Showing first page / first sheet preview'}
            {officePreview.sheetName ? ` · ${(t.attachmentSheetLabel || 'Sheet')}: ${officePreview.sheetName}` : ''}
          </div>
          {officePreview.rows.length === 0 ? (
            <div style={styles.previewFallback}>{t.attachmentNoPreview || 'Preview is not available for this file type.'}</div>
          ) : (
            <div style={styles.excelTableScroller}>
              <table style={styles.excelTable}>
                <tbody>
                  {officePreview.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, colIndex) => (
                        <td key={`cell-${rowIndex}-${colIndex}`} style={styles.excelCell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={styles.previewFallback}>
        {t.attachmentNoPreview || 'Preview is not available for this file type.'}
      </div>
    );
  };

  const modalNode = (
    <div style={styles.overlay} onMouseDown={onClose}>
      <div className="glass-panel" style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{t.planDetailTitle || 'Plan Detail (Read-Only)'}</h3>
          <button type="button" onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.infoPanel}>
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
          </div>

          <div style={styles.attachmentsPanel}>
            <div style={styles.attachmentsHeader}>
              <h4 style={styles.attachmentsTitle}>{t.attachmentsTitle || 'Attachments'}</h4>
              <div style={styles.attachmentActions}>
                <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z,image/*"
                onChange={(event) => handleUploadFiles(event.target.files)}
              />
              <input
                ref={replaceInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z,image/*"
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
                  const canPreview = canPreviewAttachment(attachment);
                  const typeLabel = getAttachmentTypeLabel(attachment);
                  const tileUrl = isImageAttachment(attachment) ? buildAttachmentAccessUrl(attachment, 'inline') : '';
                  const downloadUrl = buildAttachmentAccessUrl(attachment, 'download');
                  const isPreviewing = previewAttachment?.id === attachment.id;

                  return (
                    <div
                      key={attachment.id}
                      style={{
                        ...styles.attachmentTile,
                        ...(isPreviewing ? styles.attachmentTileActive : {}),
                      }}
                    >
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
                            onClick={() => setPreviewAttachmentId(attachment.id)}
                          >
                            {isPreviewing ? (t.attachmentPreviewing || 'Previewing') : (t.attachmentPreview || 'Preview')}
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
                <div style={styles.previewHeader}>
                  <div style={styles.previewTitle} title={previewAttachment.name}>{previewAttachment.name}</div>
                  {hasMultiplePreviewable && (
                    <div style={styles.previewPager}>
                      <button
                        type="button"
                        className="glass-button"
                        style={styles.previewPagerBtn}
                        onClick={() => shiftPreview(-1)}
                      >
                        {t.attachmentPrev || 'Prev'}
                      </button>
                      <span style={styles.previewPagerText}>{currentPreviewIndex + 1} / {previewableAttachments.length}</span>
                      <button
                        type="button"
                        className="glass-button"
                        style={styles.previewPagerBtn}
                        onClick={() => shiftPreview(1)}
                      >
                        {t.attachmentNext || 'Next'}
                      </button>
                    </div>
                  )}
                </div>
                {renderPreviewBody()}
              </div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button type="button" className="glass-button active-tab" onClick={onClose}>
            {t.closeLabel || t.cancel || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.52)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22000,
    padding: 'clamp(10px, 2vw, 24px)',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: 'min(1320px, 96vw)',
    height: 'min(920px, 94vh)',
    maxHeight: '94vh',
    overflow: 'hidden',
    padding: '1.15rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.2rem 0.15rem',
  },
  title: {
    margin: 0,
    fontSize: '1.12rem',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '2rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 0.25rem',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
    minHeight: 0,
    flex: 1,
    overflow: 'hidden',
  },
  infoPanel: {
    border: '1px solid var(--glass-border)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    padding: '0.9rem',
    overflow: 'auto',
  },
  attachmentsPanel: {
    border: '1px solid var(--glass-border)',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    padding: '0.9rem',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
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
    fontSize: '0.84rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  readonlyInput: {
    background: 'rgba(255,255,255,0.08)',
    cursor: 'default',
  },
  detailsArea: {
    minHeight: '240px',
    resize: 'vertical',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
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
    padding: '0.92rem',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
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
  attachmentTileActive: {
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
  },
  attachmentThumb: {
    height: '116px',
    background: 'rgba(0,0,0,0.2)',
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
    fontSize: '0.84rem',
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
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.35rem',
    borderTop: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.02)',
  },
  smallButton: {
    padding: '0.28rem 0.5rem',
    fontSize: '0.74rem',
    minHeight: '30px',
    textAlign: 'center',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: '0.65rem',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  previewTitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  previewPager: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  previewPagerBtn: {
    padding: '0.22rem 0.55rem',
    fontSize: '0.72rem',
    minHeight: '28px',
  },
  previewPagerText: {
    fontSize: '0.74rem',
    color: 'var(--text-secondary)',
    minWidth: '52px',
    textAlign: 'center',
  },
  previewMediaStage: {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.25)',
  },
  previewImage: {
    width: '100%',
    maxHeight: '460px',
    minHeight: '180px',
    objectFit: 'contain',
    display: 'block',
    background: 'rgba(0,0,0,0.25)',
  },
  previewArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '42px',
    height: '42px',
    borderRadius: '999px',
    background: 'rgba(17, 24, 39, 0.42)',
    border: '1px solid rgba(255,255,255,0.26)',
    color: '#fff',
    fontSize: '1.6rem',
    lineHeight: 1,
    padding: 0,
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(4px)',
  },
  previewArrowLeft: {
    left: '0.6rem',
  },
  previewArrowRight: {
    right: '0.6rem',
  },
  previewIframe: {
    width: '100%',
    height: '520px',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    background: '#fff',
  },
  wordPreviewWrap: {
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  wordPreviewBody: {
    maxHeight: '470px',
    overflow: 'auto',
    padding: '0.9rem',
    lineHeight: 1.65,
    color: 'var(--text-primary)',
  },
  excelPreviewWrap: {
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  excelTableScroller: {
    maxHeight: '450px',
    overflow: 'auto',
  },
  excelTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  excelCell: {
    border: '1px solid rgba(148, 163, 184, 0.28)',
    padding: '0.45rem 0.5rem',
    verticalAlign: 'top',
    minWidth: '76px',
    background: 'rgba(255,255,255,0.02)',
  },
  previewHint: {
    fontSize: '0.74rem',
    color: 'var(--text-secondary)',
    padding: '0.6rem 0.75rem 0.35rem',
  },
  previewFallback: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    padding: '0.8rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
};

export default PlanDetailModal;
