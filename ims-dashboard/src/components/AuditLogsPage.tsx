import React, { useState } from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';

interface AuditEntry {
    name: string;
    document_type: string;
    document_name: string;
    user: string;
    user_fullname: string;
    action: string;
    details?: string;
    creation: string;
    log_type: string;
}

interface AuditLogsPageProps {
    refreshKey: number;
}

const actionFilters = ['All', 'Created', 'Modified', 'Workflow', 'Comment'];

const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ refreshKey }) => {
    const [filter, setFilter] = useState('All');

    const { data } = useFrappeGetCall<{ message: { logs: AuditEntry[] } }>(
        'ims.api.get_audit_logs',
        { limit: 50, action_filter: filter === 'All' ? '' : filter },
        `audit-logs-${refreshKey}-${filter}`,
    );

    const logs = data?.message?.logs || [];

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            + ' · '
            + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'Created': return <CreateIcon />;
            case 'Modified': return <EditIcon />;
            case 'Workflow': return <WorkflowIcon />;
            case 'Comment': return <CommentIcon />;
            default: return <ActivityIcon />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'Created': return '#10b981';
            case 'Modified': return '#3b82f6';
            case 'Workflow': return '#8b5cf6';
            case 'Comment': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    return (
        <div className="audit-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Audit Logs</h1>
                    <p className="page-subtitle">Track all changes and activities on your assets.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                {actionFilters.map((f) => (
                    <button
                        key={f}
                        className={`filter-tab ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Timeline */}
            <div className="audit-timeline">
                {logs.length === 0 ? (
                    <div className="panel-empty" style={{ padding: '60px 20px' }}>
                        <EmptyAuditIcon />
                        <p>No audit logs found.</p>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div className="audit-entry" key={log.name}>
                            <div className="audit-line">
                                <div className="audit-dot" style={{ background: getActionColor(log.action) }}>
                                    {getActionIcon(log.action)}
                                </div>
                            </div>
                            <div className="audit-content">
                                <div className="audit-header">
                                    <span className="audit-action" style={{ color: getActionColor(log.action) }}>
                                        {log.action}
                                    </span>
                                    <span className="audit-doc">
                                        {log.document_type} · {log.document_name}
                                    </span>
                                </div>
                                {log.details && (
                                    <p className="audit-details">{log.details}</p>
                                )}
                                <div className="audit-meta">
                                    <span className="audit-user">{log.user_fullname || log.user}</span>
                                    <span className="audit-time">{formatTime(log.creation)}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// SVG Icons
function CreateIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function EditIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function WorkflowIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /></svg>;
}
function CommentIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function ActivityIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function EmptyAuditIcon() {
    return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
}

export default AuditLogsPage;
