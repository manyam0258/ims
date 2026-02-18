import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TopBarProps {
    onUploadClick: () => void;
    onAssetClick: (assetName: string) => void;
    onProjectClick: (projectName: string) => void;
}

interface SearchResult {
    name: string;
    title: string;
    type: 'asset' | 'project';
    status?: string;
    latest_file?: string;
}

const TopBar: React.FC<TopBarProps> = ({ onUploadClick, onAssetClick, onProjectClick }) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Keyboard shortcut: Ctrl/Cmd + K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (searchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
        }
    }, [searchOpen]);

    // Debounced search
    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/method/ims.api.search_assets?query=${encodeURIComponent(q)}&limit=10`, {
                headers: { 'X-Frappe-CSRF-Token': (window as any).csrf_token || getCsrfToken() },
            });
            const data = await res.json();
            if (data.message) {
                const mapped: SearchResult[] = [
                    ...(data.message.assets || []).map((a: any) => ({
                        name: a.name,
                        title: a.asset_title,
                        type: 'asset' as const,
                        status: a.status,
                        latest_file: a.latest_file,
                    })),
                    ...(data.message.projects || []).map((p: any) => ({
                        name: p.name,
                        title: p.project_title,
                        type: 'project' as const,
                        status: p.status,
                    })),
                ];
                setResults(mapped);
                setSelectedIndex(0);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 250);
    };

    const handleSelect = (result: SearchResult) => {
        setSearchOpen(false);
        if (result.type === 'asset') {
            onAssetClick(result.name);
        } else {
            onProjectClick(result.name);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    return (
        <>
            <header className="topbar">
                <div className="topbar-left">
                    <span className="topbar-breadcrumb">Image Management System</span>
                </div>

                <div className="topbar-right">
                    <button className="search-trigger" onClick={() => setSearchOpen(true)}>
                        <SearchSvg />
                        <span className="search-text">Search assets...</span>
                        <kbd className="search-shortcut">⌘K</kbd>
                    </button>

                    <button className="upload-btn" onClick={onUploadClick}>
                        <UploadSvg />
                        Upload
                    </button>
                </div>
            </header>

            {/* Command Palette Overlay */}
            {searchOpen && (
                <div className="cmd-overlay" onClick={() => setSearchOpen(false)}>
                    <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
                        <div className="cmd-input-row">
                            <SearchSvg />
                            <input
                                ref={inputRef}
                                className="cmd-input"
                                type="text"
                                placeholder="Search assets, projects..."
                                value={query}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <kbd className="cmd-esc" onClick={() => setSearchOpen(false)}>ESC</kbd>
                        </div>

                        {loading && (
                            <div className="cmd-loading">
                                <div className="loading-spinner small" />
                                <span>Searching...</span>
                            </div>
                        )}

                        {!loading && query && results.length === 0 && (
                            <div className="cmd-empty">
                                <p>No results for "<strong>{query}</strong>"</p>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="cmd-results">
                                {/* Group by type */}
                                {results.some(r => r.type === 'asset') && (
                                    <div className="cmd-group">
                                        <div className="cmd-group-label">Assets</div>
                                        {results.filter(r => r.type === 'asset').map((r) => {
                                            const globalIdx = results.indexOf(r);
                                            return (
                                                <button
                                                    key={r.name}
                                                    className={`cmd-result ${globalIdx === selectedIndex ? 'selected' : ''}`}
                                                    onClick={() => handleSelect(r)}
                                                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                                                >
                                                    <div className="cmd-result-left">
                                                        {r.latest_file && isImage(r.latest_file) ? (
                                                            <img className="cmd-thumb" src={r.latest_file} alt="" />
                                                        ) : (
                                                            <span className="cmd-icon"><FileImageSvg /></span>
                                                        )}
                                                        <div className="cmd-result-info">
                                                            <span className="cmd-result-title">{r.title}</span>
                                                            <span className="cmd-result-meta">{r.name}</span>
                                                        </div>
                                                    </div>
                                                    {r.status && <span className="cmd-result-badge">{r.status}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {results.some(r => r.type === 'project') && (
                                    <div className="cmd-group">
                                        <div className="cmd-group-label">Projects</div>
                                        {results.filter(r => r.type === 'project').map((r) => {
                                            const globalIdx = results.indexOf(r);
                                            return (
                                                <button
                                                    key={r.name}
                                                    className={`cmd-result ${globalIdx === selectedIndex ? 'selected' : ''}`}
                                                    onClick={() => handleSelect(r)}
                                                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                                                >
                                                    <div className="cmd-result-left">
                                                        <span className="cmd-icon"><FolderSvg /></span>
                                                        <div className="cmd-result-info">
                                                            <span className="cmd-result-title">{r.title}</span>
                                                            <span className="cmd-result-meta">{r.name}</span>
                                                        </div>
                                                    </div>
                                                    {r.status && <span className="cmd-result-badge">{r.status}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {!query && (
                            <div className="cmd-hints">
                                <span>Type to search</span>
                                <span>↑↓ navigate</span>
                                <span>↵ select</span>
                                <span>esc close</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

function isImage(url: string) {
    return /\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|$)/i.test(url || '');
}
function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf_token"]');
    return meta ? meta.getAttribute('content') || '' : '';
}

// SVG Icons
function SearchSvg() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
function UploadSvg() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}
function FileImageSvg() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
}
function FolderSvg() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
}

export default TopBar;
