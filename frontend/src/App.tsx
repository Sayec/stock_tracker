import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './index.css';

type StockData = {
    date: string;
    price: number;
    cagr2YForward: number;
    psgRatio: number;
    upside: number;
};

type GroupedData = {
    [symbol: string]: StockData[];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
    const [data, setData] = useState<GroupedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeMetric, setActiveMetric] = useState<'upside' | 'cagr2YForward' | 'psgRatio'>('upside');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${API_URL}/api/stocks`);
                if (!response.ok) throw new Error('Błąd połączenia z serwerem API');
                const result = await response.json();
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="loading">Ładowanie danych analitycznych...</div>;
    if (error) return <div className="error">Błąd: {error}</div>;
    if (!data) return null;

    const symbols = Object.keys(data);

    const getMetricConfig = (metric: string) => {
        switch (metric) {
            case 'upside': return { name: 'Analyst Upside (%)', color: '#10b981', domain: ['auto', 'auto'] };
            case 'cagr2YForward': return { name: '2Y CAGR (%)', color: '#38bdf8', domain: ['auto', 'auto'] };
            case 'psgRatio': return { name: 'PSG Ratio', color: '#f59e0b', domain: [0, 'auto'] };
            default: return { name: 'Value', color: '#fff', domain: ['auto', 'auto'] };
        }
    };

    const config = getMetricConfig(activeMetric);

    return (
        <>
            <h1>Stock Tracker Pro</h1>
            <p className="subtitle">Monitorowanie wskaźników i estymat analityków</p>

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

            <div className="dashboard">
                {symbols.map(symbol => {
                    const symbolData = data[symbol];
                    const latestData = symbolData[symbolData.length - 1];

                    return (
                        <div className="card" key={symbol}>
                            <div className="card-header">
                                <h2 className="symbol-name">{symbol}</h2>
                                <span className="current-price">${latestData?.price?.toFixed(2)}</span>
                            </div>
                            
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={symbolData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            stroke="#94a3b8" 
                                            tick={{fill: '#94a3b8', fontSize: 12}} 
                                            tickMargin={10}
                                        />
                                        <YAxis 
                                            stroke="#94a3b8" 
                                            tick={{fill: '#94a3b8', fontSize: 12}}
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
                                </ResponsiveContainer>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default App;
