import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { WorkflowMenu } from './WorkflowMenu';

/* ── Types ── */
interface Annotation {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    annotation_type?: string;       // point | rect | freehand
    path?: { x: number; y: number }[];
    comment: string;
    author: string;
    author_name: string;
    timestamp: string;
}

interface AnnotationData {
    annotations: Annotation[];
    revision: string | null;
    revision_number?: number;
    revision_file?: string;
    status: string;
    content_brief?: string;
    can_upload_revision?: boolean;
}

interface Revision {
    name: string;
    revision_number: number;
    revision_file: string;
    revision_notes?: string;
    creation: string;
    owner: string;
}

type SidebarTab = 'comments' | 'history';

interface WorkflowResponse {
    status: string;
    current_state: string;
}

interface ImageAnnotatorProps {
    assetName: string;
    onBack: () => void;
}

type ToolMode = 'cursor' | 'rect' | 'pen';

/* ── SVG Icons ── */
const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);
const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
);
const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);
const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);
const ChatIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);
const WorkflowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <polyline points="10 6.5 14 6.5" />
        <polyline points="17.5 10 17.5 14" />
        <polyline points="6.5 10 6.5 17.5 14 17.5" />
    </svg>
);
const CursorIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
    </svg>
);
const RectIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
);
const PenIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
    </svg>
);

/* ── Helpers ── */
function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function isVideoFile(url: string): boolean {
    const ext = (url.match(/\.(\w+)(?:\?|$)/) || [])[1]?.toLowerCase() || '';
    return ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg'].includes(ext);
}

/** Convert an array of {x,y} percent-coords into an SVG path "d" string. */
function toSvgPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    return points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
        .join(' ');
}

const UploadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

