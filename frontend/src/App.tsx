import { useEffect, useState } from 'react';
import './index.css';
import { SearchBar } from './components/SearchBar';
import { MetricsChart } from './components/MetricsChart';
import { Sidebar } from './components/Sidebar';
import { StockScreener } from './components/StockScreener';
import { CompanyModal } from './components/CompanyModal';
import { ReportModal } from './components/ReportModal';
import { EarningsCalendarModal } from './components/EarningsCalendarModal';
import type { Company, StockData, QuoteInfo, MetricOverlaySettings } from './types';

// Pomocnik do parsowania stanu z aktualnego adresu URL i localStorage
function parseInitialRoute() {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // Wykrywanie widoku spółki: /company/:symbol lub /symbols/:symbol
    const companyMatch = pathname.match(/^\/(?:company|symbols)\/([A-Za-z0-9._-]+)/i);
    const initialCompany = companyMatch ? companyMatch[1].toUpperCase() : null;

    // Wykrywanie aktywnego widoku głównego
    let initialView: 'chart' | 'screener' | 'watchlist' = 'screener';
    if (pathname.startsWith('/watchlist-chart') || searchParams.get('from') === 'watchlist') {
        initialView = 'watchlist';
    } else if (pathname.startsWith('/chart') || searchParams.get('from') === 'chart') {
        initialView = 'chart';
    } else if (pathname.startsWith('/screener')) {
        initialView = 'screener';
    }

    // Wykrywanie spółek na wykresie: najpierw z URL query (?symbols=...), a fallback z localStorage
    const symbolsParam = searchParams.get('symbols');
    let initialSymbols: string[] = [];
    if (symbolsParam) {
        initialSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        try {
            localStorage.setItem('selectedChartSymbols', JSON.stringify(initialSymbols));
        } catch {}
    } else {
        try {
            const saved = localStorage.getItem('selectedChartSymbols');
            if (saved) initialSymbols = JSON.parse(saved);
        } catch {}
    }

    return {
        initialCompany,
        initialView,
        initialSymbols
    };
}

