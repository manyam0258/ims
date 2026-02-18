import React, { useState } from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';

interface Notification {
    name: string;
    subject: string;
    type: string;
    document_type: string;
    document_name: string;
    from_user: string;
    read: number;
    creation: string;
}

interface NotificationsPageProps {
    refreshKey: number;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ refreshKey }) => {
    const [markingRead, setMarkingRead] = useState(false);
    const [localRefresh, setLocalRefresh] = useState(0);

    const { data } = useFrappeGetCall<{ message: { notifications: Notification[]; unread_count: number } }>(
        'ims.api.get_notifications',
        { limit: 30 },
        `notifications-${refreshKey}-${localRefresh}`,
    );

    const notifications = data?.message?.notifications || [];
    const unreadCount = data?.message?.unread_count || 0;

    const handleMarkAllRead = async () => {
        setMarkingRead(true);
        try {
            await fetch('/api/method/ims.api.mark_notifications_read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Frappe-CSRF-Token': (window as any).csrf_token || getCsrfToken(),
                },
            });
            setLocalRefresh((r) => r + 1);
        } catch { /* ignore */ }
        finally { setMarkingRead(false); }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getTypeIcon = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'workflow': return <WorkflowIcon />;
            case 'assignment': return <AssignIcon />;
            case 'comment': return <CommentIcon />;
            case 'like': return <LikeIcon />;
            default: return <InfoIcon />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'workflow': return '#8b5cf6';
            case 'assignment': return '#f59e0b';
            case 'comment': return '#3b82f6';
            case 'like': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Notifications</h1>
                    <p className="page-subtitle">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn-secondary" onClick={handleMarkAllRead} disabled={markingRead}>
                        <CheckIcon />
                        {markingRead ? 'Marking...' : 'Mark all read'}
                    </button>
                )}
            </div>

            <div className="notifications-list">
                {notifications.length === 0 ? (
                    <div className="panel-empty" style={{ padding: '60px 20px' }}>
                        <BellEmptyIcon />
                        <p>No notifications yet.</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div className={`notification-item ${!n.read ? 'unread' : ''}`} key={n.name}>
                            <div className="notif-icon" style={{ color: getTypeColor(n.type) }}>
                                {getTypeIcon(n.type)}
                            </div>
                            <div className="notif-content">
                                <p className="notif-subject" dangerouslySetInnerHTML={{ __html: stripHtml(n.subject) }} />
                                <div className="notif-meta">
                                    {n.document_type && n.document_name && (
                                        <span className="notif-ref">{n.document_type}: {n.document_name}</span>
                                    )}
                                    <span className="notif-time">{formatTime(n.creation)}</span>
                                </div>
                            </div>
                            {!n.read && <span className="notif-dot" />}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').substring(0, 200);
}

function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf_token"]');
    return meta ? meta.getAttribute('content') || '' : '';
}

// SVG Icons
function WorkflowIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>;
}
function AssignIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>;
}
function CommentIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function LikeIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function InfoIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function CheckIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function BellEmptyIcon() {
    return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}

export default NotificationsPage;
