import React, { useState } from 'react';

interface AnnotationModalProps {
    isOpen: boolean;
    position: { x: number; y: number; width: number; height: number };
    onSubmit: (comment: string) => void;
    onClose: () => void;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({
    isOpen,
    position,
    onSubmit,
    onClose,
}) => {
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit(comment);
            setComment('');
        } finally {
            setSubmitting(false);
        }
    };

    const isArea = position.width > 0 || position.height > 0;

    return (
        <div className="annotation-modal-overlay" onClick={onClose}>
            <div
                className="annotation-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="annotation-modal-header">
                    <h3>Add Annotation</h3>
                    <button className="annotation-modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="annotation-modal-meta">
                    <span className="annotation-type-badge">
                        {isArea ? '📐 Area Selection' : '📍 Point Marker'}
                    </span>
                    <span className="annotation-coords">
                        ({Math.round(position.x)}%, {Math.round(position.y)}%)
                        {isArea &&
                            ` — ${Math.round(position.width)}% × ${Math.round(position.height)}%`}
                    </span>
                </div>

                <textarea
                    className="annotation-textarea"
                    placeholder="Enter your feedback or suggestion..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    autoFocus
                />

                <div className="annotation-modal-footer">
                    <button
                        className="btn-cancel"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn-submit"
                        onClick={handleSubmit}
                        disabled={!comment.trim() || submitting}
                    >
                        {submitting ? 'Saving...' : 'Save Annotation'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnotationModal;