/* ── Component ── */
const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ assetName, onBack }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const revisionInputRef = useRef<HTMLInputElement>(null);

    // Tool & Sidebar state
    const [activeTool, setActiveTool] = useState<ToolMode>('cursor');
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('comments');
    const [activeRevisionNum, setActiveRevisionNum] = useState<number | undefined>(undefined);

    // Rect drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

    // Pen / freehand state
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

    // Pending annotation (ready to attach a comment)
    const [pendingAnnotation, setPendingAnnotation] = useState<{
        x: number; y: number; width: number; height: number;
        annotation_type: string;
        path?: { x: number; y: number }[];
    } | null>(null);

    const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingRevision, setUploadingRevision] = useState(false);

    /* ── Mentions state ── */
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [showMentions, setShowMentions] = useState(false);

    // Fetch asset
    const { data: assetData, mutate: refreshAsset } = useFrappeGetCall<{
        message: { latest_file: string; asset_title: string; campaign: string; category: string; status: string };
    }>('frappe.client.get', { doctype: 'IMS Marketing Asset', name: assetName });

    const { data: annotationData, mutate: refreshAnnotations } = useFrappeGetCall<{ message: AnnotationData }>(
        'ims.api.get_annotations', { marketing_asset: assetName, revision_number: activeRevisionNum }
    );

    // Fetch revision history
    const { data: revisionHistory } = useFrappeGetCall<{ message: { revisions: Revision[] } }>(
        'ims.api.get_revision_history', { marketing_asset: assetName }
    );
    const revisions = revisionHistory?.message?.revisions || [];

    // Fetch workflow transitions (just for current state)
    const { data: workflowData, mutate: refreshWorkflow } = useFrappeGetCall<{ message: WorkflowResponse }>(
        'ims.api.get_workflow_transitions', { marketing_asset: assetName }
    );

    const { call: submitAnnotation } = useFrappePostCall('ims.api.submit_annotation');
    const { call: saveBriefApi } = useFrappePostCall('ims.api.save_content_brief');

    // Fetch users for mention
    const { data: mentionData } = useFrappeGetCall<{ message: { users: { name: string; full_name: string; user_image?: string }[] } }>(
        'ims.api.get_users_for_mention',
        { query: mentionQuery || '' },
        showMentions && mentionQuery !== null ? `mentions-${mentionQuery}` : null
    );

    const mentionUsers = mentionData?.message?.users || [];

    // We can't use useFrappePostCall for file uploads easily with standard fetch wrapper if it expects JSON
    // But frappe-react-sdk usually handles it if body is FormData? 
    // Let's rely on standard fetch or check if we can mock it.
    // Actually, let's just use standard fetch for the file upload to be safe and explicit.

    const handleRevisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingRevision(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('marketing_asset', assetName);
        formData.append('notes', 'Uploaded via Dashboard');

        // CSRF handling if needed, but in standard Desk app session it often works with cookies.
        // If we are in a pure React app served by Frappe, cookies are present.

        try {
            const res = await fetch('/api/method/ims.api.upload_revision', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Frappe-CSRF-Token': (window as any).csrf_token || '',
                }
            });
            const data = await res.json();
            if (data.message && data.message.status === 'success') {
                refreshAsset(); // Update the image
                refreshAnnotations(); // Reload annotations (might be empty/different for new revision)
                refreshWorkflow();
                alert('New revision uploaded successfully.');
            } else {
                console.error('Upload failed', data);
                alert('Upload failed: ' + (data.message || data.exception));
            }
        } catch (err) {
            console.error('Upload error', err);
            alert('An error occurred during upload.');
        } finally {
            setUploadingRevision(false);
            if (revisionInputRef.current) revisionInputRef.current.value = '';
        }
    };

    const asset = assetData?.message;
    const annotations = annotationData?.message?.annotations || [];
    const contentBrief = annotationData?.message?.content_brief || '';
    const revisionName = annotationData?.message?.revision || '';
    const canUploadRevision = annotationData?.message?.can_upload_revision;
    const currentWorkflowState = workflowData?.message?.current_state || asset?.status;

    /* ── Content Brief editing state ── */
    const [editedBrief, setEditedBrief] = useState(contentBrief);
    const [briefDirty, setBriefDirty] = useState(false);
    const [briefSaving, setBriefSaving] = useState(false);
    const [briefSaved, setBriefSaved] = useState(false);
    const briefInitialized = useRef(false);

    // Sync when API data loads/changes
    useEffect(() => {
        setEditedBrief(contentBrief);
        setBriefDirty(false);
        setBriefSaved(false);
        briefInitialized.current = false;
    }, [contentBrief]);

    const handleBriefChange = useCallback((value: string) => {
        // Skip the first onChange from ReactQuill mount
        if (!briefInitialized.current) {
            briefInitialized.current = true;
            return;
        }
        setEditedBrief(value);
        setBriefDirty(true);
        setBriefSaved(false);
    }, []);

    const handleSaveBrief = useCallback(async () => {
        if (!briefDirty) return;
        setBriefSaving(true);

        try {
            const payload = {
                marketing_asset: assetName,
                revision_name: revisionName || null,
                content_brief: editedBrief
            };
            console.log('Saving content brief...', payload);

            const resp = await saveBriefApi(payload);
            console.log('Save response:', resp);

            if (resp.status === 'success') {
                setBriefDirty(false);
                setBriefSaved(true);
                // Force a refresh of local data to confirm persistence
                refreshAnnotations();
                setTimeout(() => setBriefSaved(false), 3000);

                // If a different revision was returned (e.g. Revision 1 was protected),
                // we should probably stay on latest or update UI.
                // Mutate already handles this by fetching latest if activeRevisionNum is null.
            } else {
                console.error('Save failed', resp);
                alert(`Save failed: ${resp.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Save error', err);
            alert('An error occurred while saving the content brief.');
        }
        setBriefSaving(false);
    }, [saveBriefApi, assetName, revisionName, editedBrief, briefDirty, refreshAnnotations]);

    const fileUrl = annotationData?.message?.revision_file || asset?.latest_file || '';
    const isVideo = isVideoFile(fileUrl);
    const isViewingLatest = !activeRevisionNum;

    /* ── Coordinate helper ── */
    const getPercentCoords = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const c = containerRef.current;
            if (!c) return { x: 0, y: 0 };
            const r = c.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
                y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
            };
        },
        []
    );

    /* ── Mouse handlers ── */
    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isVideo || !isViewingLatest) return;
            const coords = getPercentCoords(e);

            if (activeTool === 'pen') {
                setIsDrawing(true);
                setCurrentPath([coords]);
            } else if (activeTool === 'rect') {
                setDragStart(coords);
                setIsDragging(false);
            } else {
                // cursor tool: point click
                setDragStart(coords);
                setIsDragging(false);
            }
        },
        [getPercentCoords, activeTool, isVideo]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isVideo || !isViewingLatest) return;
            const coords = getPercentCoords(e);

            if (activeTool === 'pen' && isDrawing) {
                setCurrentPath((prev) => [...prev, coords]);
            } else if ((activeTool === 'rect' || activeTool === 'cursor') && dragStart) {
                if (Math.abs(coords.x - dragStart.x) > 2 || Math.abs(coords.y - dragStart.y) > 2) {
                    setIsDragging(true);
                    setDragCurrent(coords);
                }
            }
        },
        [getPercentCoords, activeTool, isDrawing, dragStart, isVideo]
    );

    const handleMouseUp = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isVideo || !isViewingLatest) return;

            if (activeTool === 'pen' && isDrawing && currentPath.length > 1) {
                // Compute bounding box center for the annotation coordinates
                const xs = currentPath.map((p) => p.x);
                const ys = currentPath.map((p) => p.y);
                const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

                setPendingAnnotation({
                    x: cx,
                    y: cy,
                    width: 0,
                    height: 0,
                    annotation_type: 'freehand',
                    path: [...currentPath],
                });
                setIsDrawing(false);
                setCurrentPath([]);
                setTimeout(() => commentInputRef.current?.focus(), 50);
            } else if (activeTool === 'rect' && isDragging && dragStart && dragCurrent) {
                const x = Math.min(dragStart.x, dragCurrent.x);
                const y = Math.min(dragStart.y, dragCurrent.y);
                const w = Math.abs(dragCurrent.x - dragStart.x);
                const h = Math.abs(dragCurrent.y - dragStart.y);
                setPendingAnnotation({ x, y, width: w, height: h, annotation_type: 'rect' });
                setTimeout(() => commentInputRef.current?.focus(), 50);
            } else if (dragStart) {
                const coords = getPercentCoords(e);
                setPendingAnnotation({ x: coords.x, y: coords.y, width: 0, height: 0, annotation_type: 'point' });
                setTimeout(() => commentInputRef.current?.focus(), 50);
            }

            setIsDragging(false);
            setDragStart(null);
            setDragCurrent(null);
        },
        [activeTool, isDrawing, currentPath, isDragging, dragStart, dragCurrent, getPercentCoords, isVideo]
    );

    /* ── Submit comment ── */
    const handleSubmitComment = useCallback(async () => {
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            const ann = pendingAnnotation || { x: 50, y: 50, width: 0, height: 0, annotation_type: 'point' };
            const payload: Record<string, unknown> = {
                marketing_asset: assetName,
                x: ann.x,
                y: ann.y,
                width: ann.width,
                height: ann.height,
                comment: comment.trim(),
                annotation_type: ann.annotation_type,
            };
            if (ann.annotation_type === 'freehand' && ann.path) {
                payload.path = JSON.stringify(ann.path);
            }
            await submitAnnotation(payload);
            setComment('');
            setPendingAnnotation(null);
            refreshAnnotations();
        } finally {
            setSubmitting(false);
        }
    }, [comment, pendingAnnotation, assetName, submitAnnotation, refreshAnnotations]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmitComment();
            }
        },
        [handleSubmitComment]
    );

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setComment(val);

        const cursor = e.target.selectionStart;
        const textBefore = val.slice(0, cursor);
        const match = textBefore.match(/@([a-zA-Z0-9._]*)$/);

        if (match) {
            setMentionQuery(match[1]);
            setShowMentions(true);
        } else {
            setShowMentions(false);
            setMentionQuery(null);
        }
    };

    const handleSelectMention = (user: { name: string; full_name: string }) => {
        if (!commentInputRef.current) return;
        const cursor = commentInputRef.current.selectionStart;
        const textBefore = comment.slice(0, cursor);
        const textAfter = comment.slice(cursor);
        const match = textBefore.match(/@([a-zA-Z0-9._]*)$/);

        if (match && match.index !== undefined) {
            const newText = textBefore.slice(0, match.index) + `@${user.name} ` + textAfter;
            setComment(newText);
            setShowMentions(false);
            setMentionQuery(null);
            setTimeout(() => {
                if (commentInputRef.current) {
                    commentInputRef.current.focus();
                }
            }, 50);
        }
    };


    /* ── Rect selection preview ── */
    const selectionRect =
        isDragging && dragStart && dragCurrent
            ? {
                x: Math.min(dragStart.x, dragCurrent.x),
                y: Math.min(dragStart.y, dragCurrent.y),
                width: Math.abs(dragCurrent.x - dragStart.x),
                height: Math.abs(dragCurrent.y - dragStart.y),
            }
            : null;

    /* ── Resolve annotation type ── */
    const getAnnType = (ann: Annotation): string => {
        if (ann.annotation_type) return ann.annotation_type;
        if (ann.path && ann.path.length > 0) return 'freehand';
        if ((ann.width || 0) > 0 || (ann.height || 0) > 0) return 'rect';
        return 'point';
    };

    /* ── Actions ── */
    const handleDownload = () => {
        if (!fileUrl) return;
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = asset?.asset_title || 'download';
        a.click();
    };

    const handleShare = async () => {
        const url = window.location.origin + fileUrl;
        if (navigator.share) {
            await navigator.share({ title: asset?.asset_title, url });
        } else {
            await navigator.clipboard.writeText(url);
        }
    };

    if (!asset) {
        return (
            <div className="annotator-loading">
                <div className="loading-spinner" />
                <p>Loading asset...</p>
            </div>
        );
    }

    const fileName = fileUrl.split('/').pop() || asset.asset_title;
    const cursorClass = activeTool === 'pen' ? 'tool-pen' : activeTool === 'rect' ? 'tool-crosshair' : '';

    return (
        <div className="asset-viewer">
            <input
                type="file"
                ref={revisionInputRef}
                style={{ display: 'none' }}
                onChange={handleRevisionUpload}
                accept="image/*,video/*"
            />
            {/* ── Header ── */}
            <div className="asset-header">
                <div className="asset-header-left">
                    <button className="asset-back-btn" onClick={onBack}><BackIcon /></button>
                    <div className="asset-breadcrumb">
                        <span className="breadcrumb-project">{asset.campaign || 'Assets'}</span>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-file">{fileName}</span>
                    </div>
                    <span className="asset-type-badge">{currentWorkflowState || asset.category || 'Asset'}</span>
                </div>
                <div className="asset-header-right">
                    {uploadingRevision ? (
                        <button className="asset-action-btn" disabled>
                            <div className="loading-spinner-sm" style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                            <span>Uploading...</span>
                        </button>
                    ) : canUploadRevision && (
                        <button className="asset-action-btn" onClick={() => revisionInputRef.current?.click()}>
                            <UploadIcon /><span>New Version</span>
                        </button>
                    )}
                    <button className="asset-action-btn" onClick={handleShare}>
                        <ShareIcon /><span>Share</span>
                    </button>
                    <WorkflowMenu
                        assetName={assetName}
                        onTransitionComplete={refreshWorkflow}
                        trigger={
                            <button className="asset-action-btn asset-action-primary">
                                <WorkflowIcon /><span>Workflow</span>
                            </button>
                        }
                    />
                    <div className="header-divider" style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />
                    <button className="asset-action-btn" onClick={handleDownload}>
                        <DownloadIcon /><span>Download</span>
                    </button>

                </div>
            </div>

            {/* ── Workspace ── */}
            <div className="asset-workspace">
                {/* Media column */}
                <div className="asset-media-col">
                    {/* Floating toolbar */}
                    {!isVideo && (
                        <div className="annotation-toolbar">
                            <button
                                className={`toolbar-btn ${activeTool === 'cursor' ? 'active' : ''}`}
                                onClick={() => setActiveTool('cursor')}
                                title="Click to pin (V)"
                            >
                                <CursorIcon />
                            </button>
                            <div className="toolbar-divider" />
                            <button
                                className={`toolbar-btn ${activeTool === 'rect' ? 'active' : ''}`}
                                onClick={() => setActiveTool('rect')}
                                title="Rectangle select (R)"
                            >
                                <RectIcon />
                            </button>
                            <button
                                className={`toolbar-btn ${activeTool === 'pen' ? 'active' : ''}`}
                                onClick={() => setActiveTool('pen')}
                                title="Freehand draw (P)"
                            >
                                <PenIcon />
                            </button>
                        </div>
                    )}

                    <div
                        ref={containerRef}
                        className={`asset-canvas ${cursorClass}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => {
                            if (isDrawing) {
                                setIsDrawing(false);
                                setCurrentPath([]);
                            }
                        }}
                    >
                        {isVideo ? (
                            <video src={fileUrl} controls className="asset-media" onLoadedData={() => setImageLoaded(true)} />
                        ) : (
                            <img src={fileUrl} alt={asset.asset_title} className="asset-media" draggable={false} onLoad={() => setImageLoaded(true)} />
                        )}

                        {/* SVG annotations overlay */}
                        {imageLoaded && !isVideo && (
                            <svg className="annotator-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                                {annotations.map((ann) => {
                                    const type = getAnnType(ann);
                                    const isHovered = hoveredAnnotation === ann.id;

                                    if (type === 'freehand' && ann.path && ann.path.length > 1) {
                                        return (
                                            <path
                                                key={ann.id}
                                                d={toSvgPath(ann.path)}
                                                className={`annotation-freehand ${isHovered ? 'hovered' : ''}`}
                                                onMouseEnter={() => setHoveredAnnotation(ann.id)}
                                                onMouseLeave={() => setHoveredAnnotation(null)}
                                            />
                                        );
                                    }
                                    if (type === 'rect') {
                                        return (
                                            <rect
                                                key={ann.id}
                                                x={ann.x} y={ann.y}
                                                width={ann.width} height={ann.height}
                                                className={`annotation-rect ${isHovered ? 'hovered' : ''}`}
                                                onMouseEnter={() => setHoveredAnnotation(ann.id)}
                                                onMouseLeave={() => setHoveredAnnotation(null)}
                                            />
                                        );
                                    }
                                    // point
                                    return (
                                        <g key={ann.id}>
                                            <circle cx={ann.x} cy={ann.y} r="1.2"
                                                className={`annotation-pin ${isHovered ? 'hovered' : ''}`}
                                                onMouseEnter={() => setHoveredAnnotation(ann.id)}
                                                onMouseLeave={() => setHoveredAnnotation(null)}
                                            />
                                            <circle cx={ann.x} cy={ann.y} r="0.5" className="annotation-pin-center" />
                                        </g>
                                    );
                                })}

                                {/* Active rect selection */}
                                {selectionRect && (
                                    <rect
                                        x={selectionRect.x} y={selectionRect.y}
                                        width={selectionRect.width} height={selectionRect.height}
                                        className="selection-rect"
                                    />
                                )}

                                {/* Active freehand stroke */}
                                {isDrawing && currentPath.length > 1 && (
                                    <path
                                        d={toSvgPath(currentPath)}
                                        className="drawing-path"
                                    />
                                )}
                            </svg>
                        )}

                        {/* Pending annotation overlay */}
                        {pendingAnnotation && !isVideo && imageLoaded && (
                            <svg className="annotator-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                                {pendingAnnotation.annotation_type === 'freehand' && pendingAnnotation.path ? (
                                    <path d={toSvgPath(pendingAnnotation.path)} className="pending-freehand" />
                                ) : pendingAnnotation.width > 0 || pendingAnnotation.height > 0 ? (
                                    <rect x={pendingAnnotation.x} y={pendingAnnotation.y}
                                        width={pendingAnnotation.width} height={pendingAnnotation.height}
                                        fill="rgba(251,191,36,0.2)" stroke="#f59e0b" strokeWidth="0.3" strokeDasharray="1 0.5"
                                    />
                                ) : (
                                    <>
                                        <circle cx={pendingAnnotation.x} cy={pendingAnnotation.y} r="1.5"
                                            fill="rgba(251,191,36,0.6)" stroke="#f59e0b" strokeWidth="0.3"
                                        />
                                        <circle cx={pendingAnnotation.x} cy={pendingAnnotation.y} r="0.5" fill="#fff" />
                                    </>
                                )}
                            </svg>
                        )}

                        {/* Hover tooltip */}
                        {hoveredAnnotation && (() => {
                            const ann = annotations.find((a) => a.id === hoveredAnnotation);
                            if (!ann) return null;
                            return (
                                <div className="annotation-tooltip">
                                    <strong>{ann.author_name}</strong>
                                    <p>{ann.comment}</p>
                                    <span className="tooltip-time">{timeAgo(ann.timestamp)}</span>
                                </div>
                            );
                        })()}

                        {!imageLoaded && (
                            <div className="annotator-loading-overlay"><div className="loading-spinner" /></div>
                        )}
                    </div>

                    {/* Content Brief panel below canvas — editable */}
                    <div className="content-brief-panel">
                        <div className="content-brief-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                            </svg>
                            <span>Content Brief — Revision {annotationData?.message?.revision_number || 'Latest'}</span>
                            <div className="content-brief-actions">
                                {briefSaved && <span className="brief-saved-badge">✓ Saved</span>}
                                {briefDirty && (
                                    <button
                                        className="brief-save-btn"
                                        onClick={handleSaveBrief}
                                        disabled={briefSaving}
                                    >
                                        {briefSaving ? 'Saving…' : 'Save'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="content-brief-editor">
                            <ReactQuill
                                theme="snow"
                                value={editedBrief}
                                onChange={handleBriefChange}
                                placeholder="No content brief yet. Add the intended text or copy for this asset…"
                                modules={{
                                    toolbar: [
                                        ['bold', 'italic', 'underline'],
                                        [{ list: 'ordered' }, { list: 'bullet' }],
                                        ['link'],
                                        ['clean']
                                    ]
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar panel */}
                <div className="comments-panel">
                    <div className="sidebar-tabs">
                        <button
                            className={`tab-btn ${sidebarTab === 'comments' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('comments')}
                        >
                            <ChatIcon />
                            <span>Comments</span>
                            <span className="tab-count">{annotations.length}</span>
                        </button>
                        <button
                            className={`tab-btn ${sidebarTab === 'history' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('history')}
                        >
                            <HistoryIcon />
                            <span>History</span>
                            <span className="tab-count">{revisions.length}</span>
                        </button>
                    </div>

                    {sidebarTab === 'comments' ? (
                        <>
                            <div className="comments-header">
                                <h3>Team Discussion</h3>
                            </div>

                            <div className="comments-list">
                                {annotations.length === 0 ? (
                                    <div className="comments-empty">
                                        <p>No comments yet</p>
                                        <p className="comments-empty-hint">Click on the image to pin a comment, or use the draw tool.</p>
                                    </div>
                                ) : (
                                    annotations.map((ann) => {
                                        const type = getAnnType(ann);
                                        return (
                                            <div
                                                key={ann.id}
                                                className={`comment-card ${hoveredAnnotation === ann.id ? 'highlighted' : ''}`}
                                                onMouseEnter={() => setHoveredAnnotation(ann.id)}
                                                onMouseLeave={() => setHoveredAnnotation(null)}
                                            >
                                                <div className="comment-avatar">{getInitial(ann.author_name)}</div>
                                                <div className="comment-body">
                                                    <div className="comment-meta">
                                                        <span className="comment-author">{ann.author_name}</span>
                                                        {type === 'freehand' && <span className="comment-tool-badge">✏️ Drawing</span>}
                                                        {type === 'rect' && <span className="comment-tool-badge">▢ Area</span>}
                                                        <span className="comment-time">{timeAgo(ann.timestamp)}</span>
                                                    </div>
                                                    <p className="comment-text">{ann.comment}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        /* History Tab */
                        <div className="history-view">
                            <div className="comments-header">
                                <h3>Revision History</h3>
                            </div>
                            <div className="history-list">
                                {revisions.length === 0 ? (
                                    <div className="comments-empty">
                                        <p>No historical versions found.</p>
                                    </div>
                                ) : (
                                    revisions.map((rev) => (
                                        <div
                                            key={rev.name}
                                            className={`history-card clickable ${activeRevisionNum === rev.revision_number ? 'active' : ''} ${!activeRevisionNum && rev.revision_number === Math.max(...revisions.map(r => r.revision_number)) ? 'active' : ''}`}
                                            onClick={() => setActiveRevisionNum(rev.revision_number)}
                                        >
                                            <div className="history-rev-number">v{rev.revision_number}</div>
                                            <div className="history-body">
                                                <div className="history-meta">
                                                    <span className="history-user">{rev.owner}</span>
                                                    <span className="history-time">{timeAgo(rev.creation)}</span>
                                                </div>
                                                {rev.revision_notes && <p className="history-notes">{rev.revision_notes}</p>}
                                                <div className="history-actions">
                                                    <span className="view-link">View this version →</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {activeRevisionNum && (
                                <button className="back-to-latest-btn" onClick={() => setActiveRevisionNum(undefined)}>
                                    Show Latest Version
                                </button>
                            )}
                        </div>
                    )}

                    {/* Comment input */}
                    <div className="comment-input-area">
                        {pendingAnnotation && (
                            <div className="comment-pin-indicator">
                                <span className="pin-dot" />
                                <span>
                                    {pendingAnnotation.annotation_type === 'freehand'
                                        ? `Drawing attached (${pendingAnnotation.path?.length || 0} pts)`
                                        : pendingAnnotation.annotation_type === 'rect'
                                            ? `Area selected (${Math.round(pendingAnnotation.width)}% × ${Math.round(pendingAnnotation.height)}%)`
                                            : `Pin at (${Math.round(pendingAnnotation.x)}%, ${Math.round(pendingAnnotation.y)}%)`}
                                </span>
                                <button className="pin-clear" onClick={() => setPendingAnnotation(null)}>✕</button>
                            </div>
                        )}
                        <div className="comment-input-row" style={{ position: 'relative' }}>
                            {showMentions && mentionUsers.length > 0 && (
                                <div className="mentions-list">
                                    {mentionUsers.map(u => (
                                        <div key={u.name} className="mention-item" onClick={() => handleSelectMention(u)}>
                                            <img src={u.user_image || 'https://ui-avatars.com/api/?name=' + u.full_name} className="mention-avatar" alt={u.full_name} />
                                            <div>
                                                <div className="mention-name">{u.full_name}</div>
                                                <div className="mention-id">@{u.name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <textarea
                                ref={commentInputRef}
                                className="comment-textarea"
                                placeholder="Add a comment... Type @ to mention"
                                value={comment}
                                onChange={handleCommentChange}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />
                            <button
                                className="comment-send-btn"
                                onClick={handleSubmitComment}
                                disabled={!comment.trim() || submitting}
                            >
                                <SendIcon />
                            </button>
                        </div>
                        <span className="comment-hint">Cmd+Enter to send</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageAnnotator;
