import { useEffect, useState } from 'react';
import './index.css';
import { ScannerModal } from './components/ScannerModal';
import { SearchBar } from './components/SearchBar';
import { MetricsChart } from './components/MetricsChart';
import { Sidebar } from './components/Sidebar';

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
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [stockData, setStockData] = useState<StockData[]>([]);

    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMetrics, setActiveMetrics] = useState<string[]>(['upside']);
    const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // Skrócone stany dzięki komponentowi ScannerModal
    const [isTopModalOpen, setIsTopModalOpen] = useState(false);

    const toggleMetric = (metric: string) => {
        setActiveMetrics(prev =>
            prev.includes(metric)
                ? prev.filter(m => m !== metric)
                : [...prev, metric]
        );
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

    // Pobranie danych wykresu i AI
    useEffect(() => {
        if (!selectedSymbol) return;

        const fetchData = async () => {
            setLoadingData(true);
            setLoadingSummary(true);
            setAiSummary(null);

            try {
                const [stocksRes, summaryRes] = await Promise.all([
                    fetch(`/api/stocks?symbol=${selectedSymbol}`),
                    fetch(`/api/companies/${selectedSymbol}/summary`)
                ]);

                if (!stocksRes.ok) throw new Error('Błąd pobierania historii giełdowej');
                const stockResult = await stocksRes.json();
                setStockData(stockResult);

                if (summaryRes.ok) {
                    const summaryResult = await summaryRes.json();
                    setAiSummary(summaryResult.aiSummary);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
                setLoadingSummary(false);
            }
        };
        fetchData();
    }, [selectedSymbol]);

    const latestData = stockData.length > 0 ? stockData[stockData.length - 1] : null;
    const selectedCompany = companies.find(c => c.symbol === selectedSymbol);

    return (
        <div className="layout-container">
            <div className="sidebar-controls">
                <h1>Stock Tracker Pro</h1>
                <p className="subtitle">Monitorowanie wskaźników i estymat analityków</p>

                <SearchBar 
                    companies={companies} 
                    onSelectCompany={setSelectedSymbol} 
                />

                <button 
                    className="top-stocks-btn" 
                    onClick={() => setIsTopModalOpen(true)}
                    style={{ background: 'var(--accent)', color: '#000', marginBottom: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', boxShadow: '0 0 15px var(--accent-glow)' }}
                >
                    🏆 Skaner Okazji (Perełki)
                </button>

                {selectedSymbol && (
                    <Sidebar 
                        selectedSymbol={selectedSymbol}
                        selectedCompany={selectedCompany}
                        latestData={latestData}
                        loadingData={loadingData}
                        activeMetrics={activeMetrics}
                        toggleMetric={toggleMetric}
                        aiSummary={aiSummary}
                        loadingSummary={loadingSummary}
                        onOpenInsightModal={() => setIsInsightModalOpen(true)}
                    />
                )}
            </div>

            <div className="main-content">
                {loadingCompanies && <div className="loading">Wczytywanie bazy spółek...</div>}
                {error && <div className="error">Błąd: {error}</div>}

                {/* Widok pojedynczej spółki */}
                {selectedSymbol ? (
                    <div className="dashboard single-dashboard">
                        {loadingData ? (
                            <div className="loading">Pobieranie danych z bazy...</div>
                        ) : (
                            <MetricsChart 
                                stockData={stockData} 
                                activeMetrics={activeMetrics} 
                            />
                        )}
                    </div>
                ) : (
                    !loadingCompanies && (
                        <div className="empty-state" style={{ marginTop: '10rem' }}>
                            Wyszukaj i wybierz spółkę w panelu po lewej, aby zobaczyć profesjonalne wykresy.
                        </div>
                    )
                )}

                {/* Modal AI Insight */}
                {isInsightModalOpen && aiSummary && (
                    <div className="modal-overlay" onClick={() => setIsInsightModalOpen(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close" onClick={() => setIsInsightModalOpen(false)}>×</button>
                            <h2 style={{ color: '#8b5cf6', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ✨ Pełna Analiza AI ({selectedCompany?.symbol})
                            </h2>
                            <div style={{ color: 'var(--text-main)', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                                {aiSummary}
                            </div>
                        </div>
                    </div>
                )}

                {/* Zewnętrzny Komponent: Skaner (Modal) */}
                <ScannerModal 
                    isOpen={isTopModalOpen} 
                    onClose={() => setIsTopModalOpen(false)} 
                    onSelectCompany={setSelectedSymbol} 
                />
            </div>
        </div>
    );
}

export default App;
