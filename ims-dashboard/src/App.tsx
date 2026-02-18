import { useState, useCallback, useEffect } from 'react'
import './App.css'
import { FrappeProvider, useFrappeAuth } from 'frappe-react-sdk'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './components/Dashboard'
import ProjectsPage from './components/ProjectsPage'
import NotificationsPage from './components/NotificationsPage'
import AuditLogsPage from './components/AuditLogsPage'
import SettingsPage from './components/SettingsPage'
import UploadModal from './components/UploadModal'
import ImageAnnotator from './components/ImageAnnotator'

function AppContent() {
	const { currentUser } = useFrappeAuth();
	const [activePage, setActivePage] = useState('dashboard');
	const [uploadOpen, setUploadOpen] = useState(false);
	const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	// Dark mode — persisted in localStorage, defaults to system preference
	const [darkMode, setDarkMode] = useState(() => {
		const stored = localStorage.getItem('ims-dark-mode');
		if (stored !== null) return stored === 'true';
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	});

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
		localStorage.setItem('ims-dark-mode', String(darkMode));
	}, [darkMode]);

	const handleUploadSuccess = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const handleAssetClick = useCallback((assetName: string) => {
		setSelectedAsset(assetName);
		setActivePage('annotator');
	}, []);

	const handleBack = useCallback(() => {
		setSelectedAsset(null);
		setActivePage('dashboard');
		setRefreshKey((k) => k + 1);
	}, []);

	const handleNavigate = useCallback((page: string) => {
		setActivePage(page);
		setSelectedAsset(null);
	}, []);

	const handleProjectClick = useCallback((_name: string) => {
		// TODO: navigate to project detail/filter assets by project
	}, []);

	const userName = currentUser
		? currentUser.split('@')[0].replace(/[._]/g, ' ')
		: 'User';

	const renderPage = () => {
		if (activePage === 'annotator' && selectedAsset) {
			return (
				<ImageAnnotator assetName={selectedAsset} onBack={handleBack} />
			);
		}

		switch (activePage) {
			case 'projects':
				return (
					<ProjectsPage
						onProjectClick={handleProjectClick}
						refreshKey={refreshKey}
					/>
				);
			case 'notifications':
				return <NotificationsPage refreshKey={refreshKey} />;
			case 'audit':
				return <AuditLogsPage refreshKey={refreshKey} />;
			case 'settings':
				return (
					<SettingsPage
						darkMode={darkMode}
						onToggleDarkMode={() => setDarkMode((d) => !d)}
					/>
				);
			case 'assets':
			case 'dashboard':
			default:
				return (
					<Dashboard
						onAssetClick={handleAssetClick}
						onNavigate={handleNavigate}
						refreshKey={refreshKey}
					/>
				);
		}
	};

	return (
		<div className="app-shell">
			<Sidebar
				activePage={activePage}
				onNavigate={handleNavigate}
				userName={userName}
				darkMode={darkMode}
				onToggleDarkMode={() => setDarkMode((d) => !d)}
				refreshKey={refreshKey}
			/>

			<div className="main-area">
				<TopBar
					onUploadClick={() => setUploadOpen(true)}
					onAssetClick={handleAssetClick}
					onProjectClick={handleProjectClick}
				/>

				<main className="content">
					{renderPage()}
				</main>
			</div>

			<UploadModal
				isOpen={uploadOpen}
				onClose={() => setUploadOpen(false)}
				onSuccess={handleUploadSuccess}
			/>
		</div>
	);
}

function App() {
	return (
		<FrappeProvider>
			<AppContent />
		</FrappeProvider>
	);
}

export default App
