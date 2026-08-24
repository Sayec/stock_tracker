import React, { useState, useRef, useEffect } from 'react';
import type { Company, MetricOverlaySettings } from '../types';

type SidebarProps = {
    selectedSymbols: string[];
    hiddenSymbols: string[];
    companies: Company[];
    activeMetrics: string[];
    toggleMetric: (metric: string) => void;
    onRemoveSymbol: (symbol: string) => void;
    onToggleVisibility: (symbol: string) => void;
    onOpenInsightModal: (symbol: string) => void;
    overlaySettings: Record<string, MetricOverlaySettings>;
    onUpdateOverlaySettings: (metric: string, settings: Partial<MetricOverlaySettings>) => void;
};

const METRICS_CONFIG = [
    { key: 'price', label: 'Cena' },
    { key: 'targetConsensus', label: 'Price Target' },
    { key: 'upside', label: 'Analyst Upside' },
    { key: 'cagr2YForward', label: '2Y CAGR Forward' },
    { key: 'psRatioForward', label: 'P/S 2Y Forward' },
    { key: 'psgRatio', label: 'PSG Ratio' },
];

export const Sidebar: React.FC<SidebarProps> = ({
    selectedSymbols,
    hiddenSymbols,
    companies,
    activeMetrics,
    toggleMetric,
    onRemoveSymbol,
    onToggleVisibility,
    onOpenInsightModal,
    overlaySettings,
    onUpdateOverlaySettings
}) => {
    const [openMenuMetric, setOpenMenuMetric] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Zamykanie menu opcji przy kliknięciu poza obszar
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('.metric-more-btn')) {
                return;
            }
            if (menuRef.current && !menuRef.current.contains(target)) {
                setOpenMenuMetric(null);
            }
        };
        if (openMenuMetric) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMenuMetric]);

    return (
        <div className="company-info-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Przyciski wyboru wskaźników z opcją 3 kropek */}
            <div className="metrics-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {METRICS_CONFIG.map(({ key, label }) => {
                    const isActive = activeMetrics.includes(key);
                    const settings = overlaySettings[key] || {
                        showMean: false,
                        showMedian: false,
                        showChannel: false,
                        channelLowerPercentile: 20,
                        channelUpperPercentile: 80
                    };
                    const hasOverlay = settings.showMean || settings.showMedian || settings.showChannel;

                    return (
                        <div key={key} className="metric-row">
                            <button
                                className={`metric-btn ${isActive ? 'active' : ''}`}
                                onClick={() => toggleMetric(key)}
                            >
                                {label}
                            </button>
                            
                            <button
                                className={`metric-more-btn ${hasOverlay ? 'has-overlay' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuMetric(prev => (prev === key ? null : key));
                                }}
                                title="Opcje analizy (Średnia, Mediana, Horizontal Channel)"
                            >
                                ⋮
                            </button>

                            {openMenuMetric === key && (
                                <div ref={menuRef} className="overlay-menu">
                                    <div className="overlay-menu-title">⚙️ Opcje: {label}</div>

                                    <label className="overlay-menu-item">
                                        <input
                                            type="checkbox"
                                            checked={settings.showMean}
                                            onChange={(e) => onUpdateOverlaySettings(key, { showMean: e.target.checked })}
                                        />
                                        <span>Średnia (Mean)</span>
                                    </label>

                                    <label className="overlay-menu-item">
                                        <input
                                            type="checkbox"
                                            checked={settings.showMedian}
                                            onChange={(e) => onUpdateOverlaySettings(key, { showMedian: e.target.checked })}
                                        />
                                        <span>Mediana (Median)</span>
                                    </label>

                                    <label className="overlay-menu-item">
                                        <input
                                            type="checkbox"
                                            checked={settings.showChannel}
                                            onChange={(e) => onUpdateOverlaySettings(key, { showChannel: e.target.checked })}
                                        />
                                        <span>Horizontal Channel</span>
                                    </label>

                                    {settings.showChannel && (
                                        <div className="overlay-percentile-inputs">
                                            <div className="overlay-percentile-row">
                                                <span>Dolny percentyl:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    className="overlay-percentile-input"
                                                    value={settings.channelLowerPercentile ?? 20}
                                                    onChange={(e) => onUpdateOverlaySettings(key, { channelLowerPercentile: Number(e.target.value) })}
                                                />
                                                <span>%</span>
                                            </div>
                                            <div className="overlay-percentile-row">
                                                <span>Górny percentyl:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    className="overlay-percentile-input"
                                                    value={settings.channelUpperPercentile ?? 80}
                                                    onChange={(e) => onUpdateOverlaySettings(key, { channelUpperPercentile: Number(e.target.value) })}
                                                />
                                                <span>%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Lista wybranych spółek */}
            <div className="card" style={{ padding: '0.8rem 1rem' }}>
                <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                    Wybrane spółki ({selectedSymbols.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedSymbols.map(symbol => {
                        const company = companies.find(c => c.symbol === symbol);
                        const isHidden = hiddenSymbols.includes(symbol);
                        return (
                            <div 
                                key={symbol} 
                                onClick={() => onToggleVisibility(symbol)}
                                className={`sidebar-company-item ${isHidden ? 'hidden' : ''}`}
                                title={isHidden ? "Kliknij, aby pokazać na wykresie" : "Kliknij, aby ukryć na wykresie"}
                            >
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.1rem' }}>{symbol}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {company?.name}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onOpenInsightModal(symbol); }}
                                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                                        title="Generuj podsumowanie AI"
                                    >
                                        ✨ AI
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRemoveSymbol(symbol); }}
                                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                                        title="Usuń spółkę"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {selectedSymbols.length === 0 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                            Brak wybranych spółek.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
