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
    const [error, setError] = useState<string | null>(null);
    const [activeMetric, setActiveMetric] = useState<'upside' | 'cagr2YForward' | 'psgRatio'>('upside');

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

    // Pobranie "ciężkiej" historii dopiero po wybraniu spółki z wyszukiwarki
    useEffect(() => {
        if (!selectedSymbol) return;

        const fetchStockData = async () => {
            setLoadingData(true);
            try {
                const response = await fetch(`/api/stocks?symbol=${selectedSymbol}`);
                if (!response.ok) throw new Error('Błąd pobierania historii giełdowej');
                const result = await response.json();
                setStockData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
            }
        };
        fetchStockData();
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

    const config = getMetricConfig(activeMetric);
    const latestData = stockData.length > 0 ? stockData[stockData.length - 1] : null;
    const selectedCompany = companies.find(c => c.symbol === selectedSymbol);

    return (
        <>
            <h1>Stock Tracker Pro</h1>
            <p className="subtitle">Monitorowanie wskaźników i estymat analityków</p>

            {/* Nowy Wyszukiwarka Premium */}
            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Wyszukaj spółkę po symbolu lub nazwie (np. AAPL, Apple)"
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

            {loadingCompanies && <div className="loading">Wczytywanie bazy spółek...</div>}
            {error && <div className="error">Błąd: {error}</div>}

            {/* Widok pojedynczej spółki */}
            {selectedSymbol && (
                <>
                    <div className="controls">
                        <button
                            className={activeMetric === 'upside' ? 'active' : ''}
                            onClick={() => setActiveMetric('upside')}
                        >
                            Analyst Upside
                        </button>
                        <button
                            className={activeMetric === 'cagr2YForward' ? 'active' : ''}
                            onClick={() => setActiveMetric('cagr2YForward')}
                        >
                            2Y CAGR Forward
                        </button>
                        <button
                            className={activeMetric === 'psgRatio' ? 'active' : ''}
                            onClick={() => setActiveMetric('psgRatio')}
                        >
                            PSG Ratio
                        </button>
                    </div>

                    <div className="dashboard single-dashboard">
                        {loadingData ? (
                            <div className="loading">Pobieranie danych z bazy...</div>
                        ) : (
                            <div className="card large-card">
                                <div className="card-header">
                                    <div>
                                        <h2 className="symbol-name">{selectedSymbol}</h2>
                                        <div className="company-fullname">{selectedCompany?.name}</div>
                                    </div>
                                    {latestData && <span className="current-price">${latestData.price?.toFixed(2)}</span>}
                                </div>

                                <div className="chart-container large-chart">
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
                                                    dataKey={activeMetric}
                                                    name={config.name}
                                                    stroke={config.color}
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: '#0f172a', strokeWidth: 2, stroke: config.color }}
                                                    activeDot={{ r: 6, strokeWidth: 0, fill: config.color }}
                                                />
                                            </LineChart>
                                        ) : (
                                            <div className="empty-state" style={{ marginTop: "8rem" }}>
                                                Spółka nie ma jeszcze pobranych danych w bazie (Cron dopiero ją sprawdzi).
                                            </div>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Stan pusty gdy nic nie jest wybrane */}
            {!selectedSymbol && !loadingCompanies && (
                <div className="empty-state">
                    Wyszukaj i wybierz spółkę powyżej, aby zobaczyć profesjonalne wykresy.
                </div>
            )}
        </>
    );
}

export default App;
