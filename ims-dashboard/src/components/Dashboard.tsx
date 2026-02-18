import React from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';

interface DashboardSummary {
    draft: number;
    peer_review: number;
    hod_approval: number;
    final_signoff: number;
    approved: number;
    rejected: number;
    total: number;
}

interface RecentAsset {
    name: string;
    asset_title: string;
    campaign: string;
    status: string;
    category: string;
    latest_file: string;
    creation: string;
}

interface RecentUpload {
    file_name: string;
    display_name: string;
    file_url: string;
    file_size: number;
    creation: string;
    asset_name?: string;
    asset_title?: string;
}

interface DashboardProps {
    onAssetClick: (assetName: string) => void;
    onNavigate: (page: string) => void;
    refreshKey: number;
}

const statusColors: Record<string, string> = {
    Draft: '#6b7280',
    'Peer Review': '#3b82f6',
    'HOD Approval': '#f59e0b',
    'Final Sign-off': '#8b5cf6',
    Approved: '#10b981',
    Rejected: '#ef4444',
};

const Dashboard: React.FC<DashboardProps> = ({ onAssetClick, onNavigate, refreshKey }) => {
    const { data: summaryData } = useFrappeGetCall<{ message: DashboardSummary }>(
        'ims.api.get_dashboard_summary',
        undefined,
        `dashboard-summary-${refreshKey}`,
    );

    const { data: assetsData } = useFrappeGetCall<{ message: { assets: RecentAsset[] } }>(
        'ims.api.get_recent_assets',
        { limit: 6 },
        `recent-assets-${refreshKey}`,
    );

    const { data: uploadsData } = useFrappeGetCall<{ message: { uploads: RecentUpload[] } }>(
        'ims.api.get_recent_uploads',
        { limit: 5 },
        `recent-uploads-${refreshKey}`,
    );

    const summary = summaryData?.message;
    const assets = assetsData?.message?.assets || [];
    const uploads = uploadsData?.message?.uploads || [];

    const statusCards = [
        { label: 'Draft', value: summary?.draft ?? 0, color: '#6b7280', icon: DraftIcon },
        { label: 'In Review', value: (summary?.peer_review ?? 0) + (summary?.hod_approval ?? 0), color: '#3b82f6', icon: ReviewIcon },
        { label: 'Approved', value: summary?.approved ?? 0, color: '#10b981', icon: ApprovedIcon },
        { label: 'Rejected', value: summary?.rejected ?? 0, color: '#ef4444', icon: RejectedIcon },
        { label: 'Total Assets', value: summary?.total ?? 0, color: '#8b5cf6', icon: TotalIcon },
    ];

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatFileSize = (bytes: number): string => {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isImage = (url: string) => {
        if (!url) return false;
        return /\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|$)/i.test(url);
    };

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p className="page-subtitle">Overview of your marketing assets and recent activity.</p>
                </div>
            </div>

            {/* Status Cards */}
            <div className="status-cards">
                {statusCards.map((card) => (
                    <div className="status-card" key={card.label}>
                        <div className="card-header">
                            <span className="card-icon-svg" style={{ color: card.color }}><card.icon /></span>
                            <span className="card-label">{card.label}</span>
                        </div>
                        <span className="card-value">{card.value}</span>
                    </div>
                ))}
            </div>

            {/* Two-Column Layout */}
            <div className="dashboard-panels">
                {/* Recent Assets */}
                <div className="panel">
                    <div className="panel-header">
                        <h3 className="panel-title">Recent Assets</h3>
                        <button className="panel-link" onClick={() => onNavigate('assets')}>View all →</button>
                    </div>
                    <div className="panel-list">
                        {assets.length === 0 ? (
                            <div className="panel-empty">
                                <EmptyAssetsIcon />
                                <p>No assets yet. Click <strong>Upload</strong> to add your first asset.</p>
                            </div>
                        ) : (
                            assets.map((asset) => (
                                <div
                                    className="panel-item clickable"
                                    key={asset.name}
                                    onClick={() => onAssetClick(asset.name)}
                                >
                                    <div className="item-left">
                                        {isImage(asset.latest_file) ? (
                                            <img
                                                className="item-thumb"
                                                src={asset.latest_file}
                                                alt={asset.asset_title}
                                                loading="lazy"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <span className={`item-thumb-fallback ${isImage(asset.latest_file) ? 'hidden' : ''}`}>
                                            <FileImageIcon />
                                        </span>
                                        <div className="item-info">
                                            <span className="item-title">{asset.asset_title}</span>
                                            <span className="item-meta">{asset.name} · {formatDate(asset.creation)}</span>
                                        </div>
                                    </div>
                                    <span
                                        className="status-badge"
                                        style={{ background: statusColors[asset.status] || '#6b7280' }}
                                    >
                                        {asset.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Uploads */}
                <div className="panel">
                    <div className="panel-header">
                        <h3 className="panel-title">Recent Uploads</h3>
                    </div>
                    <div className="panel-list">
                        {uploads.length === 0 ? (
                            <div className="panel-empty">
                                <EmptyUploadsIcon />
                                <p>No uploads yet.</p>
                            </div>
                        ) : (
                            uploads.map((upload, idx) => (
                                <div className="panel-item" key={upload.file_name || idx}>
                                    <div className="item-left">
                                        {isImage(upload.file_url) ? (
                                            <img
                                                className="item-thumb"
                                                src={upload.file_url}
                                                alt={upload.display_name}
                                                loading="lazy"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <span className={`item-thumb-fallback ${isImage(upload.file_url) ? 'hidden' : ''}`}>
                                            <FileIcon />
                                        </span>
                                        <div className="item-info">
                                            <span className="item-title">{upload.display_name}</span>
                                            <span className="item-meta">
                                                {upload.asset_name || ''} · {formatDate(upload.creation)}
                                                {upload.file_size ? ` · ${formatFileSize(upload.file_size)}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="type-badge">Asset</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SVG Icon Components ---
function DraftIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function ReviewIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
function ApprovedIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function RejectedIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
}
function TotalIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function FileImageIcon() {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
}
function FileIcon() {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function EmptyAssetsIcon() {
    return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
}
function EmptyUploadsIcon() {
    return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}

export default Dashboard;
