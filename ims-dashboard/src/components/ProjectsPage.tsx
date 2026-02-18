import React, { useState } from 'react';
import { useFrappeGetCall } from 'frappe-react-sdk';

interface Project {
    name: string;
    project_title: string;
    status: string;
    due_date: string;
    owner_user: string;
    description: string;
    creation: string;
}

interface ProjectsPageProps {
    onProjectClick: (projectName: string) => void;
    refreshKey: number;
}

const statusColors: Record<string, string> = {
    Open: '#3b82f6',
    'In Progress': '#f59e0b',
    Completed: '#10b981',
    Cancelled: '#6b7280',
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ onProjectClick, refreshKey }) => {
    const [filterStatus, setFilterStatus] = useState('All');

    const { data } = useFrappeGetCall<{ message: Project[] }>(
        'frappe.client.get_list',
        {
            doctype: 'IMS Project',
            fields: ['name', 'project_title', 'status', 'due_date', 'owner_user', 'description', 'creation'],
            order_by: 'creation DESC',
            limit_page_length: 50,
        },
        `projects-list-${refreshKey}`,
    );

    const projects = data?.message || [];

    const filtered = filterStatus === 'All'
        ? projects
        : projects.filter((p) => p.status === filterStatus);

    const statusCounts: Record<string, number> = { All: projects.length };
    for (const p of projects) {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }

    const formatDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="projects-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Projects</h1>
                    <p className="page-subtitle">Organize assets into projects with status tracking.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                {['All', 'Open', 'In Progress', 'Completed'].map((status) => (
                    <button
                        key={status}
                        className={`filter-tab ${filterStatus === status ? 'active' : ''}`}
                        onClick={() => setFilterStatus(status)}
                    >
                        {status}
                        <span className="tab-count">{statusCounts[status] || 0}</span>
                    </button>
                ))}
            </div>

            {/* Projects Grid */}
            <div className="projects-grid">
                {filtered.length === 0 ? (
                    <div className="panel-empty wide">
                        <span className="empty-icon">📂</span>
                        <p>No projects found. Create one from the Frappe admin panel.</p>
                    </div>
                ) : (
                    filtered.map((project) => (
                        <div
                            className="project-card clickable"
                            key={project.name}
                            onClick={() => onProjectClick(project.name)}
                        >
                            <div className="project-card-header">
                                <h3 className="project-title">{project.project_title}</h3>
                                <span
                                    className="status-badge small"
                                    style={{ background: statusColors[project.status] || '#6b7280' }}
                                >
                                    {project.status}
                                </span>
                            </div>
                            <p className="project-description">
                                {project.description || 'No description provided.'}
                            </p>
                            <div className="project-card-footer">
                                <span className="project-meta">
                                    {project.name}
                                </span>
                                {project.due_date && (
                                    <span className="project-due">
                                        Due: {formatDate(project.due_date)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProjectsPage;
