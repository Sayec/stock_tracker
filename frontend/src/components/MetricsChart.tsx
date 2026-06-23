import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type StockData = {
    date: string;
    price: number;
    cagr2YForward: number;
    psgRatio: number;
    upside: number;
};

type MetricsChartProps = {
    stockData: StockData[];
    activeMetrics: string[];
};

export const MetricsChart: React.FC<MetricsChartProps> = ({ stockData, activeMetrics }) => {
    const getMetricConfig = (metric: string) => {
        switch (metric) {
            case 'upside': return { name: 'Analyst Upside (%)', color: '#10b981', domain: [(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)] };
            case 'cagr2YForward': return { name: '2Y CAGR (%)', color: '#38bdf8', domain: [(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)] };
            case 'psgRatio': return { name: 'PSG Ratio', color: '#f59e0b', domain: [0, (max: number) => max + 0.5] };
            default: return { name: 'Value', color: '#fff', domain: ['auto', 'auto'] };
        }
    };

    if (activeMetrics.length === 0) {
        return <div className="empty-state" style={{ marginTop: '2rem' }}>Wybierz przynajmniej jeden wskaźnik po lewej stronie, aby wyświetlić wykres.</div>;
    }

    return (
        <div className="charts-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 6rem)', gap: '1rem' }}>
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
    );
};
