import React, { useState, useRef, useEffect, useCallback } from 'react';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

/* ── SVG Icons ── */
const CalendarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const ChevronLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

const ChevronRightIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

const ClearIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

/* ── Calendar DatePicker (frappe-ui style) ── */
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface CalendarPickerProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const today = new Date();
    const parsed = value ? new Date(value + 'T00:00:00') : null;
    const [viewYear, setViewYear] = useState(parsed?.getFullYear() || today.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; inMonth: boolean; date: Date }[] = [];

    // Previous month trailing days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
    }
    // Fill remaining slots
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth + 1, d) });
    }

    const formatDisplay = (v: string) => {
        if (!v) return '';
        const d = new Date(v + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const toIso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const isSameDay = (a: Date, b: Date | null) =>
        b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const isToday = (d: Date) => isSameDay(d, today);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    return (
        <div className="calendar-picker" ref={ref}>
            <div className="calendar-input" onClick={() => setIsOpen(!isOpen)}>
                <CalendarIcon />
                <span className={`calendar-input-text ${value ? '' : 'placeholder'}`}>
                    {value ? formatDisplay(value) : (placeholder || 'Select date')}
                </span>
                {value && (
                    <button className="calendar-clear" onClick={(e) => { e.stopPropagation(); onChange(''); }}>
                        <ClearIcon />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="calendar-dropdown">
                    <div className="calendar-nav">
                        <button className="calendar-nav-btn" onClick={prevMonth}><ChevronLeftIcon /></button>
                        <span className="calendar-nav-title">{MONTHS[viewMonth]} {viewYear}</span>
                        <button className="calendar-nav-btn" onClick={nextMonth}><ChevronRightIcon /></button>
                    </div>
                    <div className="calendar-grid">
                        {DAYS.map((d) => (
                            <div key={d} className="calendar-day-header">{d}</div>
                        ))}
                        {cells.map((cell, idx) => (
                            <button
                                key={idx}
                                className={`calendar-day ${!cell.inMonth ? 'outside' : ''} ${isSameDay(cell.date, parsed) ? 'selected' : ''} ${isToday(cell.date) ? 'today' : ''}`}
                                onClick={() => { onChange(toIso(cell.date)); setIsOpen(false); }}
                            >
                                {cell.day}
                            </button>
                        ))}
                    </div>
                    <div className="calendar-footer">
                        <button className="calendar-today-btn" onClick={() => { onChange(toIso(today)); setIsOpen(false); }}>Today</button>
                        <button className="calendar-clear-btn" onClick={() => { onChange(''); setIsOpen(false); }}>Clear</button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Project Link Field ── */
interface ProjectOption {
    name: string;
    project_name: string;
}

interface ProjectLinkFieldProps {
    value: string;
    onChange: (val: string) => void;
}

const ProjectLinkField: React.FC<ProjectLinkFieldProps> = ({ value, onChange }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ProjectOption[]>([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchProjects = useCallback(async (searchTerm: string) => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/method/frappe.client.get_list?doctype=IMS Project&filters=${encodeURIComponent(JSON.stringify(searchTerm ? { project_name: ['like', `%${searchTerm}%`] } : {}))}&fields=${encodeURIComponent(JSON.stringify(['name', 'project_name']))}&limit_page_length=10&order_by=modified desc`,
                {
                    headers: { 'X-Frappe-CSRF-Token': (window as any).csrf_token || getCsrfToken() },
                }
            );
            const data = await res.json();
            setOptions(data.message || []);
        } catch {
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            searchProjects(query);
        }
    }, [isOpen, query, searchProjects]);

    const handleSelect = (opt: ProjectOption) => {
        onChange(opt.name);
        setQuery(opt.project_name || opt.name);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setQuery('');
    };

    const handleFocus = () => {
        setIsOpen(true);
        if (value && !query) {
            setQuery('');
        }
    };

    return (
        <div className="project-link" ref={ref}>
            <div className="project-link-input-wrap">
                <SearchIcon />
                <input
                    ref={inputRef}
                    type="text"
                    className="project-link-input"
                    placeholder="Search projects..."
                    value={isOpen ? query : (value || '')}
                    onChange={(e) => { setQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
                    onFocus={handleFocus}
                />
                {(value || query) && (
                    <button className="project-link-clear" onClick={handleClear}>
                        <ClearIcon />
                    </button>
                )}
            </div>
            {isOpen && (
                <div className="project-link-dropdown">
                    {loading ? (
                        <div className="project-link-loading">Searching...</div>
                    ) : options.length === 0 ? (
                        <div className="project-link-empty">No projects found</div>
                    ) : (
                        options.map((opt) => (
                            <button
                                key={opt.name}
                                className={`project-link-option ${opt.name === value ? 'selected' : ''}`}
                                onClick={() => handleSelect(opt)}
                            >
                                <span className="project-link-name">{opt.project_name || opt.name}</span>
                                <span className="project-link-id">{opt.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Upload Modal ── */
const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [assetTitle, setAssetTitle] = useState('');
    const [campaign, setCampaign] = useState('');
    const [project, setProject] = useState('');
    const [description, setDescription] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (selectedFile: File) => {
        setFile(selectedFile);
        setError('');

        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }

        if (!assetTitle) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
            setAssetTitle(nameWithoutExt.replace(/[-_]/g, ' '));
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileChange(droppedFile);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }
        if (!assetTitle.trim()) {
            setError('Asset title is required.');
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Step 1: Upload file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('is_private', '1');

            const uploadRes = await fetch('/api/method/upload_file', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Frappe-CSRF-Token': (window as any).csrf_token || getCsrfToken(),
                },
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok || uploadData.exc) {
                throw new Error(uploadData._server_messages || 'File upload failed.');
            }

            const fileUrl = uploadData.message?.file_url;
            if (!fileUrl) {
                throw new Error('No file URL returned from upload.');
            }

            // Step 2: Create the IMS Marketing Asset document
            const createRes = await fetch('/api/method/ims.api.upload_marketing_asset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Frappe-CSRF-Token': (window as any).csrf_token || getCsrfToken(),
                },
                body: JSON.stringify({
                    asset_title: assetTitle.trim(),
                    campaign: campaign.trim(),
                    project: project,
                    description: description.trim(),
                    expiry_date: expiryDate,
                    file_url: fileUrl,
                }),
            });

            const createData = await createRes.json();

            if (!createRes.ok || createData.exc) {
                throw new Error(createData._server_messages || 'Asset creation failed.');
            }

            resetForm();
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred during upload.');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setAssetTitle('');
        setCampaign('');
        setProject('');
        setDescription('');
        setExpiryDate('');
        setFile(null);
        setPreview(null);
        setError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Upload Marketing Asset</h2>
                    <button className="modal-close-btn" onClick={handleClose}>✕</button>
                </div>

                {error && (
                    <div className="upload-error">{error}</div>
                )}

                {/* Drop zone */}
                <div
                    className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {preview ? (
                        <div className="file-preview">
                            <img src={preview} alt="Preview" />
                            <span className="file-name">{file?.name}</span>
                            <span className="file-size">{formatFileSize(file?.size || 0)}</span>
                        </div>
                    ) : file ? (
                        <div className="file-info">
                            <span className="file-icon">📄</span>
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{formatFileSize(file.size)}</span>
                        </div>
                    ) : (
                        <div className="drop-prompt">
                            <span className="drop-icon">☁️</span>
                            <p>Drag & drop your file here, or <strong>click to browse</strong></p>
                            <span className="drop-hint">Supports images, PDFs, PSDs, and videos</span>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        style={{ display: 'none' }}
                        accept="image/*,.pdf,.psd,.mp4,.mov,.avi"
                    />
                </div>

                {/* Form fields */}
                <div className="upload-form">
                    <div className="form-group">
                        <label>Asset Title *</label>
                        <input
                            type="text"
                            value={assetTitle}
                            onChange={(e) => setAssetTitle(e.target.value)}
                            placeholder="e.g. Summer Campaign Banner"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Campaign</label>
                            <input
                                type="text"
                                value={campaign}
                                onChange={(e) => setCampaign(e.target.value)}
                                placeholder="e.g. Q1 2026 Launch"
                            />
                        </div>
                        <div className="form-group">
                            <label>Project</label>
                            <ProjectLinkField value={project} onChange={setProject} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Expiry Date</label>
                        <CalendarPicker
                            value={expiryDate}
                            onChange={setExpiryDate}
                            placeholder="Select expiry date"
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of the asset..."
                            rows={2}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={handleClose} disabled={uploading}>
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={!file || !assetTitle.trim() || uploading}
                    >
                        {uploading ? 'Uploading...' : 'Upload & Create Asset'}
                    </button>
                </div>
            </div>
        </div>
    );
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf_token"]');
    return meta ? meta.getAttribute('content') || '' : '';
}

export default UploadModal;
