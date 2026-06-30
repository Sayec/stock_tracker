import { useEffect, useState } from 'react';
import './index.css';
import { SearchBar } from './components/SearchBar';
import { MetricsChart } from './components/MetricsChart';
import { Sidebar } from './components/Sidebar';
import { StockScreener } from './components/StockScreener';

type StockData = {
    date: string;
    price: number;
    cagr2YForward: number;
    psgRatio: number;
    upside: number;
};

type Company = {
    symbol: string;
    name: string;
};

function App() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
    const [stockDataMap, setStockDataMap] = useState<Record<string, StockData[]>>({});
    
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMetrics, setActiveMetrics] = useState<string[]>(['upside']);
    const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
    const [insightSymbol, setInsightSymbol] = useState<string | null>(null);
    const [aiSummaryMap, setAiSummaryMap] = useState<Record<string, string>>({});

    const [viewMode, setViewMode] = useState<'chart' | 'screener'>('screener');

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

    const handleOpenInsightModal = async (symbol: string) => {
        setInsightSymbol(symbol);
        setIsInsightModalOpen(true);
        
        if (!aiSummaryMap[symbol]) {
            setLoadingSummary(true);
            try {
                const res = await fetch(`/api/companies/${symbol}/summary`);
                if (res.ok) {
                    const data = await res.json();
                    setAiSummaryMap(prev => ({ ...prev, [symbol]: data.aiSummary }));
                }
            } catch (e) {
                console.error("AI Insight error", e);
            } finally {
                setLoadingSummary(false);
            }
        }
    };

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
                    onSelectCompany={handleSelectSymbol}
                />

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button
                        className="top-stocks-btn"
                        onClick={() => setViewMode('screener')}
                        style={{ 
                            flex: 1, 
                            background: viewMode === 'screener' ? 'var(--accent)' : 'rgba(255,255,255,0.05)', 
                            color: viewMode === 'screener' ? '#000' : '#fff', 
                            display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center',
                            boxShadow: viewMode === 'screener' ? '0 0 15px var(--accent-glow)' : 'none'
                        }}
                    >
                        🏆 Skaner
                    </button>
                    <button
                        className="top-stocks-btn"
                        onClick={() => setViewMode('chart')}
                        style={{ 
                            flex: 1, 
                            background: viewMode === 'chart' ? 'var(--accent)' : 'rgba(255,255,255,0.05)', 
                            color: viewMode === 'chart' ? '#000' : '#fff', 
                            display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center',
                            boxShadow: viewMode === 'chart' ? '0 0 15px var(--accent-glow)' : 'none'
                        }}
                    >
                        📈 Wykresy
                    </button>
                </div>

                {viewMode === 'chart' && (
                    <Sidebar
                        selectedSymbols={selectedSymbols}
                        companies={companies}
                        activeMetrics={activeMetrics}
                        toggleMetric={toggleMetric}
                        onRemoveSymbol={handleRemoveSymbol}
                        onOpenInsightModal={handleOpenInsightModal}
                    />
                )}
            </div>

            <div className="main-content">
                {loadingCompanies && <div className="loading">Wczytywanie bazy spółek...</div>}
                {error && <div className="error">Błąd: {error}</div>}

                {/* Kontener Skanera */}
                <div style={{ display: viewMode === 'screener' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <StockScreener onSelectCompany={handleSelectSymbol} selectedSymbols={selectedSymbols} />
                </div>

                {/* Kontener Wykresów */}
                <div style={{ display: viewMode === 'chart' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {selectedSymbols.length > 0 ? (
                        <div className="dashboard single-dashboard" style={{ flex: 1 }}>
                            {loadingData ? (
                                <div className="loading">Pobieranie danych giełdowych...</div>
                            ) : (
                                <MetricsChart
                                    data={mergedData}
                                    selectedSymbols={selectedSymbols}
                                    activeMetrics={activeMetrics}
                                />
                            )}
                        </div>
                    ) : (
                        !loadingCompanies && (
                            <div className="empty-state" style={{ marginTop: '10rem' }}>
                                Wyszukaj i dodaj spółki z panelu bocznego lub kliknij spółkę w Skanerze, aby zobaczyć i porównać profesjonalne wykresy.
                            </div>
                        )
                    )}
                </div>

                {/* Modal AI Insight */}
                {isInsightModalOpen && insightSymbol && (
                    <div className="modal-overlay" onClick={() => setIsInsightModalOpen(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close" onClick={() => setIsInsightModalOpen(false)}>×</button>
                            <h2 style={{ color: '#8b5cf6', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ✨ Pełna Analiza AI ({insightSymbol})
                            </h2>
                            {loadingSummary ? (
                                <div className="loading">Trwa odpytywanie Gemini...</div>
                            ) : (
                                <div style={{ color: 'var(--text-main)', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                                    {aiSummaryMap[insightSymbol] || 'Brak podsumowania.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
