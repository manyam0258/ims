import React, { useState, useMemo } from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';
import { WorkflowMenu } from './WorkflowMenu';

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

type StatusFilter = '' | 'Draft' | 'In Review' | 'Approved' | 'Rejected';
type ViewMode = 'list' | 'kanban';

const Dashboard: React.FC<DashboardProps> = ({ onAssetClick, refreshKey }) => {
    const [activeFilter, setActiveFilter] = useState<StatusFilter>('');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [showAll, setShowAll] = useState(false);

    const assetLimit = showAll ? 0 : 6;

    const { data: summaryData, mutate: refreshSummary } = useFrappeGetCall<{ message: DashboardSummary }>(
        'ims.api.get_dashboard_summary',
        undefined,
        `dashboard-summary-${refreshKey}`,
    );

    const { data: assetsData, mutate: refreshAssets } = useFrappeGetCall<{ message: { assets: RecentAsset[] } }>(
        'ims.api.get_recent_assets',
        { limit: assetLimit, status_filter: activeFilter },
        `recent-assets-${refreshKey}-${activeFilter}-${assetLimit}`,
    );

    const summary = summaryData?.message;
    const assets = assetsData?.message?.assets || [];

    const statusCards = useMemo(() => [
        { label: 'Draft', filterKey: 'Draft' as StatusFilter, value: summary?.draft ?? 0, color: '#6b7280', icon: DraftIcon },
        { label: 'In Review', filterKey: 'In Review' as StatusFilter, value: (summary?.peer_review ?? 0) + (summary?.hod_approval ?? 0) + (summary?.final_signoff ?? 0), color: '#3b82f6', icon: ReviewIcon },
        { label: 'Approved', filterKey: 'Approved' as StatusFilter, value: summary?.approved ?? 0, color: '#10b981', icon: ApprovedIcon },
        { label: 'Rejected', filterKey: 'Rejected' as StatusFilter, value: summary?.rejected ?? 0, color: '#ef4444', icon: RejectedIcon },
        { label: 'Total Assets', filterKey: '' as StatusFilter, value: summary?.total ?? 0, color: '#8b5cf6', icon: TotalIcon },
    ], [summary]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isImage = (url: string) => {
        if (!url) return false;
        return /\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|$)/i.test(url);
    };

    const handleWorkflowChange = () => {
        refreshAssets();
        refreshSummary();
    };

    const handleFilterClick = (filterKey: StatusFilter) => {
        setActiveFilter((prev) => (prev === filterKey ? '' : filterKey));
    };

    const handleToggleShowAll = () => {
        setShowAll((prev) => !prev);
    };

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Assets</h1>
                    <p className="page-subtitle">All your marketing assets in one place.</p>
                </div>
            </div>

            {/* Filterable Status Cards */}
            <div className="status-cards">
                {statusCards.map((card) => (
                    <div
                        className={`status-card clickable ${activeFilter === card.filterKey ? 'active' : ''}`}
                        key={card.label}
                        onClick={() => handleFilterClick(card.filterKey)}
                        style={activeFilter === card.filterKey ? { borderColor: card.color, boxShadow: `0 0 0 2px ${card.color}22` } : undefined}
                    >
                        <div className="card-header">
                            <span className="card-icon-svg" style={{ color: card.color }}><card.icon /></span>
                            <span className="card-label">{card.label}</span>
                        </div>
                        <span className="card-value">{card.value}</span>
                        {activeFilter === card.filterKey && (
                            <span className="card-filter-indicator" style={{ color: card.color }}>✓ Filtered</span>
                        )}
                    </div>
                ))}
            </div>

            {/* View Toggle + View All */}
            <div className="assets-toolbar">
                <div className="assets-toolbar-left">
                    <h3 className="panel-title">{showAll ? 'All Assets' : 'Recent Assets'}</h3>
                    {activeFilter && (
                        <span className="active-filter-badge" style={{ background: statusCards.find(c => c.filterKey === activeFilter)?.color || '#6b7280' }}>
                            {activeFilter}
                            <button className="filter-clear-btn" onClick={(e) => { e.stopPropagation(); setActiveFilter(''); }}>×</button>
                        </span>
                    )}
                </div>
                <div className="assets-toolbar-right">
                    <div className="view-toggle">
                        <button
                            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <ListIcon />
                        </button>
                        <button
                            className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                            onClick={() => setViewMode('kanban')}
                            title="Card View"
                        >
                            <GridIcon />
                        </button>
                    </div>
                    <button className="panel-link" onClick={handleToggleShowAll}>
                        {showAll ? '← Show recent' : 'View all →'}
                    </button>
                </div>
            </div>

            {/* Assets — List or Kanban */}
            {viewMode === 'list' ? (
                <div className="assets-section">
                    <div className="panel-list">
                        {assets.length === 0 ? (
                            <div className="panel-empty">
                                <EmptyAssetsIcon />
                                <p>{activeFilter ? `No ${activeFilter.toLowerCase()} assets found.` : 'No assets yet. Click Upload to add your first asset.'}</p>
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
                                    <WorkflowMenu
                                        assetName={asset.name}
                                        asBadge={true}
                                        onTransitionComplete={handleWorkflowChange}
                                        trigger={
                                            <span
                                                className="status-badge"
                                                style={{ background: statusColors[asset.status] || '#6b7280', cursor: 'pointer' }}
                                            >
                                                {asset.status}
                                            </span>
                                        }
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* Kanban / Card Grid View */
                <div className="kanban-grid">
                    {assets.length === 0 ? (
                        <div className="panel-empty wide">
                            <EmptyAssetsIcon />
                            <p>{activeFilter ? `No ${activeFilter.toLowerCase()} assets found.` : 'No assets yet. Click Upload to add your first asset.'}</p>
                        </div>
                    ) : (
                        assets.map((asset) => (
                            <div className="kanban-card" key={asset.name}>
                                {/* Thumbnail */}
                                <div className="kanban-card-thumb" onClick={() => onAssetClick(asset.name)}>
                                    {isImage(asset.latest_file) ? (
                                        <img
                                            src={asset.latest_file}
                                            alt={asset.asset_title}
                                            loading="lazy"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}
                                    <span className={`kanban-thumb-fallback ${isImage(asset.latest_file) ? 'hidden' : ''}`}>
                                        <FileImageIcon />
                                    </span>
                                </div>

                                {/* Card Body */}
                                <div className="kanban-card-body">
                                    <span className="kanban-card-title" onClick={() => onAssetClick(asset.name)}>
                                        {asset.asset_title}
                                    </span>
                                    <span className="kanban-card-meta">{asset.name} · {formatDate(asset.creation)}</span>
                                    {asset.campaign && <span className="kanban-card-campaign">{asset.campaign}</span>}
                                </div>

                                {/* Card Footer — Workflow clearly visible */}
                                <div className="kanban-card-footer">
                                    <WorkflowMenu
                                        assetName={asset.name}
                                        asBadge={true}
                                        onTransitionComplete={handleWorkflowChange}
                                        trigger={
                                            <span
                                                className="status-badge kanban-status-badge"
                                                style={{ background: statusColors[asset.status] || '#6b7280', cursor: 'pointer' }}
                                            >
                                                {asset.status}
                                            </span>
                                        }
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
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
function EmptyAssetsIcon() {
    return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
}
function ListIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function GridIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
}

export default Dashboard;
