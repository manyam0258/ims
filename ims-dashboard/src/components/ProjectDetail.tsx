import React from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';

interface Asset {
    name: string;
    asset_title: string;
    status: string;
    latest_file: string;
    category: string;
    creation: string;
}

interface ProjectDetailProps {
    projectName: string;
    onBack: () => void;
    onAssetClick: (assetName: string) => void;
}

const statusColors: Record<string, string> = {
    Draft: '#6b7280',
    'Peer Review': '#3b82f6',
    'HOD Approval': '#f59e0b',
    'Final Sign-off': '#8b5cf6',
    Approved: '#10b981',
    Rejected: '#ef4444',
    // Project statuses
    'Active': '#10b981',
    'Completed': '#3b82f6',
    'On Hold': '#f59e0b',
    'Cancelled': '#ef4444',
};

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectName, onBack, onAssetClick }) => {
    const { data } = useFrappeGetCall<{ message: { project: any; assets: Asset[] } }>(
        'ims.api.get_project_details',
        { name: projectName },
        `project-detail-${projectName}`
    );

    const project = data?.message?.project;
    const assets = data?.message?.assets || [];

    const isImage = (url: string) => {
        if (!url) return false;
        return /\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|$)/i.test(url);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (!project) {
        return (
            <div className="project-detail-loading">
                <div className="loading-spinner"></div>
                <p>Loading project details...</p>
            </div>
        );
    }

    const stats = {
        total: assets.length,
        approved: assets.filter(a => a.status === 'Approved').length,
        inReview: assets.filter(a => ['Peer Review', 'HOD Approval', 'Final Sign-off'].includes(a.status)).length
    };

    return (
        <div className="project-detail-page">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn-back" onClick={onBack}>
                        <BackIcon />
                    </button>
                    <div>
                        <div className="project-title-row">
                            <h1>{project.project_title}</h1>
                            <span className="status-badge" style={{ background: statusColors[project.status] || '#6b7280' }}>
                                {project.status}
                            </span>
                        </div>
                        <p className="page-subtitle">{project.description || 'No description provided.'}</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <div className="project-meta-item">
                        <span className="meta-label">Due Date</span>
                        <span className="meta-value">{formatDate(project.due_date) || '—'}</span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="project-stats">
                <div className="stat-card">
                    <span className="stat-label">Total Assets</span>
                    <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">In Review</span>
                    <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.inReview}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Approved</span>
                    <span className="stat-value" style={{ color: '#10b981' }}>{stats.approved}</span>
                </div>
            </div>

            {/* Assets Grid */}
            <div className="project-assets-section">
                <h3>Project Assets</h3>
                <div className="assets-grid">
                    {assets.length === 0 ? (
                        <div className="panel-empty">
                            <EmptyAssetsIcon />
                            <p>No assets in this project yet.</p>
                        </div>
                    ) : (
                        assets.map((asset) => (
                            <div className="asset-card" key={asset.name} onClick={() => onAssetClick(asset.name)}>
                                <div className="asset-thumb">
                                    {isImage(asset.latest_file) ? (
                                        <img src={asset.latest_file} alt={asset.asset_title} loading="lazy" />
                                    ) : (
                                        <div className="asset-thumb-fallback"><FileIcon /></div>
                                    )}
                                    <span className="asset-status-tag" style={{ background: statusColors[asset.status] }}>
                                        {asset.status}
                                    </span>
                                </div>
                                <div className="asset-info">
                                    <span className="asset-title">{asset.asset_title}</span>
                                    <span className="asset-meta">{formatDate(asset.creation)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Icons since we don't have a shared icon library yet
const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
);

const FileIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);

const EmptyAssetsIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
);

export default ProjectDetail;
