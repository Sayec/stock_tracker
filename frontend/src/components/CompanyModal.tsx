import React, { useEffect, useState } from 'react';

type CompanyModalProps = {
    symbol: string;
    isSelected: boolean;
    onClose: () => void;
    onToggleChart: () => void;
    onGoToChart: () => void;
    isWatched: boolean;
    onToggleWatch: () => void;
};

export const CompanyModal: React.FC<CompanyModalProps> = ({ 
    symbol, 
    isSelected, 
    onClose, 
    onToggleChart, 
    onGoToChart,
    isWatched,
    onToggleWatch
}) => {
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [summary, setSummary] = useState<string>('');
    const [metrics, setMetrics] = useState<any>(null);
    const [earningsDate, setEarningsDate] = useState<string | null>(null);
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [liveChangePercent, setLiveChangePercent] = useState<number | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoadingSummary(true);
            try {
                // Fetch AI Summary
                const sumRes = await fetch(`/api/companies/${symbol}/summary`);
                if (sumRes.ok) {
                    const data = await sumRes.json();
                    setSummary(data.aiSummary);
                }

                // Fetch latest metrics from historical data
                const histRes = await fetch(`/api/stocks?symbol=${symbol}`);
                if (histRes.ok) {
                    const history = await histRes.json();
                    if (history && history.length > 0) {
                        setMetrics(history[history.length - 1]);
                    }
                }

                // Fetch earnings date from Yahoo Finance
                const quoteRes = await fetch('/api/portfolio/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: [symbol] })
                });
                if (quoteRes.ok) {
                    const quoteData = await quoteRes.json();
                    if (quoteData.quotes && quoteData.quotes.length > 0) {
                        const q = quoteData.quotes[0];
                        if (q.price) setLivePrice(q.price);
                        if (q.changePercent !== undefined) setLiveChangePercent(q.changePercent);

                        const dateString = q.earningsDate;
                        if (dateString) {
                            const dateObj = new Date(dateString);
                            setEarningsDate(dateObj.toLocaleDateString('pl-PL'));
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching company details:", err);
            } finally {
                setLoadingSummary(false);
            }
        };

        fetchDetails();
    }, [symbol]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div className="modal-header-container">
                    <h2 className="modal-title modal-title-company">
                        ✨ Raport Spółki: {symbol}
                    </h2>
                    <div className="modal-actions">
                        <button 
                            className="action-btn"
                            onClick={onToggleWatch}
                            style={{
                                background: isWatched ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                color: isWatched ? '#8b5cf6' : '#fff',
                                border: `1px solid ${isWatched ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255,255,255,0.2)'}`
                            }}
                        >
                            {isWatched ? '⭐ Obserwowana' : '☆ Dodaj do obserwowanych'}
                        </button>
                        
                        <button 
                            className="action-btn"
                            onClick={onToggleChart}
                            style={{
                                background: isSelected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                                color: isSelected ? '#ef4444' : '#fff',
                                border: `1px solid ${isSelected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.2)'}`
                            }}
                        >
                            {isSelected ? 'Usuń z wykresów' : 'Dodaj do wykresów'}
                        </button>

                        <button 
                            className="action-btn"
                            onClick={onGoToChart}
                            style={{
                                background: 'var(--accent)',
                                color: '#000',
                                border: 'none',
                                fontWeight: 'bold'
                            }}
                        >
                            📈 Przejdź do wykresów
                        </button>
                    </div>
                </div>
                
                {metrics && (
                    <div className="stats-grid" style={{ gridTemplateColumns: earningsDate ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
                        <div>
                            <div className="stat-label">Zamknięcie (D-1)</div>
                            <div className="stat-value stat-value-primary">${metrics.price?.toFixed(2)}</div>
                            {livePrice !== null && (
                                <div style={{ marginTop: '0.2rem', fontSize: '0.9rem' }}>
                                    <span className="stat-label">Live: </span>
                                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>${livePrice.toFixed(2)}</span>
                                    {liveChangePercent !== null && (
                                        <span style={{ color: liveChangePercent >= 0 ? '#10b981' : '#ef4444', marginLeft: '0.3rem', fontSize: '0.8rem' }}>
                                            ({liveChangePercent >= 0 ? '+' : ''}{liveChangePercent.toFixed(2)}%)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="stat-label">Upside</div>
                            <div className="stat-value">{metrics.upside?.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="stat-label">CAGR 2Y</div>
                            <div className="stat-value">{metrics.cagr2YForward?.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="stat-label">PSG</div>
                            <div className="stat-value">{metrics.psgRatio?.toFixed(2)}</div>
                        </div>
                        {earningsDate && (
                            <div>
                                <div className="stat-label">Kolejne wyniki</div>
                                <div className="stat-value stat-value-warning">{earningsDate}</div>
                            </div>
                        )}
                    </div>
                )}

                {loadingSummary ? (
                    <div className="loading">Trwa odpytywanie Gemini...</div>
                ) : (
                    <div className="ai-summary-text">
                        {summary || 'Brak podsumowania dla tej spółki.'}
                    </div>
                )}
            </div>
        </div>
    );
};
