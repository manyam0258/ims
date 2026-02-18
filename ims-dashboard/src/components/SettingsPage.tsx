import React from 'react';
import { useFrappeAuth } from 'frappe-react-sdk';

interface SettingsPageProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ darkMode, onToggleDarkMode }) => {
    const { currentUser } = useFrappeAuth();

    return (
        <div className="settings-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Settings</h1>
                    <p className="page-subtitle">Manage your preferences and account settings.</p>
                </div>
            </div>

            {/* Appearance */}
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <AppearanceIcon /> Appearance
                </h3>
                <div className="settings-card">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Dark Mode</span>
                            <span className="setting-description">Switch between light and dark color schemes.</span>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={darkMode} onChange={onToggleDarkMode} />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Account */}
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <UserIcon /> Account
                </h3>
                <div className="settings-card">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Email</span>
                            <span className="setting-description">{currentUser || 'Not signed in'}</span>
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Role</span>
                            <span className="setting-description">System Manager</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <LinkIcon /> Quick Links
                </h3>
                <div className="settings-card">
                    <a className="settings-link" href="/app/ims-marketing-asset" target="_blank" rel="noopener">
                        <ExternalIcon /> All Marketing Assets (Frappe)
                    </a>
                    <a className="settings-link" href="/app/ims-project" target="_blank" rel="noopener">
                        <ExternalIcon /> All Projects (Frappe)
                    </a>
                    <a className="settings-link" href="/app/workflow" target="_blank" rel="noopener">
                        <ExternalIcon /> Workflow Configuration
                    </a>
                    <a className="settings-link" href="/app/user" target="_blank" rel="noopener">
                        <ExternalIcon /> User Management
                    </a>
                </div>
            </div>

            {/* About */}
            <div className="settings-section">
                <h3 className="settings-section-title">
                    <InfoIcon /> About
                </h3>
                <div className="settings-card">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Image Management System (IMS)</span>
                            <span className="setting-description">
                                v1.0.0 — A marketing asset review and annotation platform built on Frappe.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// SVG Icons
function AppearanceIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
}
function UserIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function LinkIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
}
function ExternalIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
function InfoIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}

export default SettingsPage;
