import React, { useState, useEffect } from 'react';

type ScannerModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelectCompany: (symbol: string) => void;
};

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onSelectCompany }) => {
    const [topStocks, setTopStocks] = useState<any[]>([]);
    const [loadingTop, setLoadingTop] = useState(false);
    const [filterUpside, setFilterUpside] = useState(35);
    const [filterCagr, setFilterCagr] = useState(20);
    const [filterCap, setFilterCap] = useState(10);

    useEffect(() => {
        if (!isOpen) return;

        const fetchTopStocks = async () => {
            setLoadingTop(true);
            try {
                const response = await fetch(`/api/stocks/top?upside=${filterUpside/100}&cagr=${filterCagr/100}&marketCap=${filterCap * 1000000000}`);
                if (!response.ok) throw new Error('Błąd pobierania top spółek');
                const result = await response.json();
                setTopStocks(result);
            } catch (err: any) {
                console.error(err);
            } finally {
                setLoadingTop(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchTopStocks();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [isOpen, filterUpside, filterCagr, filterCap]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content scanner-modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                    🏆 Skaner Okazji Inwestycyjnych
                </h2>
                
                <div className="scanner-filters" style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Min. Upside: <strong style={{ color: '#fff' }}>{filterUpside}%</strong></label>
                        <input type="range" min="0" max="100" step="5" value={filterUpside} onChange={(e) => setFilterUpside(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Min. CAGR 2Y: <strong style={{ color: '#fff' }}>{filterCagr}%</strong></label>
                        <input type="range" min="0" max="100" step="5" value={filterCagr} onChange={(e) => setFilterCagr(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Min. Market Cap: <strong style={{ color: '#fff' }}>${filterCap}B</strong></label>
                        <input type="range" min="1" max="100" step="1" value={filterCap} onChange={(e) => setFilterCap(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                </div>

                <div style={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
                    {loadingTop ? (
                        <div className="loading" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>Skanowanie rynku w poszukiwaniu danych z dzisiaj...</div>
                    ) : topStocks.length > 0 ? (
                        <div className="top-stocks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem', alignContent: 'start', flex: 1 }}>
                            {topStocks.map((s: any) => (
                                <div 
                                    key={s.symbol} 
                                    className="card top-stock-card" 
                                    style={{ cursor: 'pointer', padding: '1rem', transition: 'all 0.2s', minHeight: 'auto', background: 'rgba(30, 41, 59, 0.9)' }}
                                    onClick={() => {
                                        onSelectCompany(s.symbol);
                                        onClose();
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{s.symbol}</span>
                                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>${s.price.toFixed(2)}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Upside:</span> <strong style={{ color: '#fff' }}>{(s.upside * 100).toFixed(1)}%</strong>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>CAGR:</span> <strong style={{ color: '#fff' }}>{(s.cagr2YForward * 100).toFixed(1)}%</strong>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>PSG:</span> <strong style={{ color: '#fff' }}>{s.psgRatio.toFixed(2)}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>Brak spółek spełniających te kryteria w dzisiejszym zestawieniu.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
