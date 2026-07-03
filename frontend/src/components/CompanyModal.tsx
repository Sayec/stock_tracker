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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingRight: '2rem' }}>
                    <h2 style={{ color: '#8b5cf6', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✨ Raport Spółki: {symbol}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        <button 
                            onClick={onToggleWatch}
                            style={{
                                background: isWatched ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                color: isWatched ? '#8b5cf6' : '#fff',
                                border: `1px solid ${isWatched ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem'
                            }}
                        >
                            {isWatched ? '⭐ Obserwowana' : '☆ Dodaj do obserwowanych'}
                        </button>
                        
                        <button 
                            onClick={onToggleChart}
                            style={{
                                background: isSelected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                                color: isSelected ? '#ef4444' : '#fff',
                                border: `1px solid ${isSelected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.2)'}`,
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem'
                            }}
                        >
                            {isSelected ? 'Usuń z wykresów' : 'Dodaj do wykresów'}
                        </button>

                        <button 
                            onClick={onGoToChart}
                            style={{
                                background: 'var(--accent)',
                                color: '#000',
                                border: 'none',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem',
                                fontWeight: 'bold'
                            }}
                        >
                            📈 Przejdź do wykresów
                        </button>
                    </div>
                </div>
                
                {metrics && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cena</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>${metrics.price?.toFixed(2)}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upside</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>{metrics.upside?.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>CAGR 2Y</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>{metrics.cagr2YForward?.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>PSG</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>{metrics.psgRatio?.toFixed(2)}</div>
                        </div>
                    </div>
                )}

                {loadingSummary ? (
                    <div className="loading">Trwa odpytywanie Gemini...</div>
                ) : (
                    <div style={{ color: 'var(--text-main)', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                        {summary || 'Brak podsumowania dla tej spółki.'}
                    </div>
                )}
            </div>
        </div>
    );
};
