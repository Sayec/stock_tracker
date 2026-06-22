import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './index.css';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [stockData, setStockData] = useState<StockData[]>([]);

    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMetrics, setActiveMetrics] = useState<string[]>(['upside']);
    const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    const toggleMetric = (metric: string) => {
        setActiveMetrics(prev =>
            prev.includes(metric)
                ? prev.filter(m => m !== metric)
                : [...prev, metric]
        );
    };

    // Pobranie zaledwie samej listy spółek przy starcie aplikacji
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

    // Pobranie "ciężkiej" historii oraz podsumowania AI dopiero po wybraniu spółki z wyszukiwarki
    useEffect(() => {
        if (!selectedSymbol) return;

        const fetchData = async () => {
            setLoadingData(true);
            setLoadingSummary(true);
            setAiSummary(null);

            try {
                // Równoległe pobranie wskaźników i zapytanie do AI
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

    // Błyskawiczne filtrowanie bez obciążania backendu
    const filteredCompanies = useMemo(() => {
        if (!searchTerm) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return companies
            .filter(c => c.symbol.toLowerCase().includes(lowerSearch) || c.name.toLowerCase().includes(lowerSearch))
            .slice(0, 10); // Limit do 10 wyników dla estetyki
    }, [searchTerm, companies]);

    const getMetricConfig = (metric: string) => {
        switch (metric) {
            case 'upside': return { name: 'Analyst Upside (%)', color: '#10b981', domain: ['auto', 'auto'] };
            case 'cagr2YForward': return { name: '2Y CAGR (%)', color: '#38bdf8', domain: ['auto', 'auto'] };
            case 'psgRatio': return { name: 'PSG Ratio', color: '#f59e0b', domain: [0, 'auto'] };
            default: return { name: 'Value', color: '#fff', domain: ['auto', 'auto'] };
        }
    };

    const latestData = stockData.length > 0 ? stockData[stockData.length - 1] : null;
    const selectedCompany = companies.find(c => c.symbol === selectedSymbol);

    return (
        <div className="layout-container">
            <div className="sidebar-controls">
                <h1>Stock Tracker Pro</h1>
                <p className="subtitle">Monitorowanie wskaźników i estymat analityków</p>

                {/* Nowy Wyszukiwarka Premium */}
                <div className="search-container">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Wyszukaj spółkę po symbolu..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {filteredCompanies.length > 0 && (
                        <div className="search-results">
                            {filteredCompanies.map(c => (
                                <div
                                    key={c.symbol}
                                    className="search-result-item"
                                    onClick={() => {
                                        setSelectedSymbol(c.symbol);
                                        setSearchTerm('');
                                    }}
                                >
                                    <span className="item-symbol">{c.symbol}</span>
                                    <span className="item-name">{c.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedSymbol && (
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
                                            <button className="read-more-btn" onClick={() => setIsInsightModalOpen(true)}>
                                                Czytaj dalej...
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
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
                            <div className="charts-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 6rem)', gap: '1rem' }}>
                                {activeMetrics.length === 0 && (
                                    <div className="empty-state" style={{ marginTop: '2rem' }}>Wybierz przynajmniej jeden wskaźnik po lewej stronie, aby wyświetlić wykres.</div>
                                )}

                                {activeMetrics.map(metric => {
                                    const config = getMetricConfig(metric);
                                    return (
                                        <div key={metric} className="card" style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                            <div className="card-header" style={{ paddingBottom: '0.5rem', marginBottom: '0.5rem', justifyContent: 'center', borderBottom: 'none' }}>
                                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: config.color, fontWeight: 600 }}>{config.name}</h3>
                                            </div>

                                            <div className="chart-container" style={{ flex: 1, minHeight: 0, marginTop: 0 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    {stockData.length > 0 ? (
                                                        <LineChart data={stockData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                                            <XAxis
                                                                dataKey="date"
                                                                stroke="#94a3b8"
                                                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                                                tickMargin={10}
                                                            />
                                                            <YAxis
                                                                stroke="#94a3b8"
                                                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                                                domain={config.domain as any}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey={metric}
                                                                name={config.name}
                                                                stroke={config.color}
                                                                strokeWidth={3}
                                                                dot={{ r: 4, fill: '#0f172a', strokeWidth: 2, stroke: config.color }}
                                                                activeDot={{ r: 4, strokeWidth: 0, fill: config.color }}
                                                            />
                                                        </LineChart>
                                                    ) : (
                                                        <div className="empty-state" style={{ marginTop: "8rem" }}>
                                                            Spółka nie ma jeszcze pobranych danych w bazie.
                                                        </div>
                                                    )}
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Stan pusty gdy nic nie jest wybrane */
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
            </div>
        </div>
    );
}

export default App;