function App() {
    const initialRoute = parseInitialRoute();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>(initialRoute.initialSymbols);
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
    const [insightSymbol, setInsightSymbol] = useState<string | null>(initialRoute.initialCompany);

    const [viewMode, setViewMode] = useState<'chart' | 'screener' | 'watchlist'>(initialRoute.initialView);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [calendarModalOpen, setCalendarModalOpen] = useState(false);

    const [watchlistQuotes, setWatchlistQuotes] = useState<QuoteInfo[]>([]);
    const [dismissedToasts, setDismissedToasts] = useState<string[]>([]);

    const [overlaySettings, setOverlaySettings] = useState<Record<string, MetricOverlaySettings>>({});

    // Pomocnik do budowania URL na podstawie stanu aplikacji
    const buildUrl = (view: 'chart' | 'screener' | 'watchlist', company: string | null, symbols: string[]) => {
        let path = '';
        const params = new URLSearchParams();

        if (company) {
            path = `/company/${company}`;
            if (view === 'chart') {
                params.set('from', 'chart');
                if (symbols.length > 0) {
                    params.set('symbols', symbols.join(','));
                }
            } else if (view === 'watchlist') {
                params.set('from', 'watchlist');
            }
        } else if (view === 'watchlist') {
            path = '/watchlist-chart';
        } else if (view === 'chart') {
            path = '/chart';
            if (symbols.length > 0) {
                params.set('symbols', symbols.join(','));
            }
        } else {
            path = '/screener';
        }

        const query = params.toString() ? `?${params.toString()}` : '';
        return `${path}${query}`;
    };

    // Nawigacja: przełączanie widoków głównych (Skaner / Wykresy / Obserwowane)
    const handleSwitchView = (newView: 'chart' | 'screener' | 'watchlist', overrideSymbols?: string[]) => {
        const symbolsToUse = overrideSymbols ?? selectedSymbols;
        setViewMode(newView);
        setInsightSymbol(null);
        const targetUrl = buildUrl(newView, null, symbolsToUse);
        window.history.pushState({ view: newView }, '', targetUrl);
    };

    // Nawigacja: otwieranie karty spółki
    const handleOpenInsight = (symbol: string) => {
        const sym = symbol.toUpperCase();
        setInsightSymbol(sym);
        const targetUrl = buildUrl(viewMode, sym, selectedSymbols);
        window.history.pushState({ view: viewMode, company: sym }, '', targetUrl);
    };

    // Nawigacja: zamykanie karty spółki
    const handleCloseInsight = () => {
        setInsightSymbol(null);
        const targetUrl = buildUrl(viewMode, null, selectedSymbols);
        window.history.pushState({ view: viewMode }, '', targetUrl);
    };

    // Synchronizacja spółek na wykresie z localStorage i query params
    const updateSelectedSymbolsAndUrl = (newSymbols: string[]) => {
        setSelectedSymbols(newSymbols);
        try {
            localStorage.setItem('selectedChartSymbols', JSON.stringify(newSymbols));
        } catch {}

        // Aktualizacja URL bez tworzenia nowej pozycji w historii
        const targetUrl = buildUrl(viewMode, insightSymbol, newSymbols);
        window.history.replaceState({ view: viewMode, company: insightSymbol }, '', targetUrl);
    };

    // Obsługa przycisków Wstecz / Dalej w przeglądarce (popstate)
    useEffect(() => {
        const handlePopState = () => {
            const route = parseInitialRoute();
            setViewMode(route.initialView);
            setInsightSymbol(route.initialCompany);
            if (route.initialSymbols.length > 0) {
                setSelectedSymbols(route.initialSymbols);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Normalizacja URL przy pierwszym wejściu (np. '/' -> '/screener')
    useEffect(() => {
        const targetUrl = buildUrl(initialRoute.initialView, initialRoute.initialCompany, initialRoute.initialSymbols);
        const currentFull = window.location.pathname + window.location.search;
        if (currentFull !== targetUrl) {
            window.history.replaceState({ view: initialRoute.initialView, company: initialRoute.initialCompany }, '', targetUrl);
        }
    }, []);

    const handleUpdateOverlaySettings = (metric: string, update: Partial<MetricOverlaySettings>) => {
        setOverlaySettings(prev => {
            const current = prev[metric] || {
                showMean: false,
                showMedian: false,
                showChannel: false,
                channelLowerPercentile: 20,
                channelUpperPercentile: 80
            };
            return {
                ...prev,
                [metric]: { ...current, ...update }
            };
        });
    };

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
        const newSymbols = selectedSymbols.includes(symbol)
            ? selectedSymbols.filter(s => s !== symbol)
            : [...selectedSymbols, symbol];
        updateSelectedSymbolsAndUrl(newSymbols);
    };

    const handleRemoveSymbol = (symbol: string) => {
        const newSymbols = selectedSymbols.filter(s => s !== symbol);
        setHiddenSymbols(prev => prev.filter(s => s !== symbol));
        updateSelectedSymbolsAndUrl(newSymbols);
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
        const symbolsToFetch = viewMode === 'watchlist' ? watchlist : selectedSymbols;
        if (symbolsToFetch.length === 0) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Filtrujemy te symbole, których jeszcze nie mamy w state (cache)
                const missingSymbols = symbolsToFetch.filter(s => !stockDataMap[s]);

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
    }, [selectedSymbols, watchlist, viewMode]);

    // Scalenie danych po dacie (dla /chart bierzemy selectedSymbols, dla /watchlist-chart bierzemy watchlist)
    const symbolsToRender = viewMode === 'watchlist' ? watchlist : selectedSymbols;
    const mergedDataMap: Record<string, any> = {};
    symbolsToRender.forEach(symbol => {
        const dataForSymbol = stockDataMap[symbol] || [];
        dataForSymbol.forEach(point => {
            if (!mergedDataMap[point.date]) {
                mergedDataMap[point.date] = { date: point.date };
            }
            mergedDataMap[point.date][`${symbol}_price`] = point.price;
            mergedDataMap[point.date][`${symbol}_targetConsensus`] = point.targetConsensus;
            mergedDataMap[point.date][`${symbol}_cagr2YForward`] = point.cagr2YForward;
            mergedDataMap[point.date][`${symbol}_psRatioForward`] = point.psRatioForward;
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
                    onSelectCompany={handleOpenInsight}
                />

                <div className="view-mode-toggles">
                    <button
                        className={`view-toggle-btn ${viewMode === 'screener' ? 'active' : ''}`}
                        onClick={() => handleSwitchView('screener')}
                    >
                        🏆 Skaner
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                        onClick={() => handleSwitchView('chart')}
                    >
                        📈 Wykresy
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'watchlist' ? 'active' : ''}`}
                        onClick={() => handleSwitchView('watchlist')}
                        title="Wykresy obserwowanych spółek"
                    >
                        ⭐ Obserwowane
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

                {(viewMode === 'chart' || viewMode === 'watchlist') && (
                    <Sidebar
                        selectedSymbols={viewMode === 'watchlist' ? watchlist : selectedSymbols}
                        hiddenSymbols={hiddenSymbols}
                        companies={companies}
                        activeMetrics={activeMetrics}
                        toggleMetric={toggleMetric}
                        onRemoveSymbol={viewMode === 'watchlist' ? handleToggleWatch : handleRemoveSymbol}
                        onToggleVisibility={handleToggleVisibility}
                        onOpenInsightModal={handleOpenInsight}
                        overlaySettings={overlaySettings}
                        onUpdateOverlaySettings={handleUpdateOverlaySettings}
                        title={viewMode === 'watchlist' ? `Obserwowane spółki (${watchlist.length})` : undefined}
                        isWatchlistMode={viewMode === 'watchlist'}
                    />
                )}
            </div>

            <div className="main-content">
                {loadingCompanies && <div className="loading">Wczytywanie bazy spółek...</div>}
                {error && <div className="error">Błąd: {error}</div>}

                {/* Kontener Skanera */}
                <div className="main-content-view" style={{ display: viewMode === 'screener' ? 'flex' : 'none' }}>
                    <StockScreener onToggleChart={handleSelectSymbol} onOpenInsight={handleOpenInsight} selectedSymbols={selectedSymbols} />
                </div>

                {/* Kontener Wykresów (dla /chart oraz /watchlist-chart) */}
                <div className="main-content-view" style={{ display: (viewMode === 'chart' || viewMode === 'watchlist') ? 'flex' : 'none' }}>
                    {symbolsToRender.length > 0 ? (
                        <div className="dashboard single-dashboard chart-dashboard">
                            {loadingData ? (
                                <div className="loading">Pobieranie danych giełdowych...</div>
                            ) : (
                                <MetricsChart
                                    data={mergedData}
                                    selectedSymbols={symbolsToRender.filter(s => !hiddenSymbols.includes(s))}
                                    activeMetrics={activeMetrics}
                                    overlaySettings={overlaySettings}
                                />
                            )}
                        </div>
                    ) : (
                        !loadingCompanies && (
                            <div className="empty-state app-empty-state">
                                {viewMode === 'watchlist'
                                    ? 'Brak obserwowanych spółek w portfelu. Dodaj spółki do obserwowanych w Skanerze lub w modalu spółki.'
                                    : 'Wyszukaj i dodaj spółki z panelu bocznego lub kliknij spółkę w Skanerze, aby zobaczyć i porównać profesjonalne wykresy.'}
                            </div>
                        )
                    )}
                </div>

                {reportModalOpen && (
                    <ReportModal
                        watchlist={watchlist}
                        onClose={() => setReportModalOpen(false)}
                        onGoToChart={(symbol) => {
                            const nextSymbols = selectedSymbols.includes(symbol)
                                ? selectedSymbols
                                : [...selectedSymbols, symbol];
                            updateSelectedSymbolsAndUrl(nextSymbols);
                            handleSwitchView('chart', nextSymbols);
                            setReportModalOpen(false);
                        }}
                        onGoToWatchlistChart={() => {
                            handleSwitchView('watchlist');
                            setReportModalOpen(false);
                        }}
                        onOpenCompany={(symbol) => handleOpenInsight(symbol)}
                    />
                )}

                {calendarModalOpen && (
                    <EarningsCalendarModal
                        quotes={watchlistQuotes}
                        onClose={() => setCalendarModalOpen(false)}
                        onGoToCompany={(symbol) => handleOpenInsight(symbol)}
                    />
                )}

                {/* Wspólny Modal Spółki (zawsze na samym wierzchu) */}
                {insightSymbol && (
                    <CompanyModal
                        symbol={insightSymbol}
                        isSelected={selectedSymbols.includes(insightSymbol)}
                        onClose={handleCloseInsight}
                        onToggleChart={() => handleSelectSymbol(insightSymbol)}
                        onGoToChart={() => {
                            const nextSymbols = selectedSymbols.includes(insightSymbol)
                                ? selectedSymbols
                                : [...selectedSymbols, insightSymbol];
                            updateSelectedSymbolsAndUrl(nextSymbols);
                            handleSwitchView('chart', nextSymbols);
                            setReportModalOpen(false);
                            setCalendarModalOpen(false);
                        }}
                        isWatched={watchlist.includes(insightSymbol)}
                        onToggleWatch={() => handleToggleWatch(insightSymbol)}
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
