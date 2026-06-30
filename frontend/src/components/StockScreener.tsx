import React, { useState, useEffect } from 'react';

type ScreenerProps = {
    onToggleChart: (symbol: string) => void;
    onOpenInsight: (stock: any) => void;
    selectedSymbols: string[];
};

type SortKey = 'symbol' | 'price' | 'upside' | 'cagr2YForward' | 'psgRatio' | 'ipoDate';

export const StockScreener: React.FC<ScreenerProps> = ({ onToggleChart, onOpenInsight, selectedSymbols }) => {
    const [stocks, setStocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('upside');
    const [sortDesc, setSortDesc] = useState(true);

    const [filterUpside, setFilterUpside] = useState(0);
    const [filterCagr, setFilterCagr] = useState(0);
    const [filterCap, setFilterCap] = useState(10);

    useEffect(() => {
        const fetchStocks = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/stocks/top?upside=${filterUpside / 100}&cagr=${filterCagr / 100}&marketCap=${filterCap * 1000000000}`);
                if (!response.ok) throw new Error('Błąd pobierania spółek');
                const result = await response.json();
                setStocks(result);
            } catch (err: any) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchStocks();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [filterUpside, filterCagr, filterCap]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    const sortedStocks = [...stocks].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (valA === null || valA === undefined) valA = sortDesc ? -Infinity : Infinity;
        if (valB === null || valB === undefined) valB = sortDesc ? -Infinity : Infinity;

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
    });

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <span style={{ opacity: 0.2 }}>↕</span>;
        return <span>{sortDesc ? '↓' : '↑'}</span>;
    };

    return (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem', marginBottom: '0' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--accent)' }}>
                    📊 Pełny Skaner Rynku
                </h2>
                <p style={{ margin: '0.5rem 0 1.5rem 0', color: 'var(--text-muted)' }}>
                    Kliknij w wiersz, aby zobaczyć opis AI i wskaźniki. Użyj przycisku po prawej, aby dodać spółkę do wykresu.
                </p>

                <div className="scanner-filters" style={{ display: 'flex', gap: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Min. Upside: <strong style={{ color: '#fff' }}>{filterUpside}%</strong></label>
                        <input type="range" min="0" max="100" step="5" value={filterUpside} onChange={(e) => setFilterUpside(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Min. CAGR 2Y: <strong style={{ color: '#fff' }}>{filterCagr}%</strong></label>
                        <input type="range" min="0" max="100" step="5" value={filterCagr} onChange={(e) => setFilterCagr(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Min. Market Cap: <strong style={{ color: '#fff' }}>${filterCap}B</strong></label>
                        <input type="range" min="0" max="100" step="1" value={filterCap} onChange={(e) => setFilterCap(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 20, display: 'flex', justifyContent: 'center', paddingTop: '5rem', backdropFilter: 'blur(2px)' }}>
                        <div className="loading">Odświeżanie danych Skanera...</div>
                    </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                        <tr>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleSort('symbol')}>
                                Symbol <SortIcon columnKey="symbol" />
                            </th>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }} onClick={() => handleSort('price')}>
                                Cena <SortIcon columnKey="price" />
                            </th>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }} onClick={() => handleSort('upside')}>
                                Analyst Upside <SortIcon columnKey="upside" />
                            </th>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }} onClick={() => handleSort('cagr2YForward')}>
                                2Y CAGR <SortIcon columnKey="cagr2YForward" />
                            </th>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }} onClick={() => handleSort('psgRatio')}>
                                PSG Ratio <SortIcon columnKey="psgRatio" />
                            </th>
                            <th style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleSort('ipoDate')}>
                                Data IPO <SortIcon columnKey="ipoDate" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStocks.map((stock, idx) => {
                            const isSelected = selectedSymbols.includes(stock.symbol);

                            return (
                                <tr
                                    key={stock.symbol}
                                    style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: isSelected ? 'rgba(16, 185, 129, 0.05)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'),
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onClick={() => onOpenInsight(stock)}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? 'rgba(16, 185, 129, 0.05)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'))}
                                >
                                    <td style={{ padding: '1rem', fontWeight: 'bold', color: isSelected ? '#10b981' : 'var(--accent)' }}>
                                        {stock.symbol}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>${stock.price?.toFixed(2)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{(stock.upside * 100).toFixed(1)}%</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{(stock.cagr2YForward * 100).toFixed(1)}%</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>{stock.psgRatio?.toFixed(2)}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>{stock.ipoDate ? stock.ipoDate.split('T')[0] : 'Brak'}</span>
                                        <button
                                            style={{
                                                background: isSelected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: isSelected ? '#ef4444' : '#10b981',
                                                border: `1px solid ${isSelected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                minWidth: '80px',
                                                textAlign: 'center'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleChart(stock.symbol);
                                            }}
                                        >
                                            {isSelected ? 'Usuń' : '+ Wykres'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {sortedStocks.length === 0 && !loading && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Brak spółek spełniających wybrane kryteria.</div>
                )}
            </div>
        </div>
    );
};
