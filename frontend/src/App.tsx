import { useEffect, useState } from 'react';
import './index.css';
import { SearchBar } from './components/SearchBar';
import { MetricsChart } from './components/MetricsChart';
import { Sidebar } from './components/Sidebar';
import { StockScreener } from './components/StockScreener';
import { CompanyModal } from './components/CompanyModal';
import { ReportModal } from './components/ReportModal';
import { EarningsCalendarModal } from './components/EarningsCalendarModal';
import type { Company, StockData, QuoteInfo } from './types';

function App() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
    const [hiddenSymbols, setHiddenSymbols] = useState<string[]>([]);
    const [watchlist, setWatchlist] = useState<string[]>(() => {
        const saved = localStorage.getItem('trackedStocks');
        return saved ? JSON.parse(saved) : [];
    });
    const [stockDataMap, setStockDataMap] = useState<Record<string, StockData[]>>({});

    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMetrics, setActiveMetrics] = useState<string[]>(['upside']);
    const [insightSymbol, setInsightSymbol] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'chart' | 'screener'>('screener');
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [calendarModalOpen, setCalendarModalOpen] = useState(false);

    const [watchlistQuotes, setWatchlistQuotes] = useState<QuoteInfo[]>([]);
    const [dismissedToasts, setDismissedToasts] = useState<string[]>([]);

    // Pobieranie danych dla obserwowanych spółek (w tym earningsDate)
    useEffect(() => {
        const fetchWatchlistQuotes = async () => {
            if (watchlist.length === 0) {
                setWatchlistQuotes([]);
                return;
            }
            try {
                const res = await fetch('/api/portfolio/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: watchlist })
                });
                if (res.ok) {
                    const data = await res.json();
                    setWatchlistQuotes(data.quotes || []);
                }
            } catch (err) {
                console.error("Error fetching watchlist quotes:", err);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchWatchlistQuotes();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [watchlist]);

    const upcomingEarnings = watchlistQuotes.filter(q => {
        if (!q.earningsDate) return false;
        const date = new Date(q.earningsDate);
        const today = new Date();
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7 && !dismissedToasts.includes(q.symbol);
    });

    const dismissToast = (symbol: string) => {
        setDismissedToasts(prev => [...prev, symbol]);
    };

    const handleGenerateReport = async () => {
        if (watchlist.length === 0) return;
        setReportModalOpen(true);
    };

    const toggleMetric = (metric: string) => {
        setActiveMetrics(prev =>
            prev.includes(metric)
                ? prev.filter(m => m !== metric)
                : [...prev, metric]
        );
    };

    const handleSelectSymbol = (symbol: string) => {
        setSelectedSymbols(prev =>
            prev.includes(symbol)
                ? prev.filter(s => s !== symbol)
                : [...prev, symbol]
        );
    };

    const handleRemoveSymbol = (symbol: string) => {
        setSelectedSymbols(prev => prev.filter(s => s !== symbol));
        setHiddenSymbols(prev => prev.filter(s => s !== symbol));
    };

    const handleToggleVisibility = (symbol: string) => {
        setHiddenSymbols(prev =>
            prev.includes(symbol)
                ? prev.filter(s => s !== symbol)
                : [...prev, symbol]
        );
    };

    const handleToggleWatch = (symbol: string) => {
        setWatchlist(prev => {
            const newList = prev.includes(symbol)
                ? prev.filter(s => s !== symbol)
                : [...prev, symbol];
            localStorage.setItem('trackedStocks', JSON.stringify(newList));
            return newList;
        });
    };

    // Pobranie listy spółek
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await fetch(`/api/companies`);
                if (!response.ok) throw new Error('Błąd pobierania listy spółek');
                const result = await response.json();
                setCompanies(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingCompanies(false);
            }
        };
        fetchCompanies();
    }, []);

    // Pobranie danych wykresu
    useEffect(() => {
        if (selectedSymbols.length === 0) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Filtrujemy te symbole, których jeszcze nie mamy w state (cache)
                const missingSymbols = selectedSymbols.filter(s => !stockDataMap[s]);

                if (missingSymbols.length > 0) {
                    const newDataMap = { ...stockDataMap };

                    await Promise.all(missingSymbols.map(async (symbol) => {
                        const res = await fetch(`/api/stocks?symbol=${symbol}`);
                        if (res.ok) {
                            newDataMap[symbol] = await res.json();
                        }
                    }));

                    setStockDataMap(newDataMap);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [selectedSymbols]);

    // Scalenie danych po dacie (łączenie wielu tablic w jedną tablicę obiektów z prefixami)
    const mergedDataMap: Record<string, any> = {};
    selectedSymbols.forEach(symbol => {
        const dataForSymbol = stockDataMap[symbol] || [];
        dataForSymbol.forEach(point => {
            if (!mergedDataMap[point.date]) {
                mergedDataMap[point.date] = { date: point.date };
            }
            mergedDataMap[point.date][`${symbol}_price`] = point.price;
            mergedDataMap[point.date][`${symbol}_cagr2YForward`] = point.cagr2YForward;
            mergedDataMap[point.date][`${symbol}_psgRatio`] = point.psgRatio;
            mergedDataMap[point.date][`${symbol}_upside`] = point.upside;
        });
    });

    const mergedData = Object.values(mergedDataMap).sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="layout-container">
            <div className="sidebar-controls">
                <h1>Stock Tracker</h1>
                <p className="subtitle">Monitorowanie wskaźników i estymat analityków</p>

                <SearchBar
                    companies={companies}
                    onSelectCompany={setInsightSymbol}
                />

                <div className="view-mode-toggles">
                    <button
                        className={`view-toggle-btn ${viewMode === 'screener' ? 'active' : ''}`}
                        onClick={() => setViewMode('screener')}
                    >
                        🏆 Skaner
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                        onClick={() => setViewMode('chart')}
                    >
                        📈 Wykresy
                    </button>
                </div>

                <div className="generate-report-container" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleGenerateReport}
                        disabled={watchlist.length === 0}
                        className="btn-generate-report"
                        style={{
                            flex: 2,
                            background: watchlist.length > 0 ? 'linear-gradient(45deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.05)',
                            color: watchlist.length > 0 ? '#fff' : 'var(--text-muted)',
                            cursor: watchlist.length > 0 ? 'pointer' : 'not-allowed',
                            boxShadow: watchlist.length > 0 ? '0 4px 15px rgba(139, 92, 246, 0.4)' : 'none'
                        }}
                    >
                        ✨ Raport Tygodnia ({watchlist.length})
                    </button>
                    <button
                        onClick={() => setCalendarModalOpen(true)}
                        disabled={watchlist.length === 0}
                        className="btn-generate-report"
                        style={{
                            flex: 1,
                            background: watchlist.length > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                            color: watchlist.length > 0 ? '#fff' : 'var(--text-muted)',
                            cursor: watchlist.length > 0 ? 'pointer' : 'not-allowed',
                            padding: '0.8rem',
                            display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}
                    >
                        📅 Kalendarz
                    </button>
                </div>

                {viewMode === 'chart' && (
                    <Sidebar
                        selectedSymbols={selectedSymbols}
                        hiddenSymbols={hiddenSymbols}
                        companies={companies}
                        activeMetrics={activeMetrics}
                        toggleMetric={toggleMetric}
                        onRemoveSymbol={handleRemoveSymbol}
                        onToggleVisibility={handleToggleVisibility}
                        onOpenInsightModal={setInsightSymbol}
                    />
                )}
            </div>

            <div className="main-content">
                {loadingCompanies && <div className="loading">Wczytywanie bazy spółek...</div>}
                {error && <div className="error">Błąd: {error}</div>}

                {/* Kontener Skanera */}
                <div className="main-content-view" style={{ display: viewMode === 'screener' ? 'flex' : 'none' }}>
                    <StockScreener onToggleChart={handleSelectSymbol} onOpenInsight={setInsightSymbol} selectedSymbols={selectedSymbols} />
                </div>

                {/* Kontener Wykresów */}
                <div className="main-content-view" style={{ display: viewMode === 'chart' ? 'flex' : 'none' }}>
                    {selectedSymbols.length > 0 ? (
                        <div className="dashboard single-dashboard chart-dashboard">
                            {loadingData ? (
                                <div className="loading">Pobieranie danych giełdowych...</div>
                            ) : (
                                <MetricsChart
                                    data={mergedData}
                                    selectedSymbols={selectedSymbols.filter(s => !hiddenSymbols.includes(s))}
                                    activeMetrics={activeMetrics}
                                />
                            )}
                        </div>
                    ) : (
                        !loadingCompanies && (
                            <div className="empty-state app-empty-state">
                                Wyszukaj i dodaj spółki z panelu bocznego lub kliknij spółkę w Skanerze, aby zobaczyć i porównać profesjonalne wykresy.
                            </div>
                        )
                    )}
                </div>

                {/* Wspólny Modal Spółki */}
                {insightSymbol && (
                    <CompanyModal
                        symbol={insightSymbol}
                        isSelected={selectedSymbols.includes(insightSymbol)}
                        onClose={() => setInsightSymbol(null)}
                        onToggleChart={() => handleSelectSymbol(insightSymbol)}
                        onGoToChart={() => {
                            if (!selectedSymbols.includes(insightSymbol)) {
                                handleSelectSymbol(insightSymbol);
                            }
                            setViewMode('chart');
                            setInsightSymbol(null);
                        }}
                        isWatched={watchlist.includes(insightSymbol)}
                        onToggleWatch={() => handleToggleWatch(insightSymbol)}
                    />
                )}

                {reportModalOpen && (
                    <ReportModal
                        watchlist={watchlist}
                        onClose={() => setReportModalOpen(false)}
                        onGoToChart={(symbol) => {
                            if (!selectedSymbols.includes(symbol)) {
                                handleSelectSymbol(symbol);
                            }
                            setViewMode('chart');
                            setReportModalOpen(false);
                        }}
                    />
                )}

                {calendarModalOpen && (
                    <EarningsCalendarModal
                        quotes={watchlistQuotes}
                        onClose={() => setCalendarModalOpen(false)}
                        onGoToCompany={(symbol) => setInsightSymbol(symbol)}
                    />
                )}

                {/* Toasty powiadomień */}
                <div className="toast-container">
                    {upcomingEarnings.map(q => {
                        const days = Math.ceil((new Date(q.earningsDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        return (
                            <div key={`toast-${q.symbol}`} className="earnings-toast">
                                <div className="toast-icon">📅</div>
                                <div className="toast-content">
                                    <strong>{q.symbol}</strong>
                                    <span>Wyniki za {days} {days === 1 ? 'dzień' : 'dni'}</span>
                                </div>
                                <button className="toast-close" onClick={() => dismissToast(q.symbol)}>×</button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default App;
