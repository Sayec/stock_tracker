import React from 'react';

type Company = {
    symbol: string;
    name: string;
};

type StockData = {
    date: string;
    price: number;
    cagr2YForward: number;
    psgRatio: number;
    upside: number;
};

type SidebarProps = {
    selectedSymbol: string;
    selectedCompany?: Company;
    latestData?: StockData | null;
    loadingData: boolean;
    activeMetrics: string[];
    toggleMetric: (metric: string) => void;
    aiSummary: string | null;
    loadingSummary: boolean;
    onOpenInsightModal: () => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
    selectedSymbol,
    selectedCompany,
    latestData,
    loadingData,
    activeMetrics,
    toggleMetric,
    aiSummary,
    loadingSummary,
    onOpenInsightModal
}) => {
    return (
        <div className="company-info-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
                <div className="card-header" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                    <div>
                        <h2 className="symbol-name">{selectedSymbol}</h2>
                        <div className="company-fullname">{selectedCompany?.name}</div>
                    </div>
                    {loadingData ? (
                        <span className="current-price loading-dots" style={{ fontSize: '1.2rem' }}></span>
                    ) : (
                        latestData && <span className="current-price" style={{ fontSize: '1.2rem' }}>${latestData.price?.toFixed(2)}</span>
                    )}
                </div>
            </div>

            <div className="metrics-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
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

            {(aiSummary || loadingSummary) && (
                <div className="card ai-insight-card" style={{ 
                    padding: '1.2rem', 
                    borderLeft: '3px solid #8b5cf6', 
                    background: 'linear-gradient(to right, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.02))'
                }}>
                    <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✨ AI Insight
                    </h3>
                    
                    {loadingSummary ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', animation: 'pulse 1.5s infinite' }}>
                            Generowanie analizy przez Gemini Flash...
                        </div>
                    ) : (
                        <>
                            <div className="line-clamp-5" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {aiSummary}
                            </div>
                            {aiSummary && aiSummary.length > 200 && (
                                <button className="read-more-btn" onClick={onOpenInsightModal}>
                                    Czytaj dalej...
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
