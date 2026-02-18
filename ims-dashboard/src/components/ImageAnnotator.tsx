import React, { useRef, useState, useCallback } from 'react';
import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk';

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
}

interface WorkflowAction {
    action: string;
    next_state: string;
    style: 'primary' | 'danger' | 'default';
}

interface WorkflowResponse {
    status: string;
    current_state: string;
    transitions: WorkflowAction[];

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
const SortIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="16" y2="6" /><line x1="4" y1="12" x2="12" y2="12" /><line x1="4" y1="18" x2="8" y2="18" />
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

/* ── Component ── */
const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ assetName, onBack }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    // Tool state
    const [activeTool, setActiveTool] = useState<ToolMode>('cursor');

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

    // Fetch asset
    const { data: assetData } = useFrappeGetCall<{
        message: { latest_file: string; asset_title: string; campaign: string; category: string; status: string };
    }>('frappe.client.get', { doctype: 'IMS Marketing Asset', name: assetName });

    const { data: annotationData, mutate: refreshAnnotations } = useFrappeGetCall<{ message: AnnotationData }>(
        'ims.api.get_annotations', { marketing_asset: assetName }
    );

    // Fetch workflow transitions
    const { data: workflowData, mutate: refreshWorkflow } = useFrappeGetCall<{ message: WorkflowResponse }>(
        'ims.api.get_workflow_transitions', { marketing_asset: assetName }
    );

    const { call: submitAnnotation } = useFrappePostCall('ims.api.submit_annotation');
    const { call: applyWorkflow } = useFrappePostCall('ims.api.apply_workflow_transition');

    const asset = assetData?.message;
    const annotations = annotationData?.message?.annotations || [];
    const workflowTransitions = workflowData?.message?.transitions || [];
    const currentWorkflowState = workflowData?.message?.current_state || asset?.status;

    const fileUrl = asset?.latest_file || '';
    const isVideo = isVideoFile(fileUrl);

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
            if (isVideo) return;
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
            if (isVideo) return;
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
            if (isVideo) return;

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

    const handleWorkflowAction = async (action: string) => {
        try {
            await applyWorkflow({ marketing_asset: assetName, action });
            refreshWorkflow();
            // Refresh asset data to update status badge if needed, though we use currentWorkflowState
        } catch (e) {
            console.error('Workflow action failed', e);
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
                    {workflowTransitions.map((t) => (
                        <button
                            key={t.action}
                            className={`asset-action-btn ${t.style === 'primary' ? 'asset-action-primary' : t.style === 'danger' ? 'asset-action-danger' : ''}`}
                            onClick={() => handleWorkflowAction(t.action)}
                        >
                            {t.action}
                        </button>
                    ))}
                    <div className="header-divider" style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />
                    <button className="asset-action-btn" onClick={handleShare}>
                        <ShareIcon /><span>Share</span>
                    </button>
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
                </div>

                {/* Comments panel */}
                <div className="comments-panel">
                    <div className="comments-header">
                        <h3>Comments ({annotations.length})</h3>
                        <button className="comments-sort-btn"><SortIcon /><span>Recent</span></button>
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
                        <div className="comment-input-row">
                            <textarea
                                ref={commentInputRef}
                                className="comment-textarea"
                                placeholder="Add a comment... Type @ to mention"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
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
