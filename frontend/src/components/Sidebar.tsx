import React from 'react';
import type { Company } from '../types';

type SidebarProps = {
    selectedSymbols: string[];
    hiddenSymbols: string[];
    companies: Company[];
    activeMetrics: string[];
    toggleMetric: (metric: string) => void;
    onRemoveSymbol: (symbol: string) => void;
    onToggleVisibility: (symbol: string) => void;
    onOpenInsightModal: (symbol: string) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
    selectedSymbols,
    hiddenSymbols,
    companies,
    activeMetrics,
    toggleMetric,
    onRemoveSymbol,
    onToggleVisibility,
    onOpenInsightModal
}) => {
    return (
        <div className="company-info-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="metrics-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                    className={activeMetrics.includes('price') ? 'active' : ''}
                    onClick={() => toggleMetric('price')}
                >
                    Cena
                </button>
                <button
                    className={activeMetrics.includes('upside') ? 'active' : ''}
                    onClick={() => toggleMetric('upside')}
                >
                    Analyst Upside
                </button>
                <button
                    className={activeMetrics.includes('cagr2YForward') ? 'active' : ''}
                    onClick={() => toggleMetric('cagr2YForward')}
                >
                    2Y CAGR Forward
                </button>
                <button
                    className={activeMetrics.includes('psgRatio') ? 'active' : ''}
                    onClick={() => toggleMetric('psgRatio')}
                >
                    PSG Ratio
                </button>
            </div>

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
