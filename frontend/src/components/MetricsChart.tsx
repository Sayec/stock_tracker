import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type MetricsChartProps = {
    data: any[];
    selectedSymbols: string[];
    activeMetrics: string[];
};

// Paleta kolorów dla poszczególnych spółek na wykresie
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const ChartItem = ({ metric, config, data, selectedSymbols }: { metric: string, config: any, data: any[], selectedSymbols: string[] }) => {
    const crosshairRef = React.useRef<HTMLDivElement>(null);
    const labelRef = React.useRef<HTMLDivElement>(null);
    const chartState = React.useRef<{ p1: any; p2: any }>({ p1: null, p2: null });

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!crosshairRef.current || !labelRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        const { p1, p2 } = chartState.current;
        if (!p1) return;
        
        // Obliczenie granic osi Y (margines górny i orientacyjna oś X na dole)
        const paddingTop = 10;
        const paddingBottom = 30;
        const chartHeight = rect.height - paddingTop - paddingBottom;
        
        if (mouseY < paddingTop || mouseY > paddingTop + chartHeight) {
            crosshairRef.current.style.visibility = 'hidden';
            return;
        }

        let value = p1.value;
        if (p2 && p2.value !== p1.value) {
            // Równanie prostej y = m * x + b
            const m = (p2.cy - p1.cy) / (p2.value - p1.value);
            const b = p1.cy - m * p1.value;
            value = (mouseY - b) / m;
        }

        crosshairRef.current.style.visibility = 'visible';
        crosshairRef.current.style.top = `${mouseY}px`;
        crosshairRef.current.style.left = `0px`; 
        crosshairRef.current.style.width = `${rect.width - 50}px`;

        labelRef.current.textContent = Number(value).toFixed(2);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
        if (crosshairRef.current) {
            crosshairRef.current.style.visibility = 'hidden';
        }
    }, []);

    // Używamy kropek do wyciągnięcia mapowania pikseli względem wartości osi Y.
    // Pobieramy punkty TYLKO dla pierwszej spółki, żeby nie mieszać współrzędnych z wielu linii.
    const renderInvisibleDot = React.useCallback((props: any) => {
        const firstSymbolKey = `${selectedSymbols[0]}_${metric}`;
        
        if (props.dataKey === firstSymbolKey) {
            if (props.index === 0) {
                chartState.current.p1 = props;
            } else if (chartState.current.p1 && props.value !== chartState.current.p1.value) {
                chartState.current.p2 = props;
            }
        }
        return <g />;
    }, [metric, selectedSymbols]);

    return (
        <div className="card" style={{ flex: 1, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ paddingBottom: '0.5rem', marginBottom: '0.5rem', justifyContent: 'space-between', borderBottom: 'none' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: config.color, fontWeight: 600 }}>{config.name}</h3>
                
                {/* Legenda dla spółek */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {selectedSymbols.map((symbol, idx) => (
                        <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[idx % COLORS.length] }} />
                            <span style={{ color: 'var(--text-main)' }}>{symbol}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div 
                className="chart-container" 
                style={{ flex: 1, minHeight: 0, marginTop: 0, position: 'relative' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <ResponsiveContainer width="100%" height="100%">
                    {data.length > 0 ? (
                        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickMargin={10}
                                padding={{ left: 10, right: 10 }}
                            />
                            
                            <YAxis
                                orientation="right"
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                domain={config.domain as any}
                            />
                            
                            {/* Zostawiamy Tooltip tylko dla samej pionowej linii (cursor) */}
                            <Tooltip
                                content={() => null}
                                cursor={{ stroke: 'rgba(255,255,255,0.6)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            />
                            
                            {selectedSymbols.map((symbol, idx) => (
                                <Line
                                    key={symbol}
                                    type="linear"
                                    dataKey={`${symbol}_${metric}`}
                                    name={symbol}
                                    stroke={COLORS[idx % COLORS.length]}
                                    strokeWidth={2}
                                    activeDot={{ r: 5, strokeWidth: 0, fill: COLORS[idx % COLORS.length] }}
                                    dot={renderInvisibleDot}
                                    connectNulls={true}
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <div className="empty-state" style={{ marginTop: "8rem" }}>
                            Brak danych dla wybranych spółek.
                        </div>
                    )}
                </ResponsiveContainer>
                
                {/* Natywny, płynny celownik (poziomy crosshair z etykietą) */}
                <div 
                    ref={crosshairRef} 
                    style={{ 
                        position: 'absolute', 
                        height: '0px', 
                        borderTop: '1.5px dashed rgba(255,255,255,0.6)', 
                        pointerEvents: 'none', 
                        visibility: 'hidden', 
                        zIndex: 100 
                    }}
                >
                    <div 
                        ref={labelRef} 
                        style={{ 
                            position: 'absolute', 
                            right: '-50px', 
                            top: '-10px', 
                            width: '50px',
                            background: config.color, 
                            color: '#0f172a', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            textAlign: 'center',
                            lineHeight: '20px'
                        }}
                    >
                    </div>
                </div>
            </div>
        </div>
    );
};

export const MetricsChart: React.FC<MetricsChartProps> = ({ data, selectedSymbols, activeMetrics }) => {
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
                return <ChartItem key={metric} metric={metric} config={config} data={data} selectedSymbols={selectedSymbols} />;
            })}
        </div>
    );
};
