import React, { useState, useRef, useEffect } from 'react';
import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk';

interface WorkflowAction {
    action: string;
    next_state: string;
    style: 'primary' | 'danger' | 'default';
}

interface WorkflowMenuProps {
    assetName: string;
    currentState?: string;
    onTransitionComplete?: () => void;
    trigger: React.ReactNode;
    asBadge?: boolean;
}

export const WorkflowMenu: React.FC<WorkflowMenuProps> = ({
    assetName,
    currentState,
    onTransitionComplete,
    trigger,
    asBadge = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Lazy fetch transitions only when open
    const { data, isLoading } = useFrappeGetCall<{ message: { transitions: WorkflowAction[] } }>(
        'ims.api.get_workflow_transitions',
        { marketing_asset: assetName },
        isOpen ? `workflow-transitions-${assetName}` : null
    );

    const { call: applyWorkflow, loading: isApplying } = useFrappePostCall('ims.api.apply_workflow_transition');

    const transitions = data?.message?.transitions || [];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAction = async (action: string) => {
        try {
            await applyWorkflow({ marketing_asset: assetName, action });
            setIsOpen(false);
            if (onTransitionComplete) onTransitionComplete();
        } catch (error) {
            console.error('Workflow transition failed', error);
        }
    };

    return (
        <div className="workflow-menu-container" ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <div onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                {trigger}
            </div>

            {isOpen && (
                <div className="workflow-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    right: asBadge ? 'auto' : 0,
                    left: asBadge ? 0 : 'auto',
                    marginTop: '8px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    minWidth: '180px',
                    overflow: 'hidden',
                    padding: '4px'
                }}>
                    {isLoading ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading...</div>
                    ) : transitions.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No actions available</div>
                    ) : (
                        transitions.map((t) => (
                            <button
                                key={t.action}
                                onClick={(e) => { e.stopPropagation(); handleAction(t.action); }}
                                disabled={isApplying}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                    border: 'none',
                                    background: 'transparent',
                                    color: t.style === 'danger' ? 'var(--error-text)' : 'var(--text)',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-xs)',
                                    transition: 'background 0.1s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {t.action}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
