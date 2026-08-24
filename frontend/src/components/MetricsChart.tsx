import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import type { MetricOverlaySettings } from '../types';

type MetricsChartProps = {
    data: any[];
    selectedSymbols: string[];
    activeMetrics: string[];
    overlaySettings?: Record<string, MetricOverlaySettings>;
};

// Paleta kolorów dla poszczególnych spółek na wykresie
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function calculateStats(values: number[]) {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    
    // Mediana
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const getPercentile = (p: number) => {
        if (p <= 0) return sorted[0];
        if (p >= 100) return sorted[sorted.length - 1];
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (lower === upper) return sorted[lower];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    return {
        mean,
        median,
        getPercentile
    };
}

const ChartItem = ({ 
    metric, 
    config, 
    data, 
    selectedSymbols, 
    overlay 
}: { 
    metric: string; 
    config: any; 
    data: any[]; 
    selectedSymbols: string[]; 
    overlay?: MetricOverlaySettings; 
}) => {
    const crosshairRef = React.useRef<HTMLDivElement>(null);
    const labelRef = React.useRef<HTMLDivElement>(null);
    const chartState = React.useRef<{ p1: any; p2: any }>({ p1: null, p2: null });

    const [hoverData, setHoverData] = React.useState<{ date?: string; values: Record<string, number> } | null>(null);

    // Ostatnie (najnowsze) wartości z danych dla każdej spółki jako stan domyślny
    const latestValues = React.useMemo(() => {
        if (!data || data.length === 0) return {};
        const lastPoint = data[data.length - 1];
        const res: Record<string, number> = {};
        selectedSymbols.forEach(sym => {
            const val = lastPoint[`${sym}_${metric}`];
            if (val !== undefined && val !== null) {
                res[sym] = val;
            }
        });
        return res;
    }, [data, selectedSymbols, metric]);

    const activeValues = hoverData ? hoverData.values : latestValues;
    const activeDate = hoverData?.date || (data.length > 0 ? data[data.length - 1].date : null);

    const formatVal = (val?: number) => {
        if (val === undefined || val === null || isNaN(val)) return '-';
        if (metric === 'price' || metric === 'targetConsensus') return `$${val.toFixed(2)}`;
        if (metric === 'upside' || metric === 'cagr2YForward') return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
        return val.toFixed(2);
    };

    // Dynamiczny, optymalny zakres osi Y dopasowany do faktycznych wartości
    const yDomain = React.useMemo(() => {
        if (!data || data.length === 0 || selectedSymbols.length === 0) {
            return ['auto', 'auto'];
        }

        const allValues: number[] = [];
        data.forEach(d => {
            selectedSymbols.forEach(sym => {
                const val = d[`${sym}_${metric}`];
                if (val !== undefined && val !== null && !isNaN(val)) {
                    allValues.push(val);
                }
            });
        });

        if (allValues.length === 0) return ['auto', 'auto'];

        let min = Math.min(...allValues);
        let max = Math.max(...allValues);

        // Uwzględnij linie statystyczne, jeśli są aktywne
        if (overlay?.showMean || overlay?.showMedian || overlay?.showChannel) {
            const stats = calculateStats(allValues);
            if (stats) {
                if (overlay.showMean) {
                    min = Math.min(min, stats.mean);
                    max = Math.max(max, stats.mean);
                }
                if (overlay.showMedian) {
                    min = Math.min(min, stats.median);
                    max = Math.max(max, stats.median);
                }
                if (overlay.showChannel) {
                    const low = stats.getPercentile(overlay.channelLowerPercentile ?? 20);
                    const high = stats.getPercentile(overlay.channelUpperPercentile ?? 80);
                    min = Math.min(min, low);
                    max = Math.max(max, high);
                }
            }
        }

        const diff = max - min;
        const pad = diff > 0 ? diff * 0.12 : (Math.abs(min) > 0 ? Math.abs(min) * 0.08 : 0.5);

        let lower = min - pad;
        let upper = max + pad;

        const precision = (metric === 'price' || metric === 'targetConsensus') ? 1 : 2;
        lower = Number(lower.toFixed(precision));
        upper = Number(upper.toFixed(precision));

        return [lower, upper];
    }, [data, selectedSymbols, metric, overlay]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        React.useEffect(() => {
            if (active && payload && payload.length > 0) {
                const values: Record<string, number> = {};
                payload.forEach((item: any) => {
                    if (item.name && item.value !== undefined && item.value !== null) {
                        values[item.name] = item.value;
                    }
                });
                setHoverData({ date: label, values });
            } else {
                setHoverData(null);
            }
        }, [active, payload, label]);

        return null;
    };

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!crosshairRef.current || !labelRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        const { p1, p2 } = chartState.current;
        if (!p1) return;
        
        const paddingTop = 10;
        const paddingBottom = 30;
        const chartHeight = rect.height - paddingTop - paddingBottom;
        
        if (mouseY < paddingTop || mouseY > paddingTop + chartHeight) {
            crosshairRef.current.style.visibility = 'hidden';
            return;
        }

        let value = p1.value;
        if (p2 && p2.value !== p1.value) {
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
        setHoverData(null);
    }, []);

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
        <div className="card chart-card" style={{ position: 'relative' }}>
            <div className="card-header chart-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', position: 'relative' }}>
                <div>
                    <h3 className="chart-title" style={{ color: config.color, margin: 0, fontSize: '1.1rem' }}>{config.name}</h3>
                    {activeDate && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Data: <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{activeDate}</span>
                        </div>
                    )}
                </div>
                
                {/* Prawa strona nagłówka: Dynamiczna Legenda */}
                <div className="chart-legend" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedSymbols.map((symbol, idx) => {
                        const val = activeValues[symbol];
                        const color = COLORS[idx % COLORS.length];
                        return (
                            <div 
                                key={symbol} 
                                className="chart-legend-item" 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.4rem', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    padding: '0.25rem 0.6rem', 
                                    borderRadius: '6px', 
                                    border: `1px solid ${hoverData ? color : 'rgba(255,255,255,0.1)'}`,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                                <span style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '0.85rem' }}>{symbol}:</span>
                                <span style={{ color: color, fontWeight: 'bold', fontSize: '0.9rem' }}>{formatVal(val)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div 
                className="chart-container chart-body"
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
                                domain={yDomain as any}
                            />
                            
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: 'rgba(255,255,255,0.6)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            />

                            {/* 1. Horizontal Channel (Korytarz z percentyli) */}
                            {overlay?.showChannel && selectedSymbols.map((symbol, idx) => {
                                const values = data.map(d => d[`${symbol}_${metric}`]).filter(v => v !== undefined && v !== null && !isNaN(v));
                                const stats = calculateStats(values);
                                if (!stats) return null;
                                const low = stats.getPercentile(overlay.channelLowerPercentile ?? 20);
                                const high = stats.getPercentile(overlay.channelUpperPercentile ?? 80);
                                const color = COLORS[idx % COLORS.length];
                                return (
                                    <ReferenceArea
                                        key={`channel_${symbol}`}
                                        y1={low}
                                        y2={high}
                                        fill={color}
                                        fillOpacity={0.12}
                                        stroke={color}
                                        strokeDasharray="3 3"
                                        strokeOpacity={0.35}
                                        ifOverflow="visible"
                                    />
                                );
                            })}

                            {/* 2. Średnia (Mean) */}
                            {overlay?.showMean && selectedSymbols.map((symbol, idx) => {
                                const values = data.map(d => d[`${symbol}_${metric}`]).filter(v => v !== undefined && v !== null && !isNaN(v));
                                const stats = calculateStats(values);
                                if (!stats) return null;
                                const color = COLORS[idx % COLORS.length];
                                return (
                                    <ReferenceLine
                                        key={`mean_${symbol}`}
                                        y={stats.mean}
                                        stroke={color}
                                        strokeDasharray="5 5"
                                        strokeWidth={1.5}
                                        strokeOpacity={0.85}
                                        label={{ value: `${symbol} Śr: ${formatVal(stats.mean)}`, fill: color, fontSize: 10, position: 'insideTopLeft' }}
                                        ifOverflow="visible"
                                    />
                                );
                            })}

                            {/* 3. Mediana (Median) */}
                            {overlay?.showMedian && selectedSymbols.map((symbol, idx) => {
                                const values = data.map(d => d[`${symbol}_${metric}`]).filter(v => v !== undefined && v !== null && !isNaN(v));
                                const stats = calculateStats(values);
                                if (!stats) return null;
                                const color = COLORS[idx % COLORS.length];
                                return (
                                    <ReferenceLine
                                        key={`median_${symbol}`}
                                        y={stats.median}
                                        stroke={color}
                                        strokeDasharray="2 2"
                                        strokeWidth={1.5}
                                        strokeOpacity={0.9}
                                        label={{ value: `${symbol} Med: ${formatVal(stats.median)}`, fill: color, fontSize: 10, position: 'insideBottomLeft' }}
                                        ifOverflow="visible"
                                    />
                                );
                            })}
                            
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
                
                {/* Natywny celownik poziomy */}
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

export const MetricsChart: React.FC<MetricsChartProps> = ({ 
    data, 
    selectedSymbols, 
    activeMetrics, 
    overlaySettings
}) => {
    const getMetricConfig = (metric: string) => {
        switch (metric) {
            case 'price': return { name: 'Cena ($)', color: '#ec4899', domain: ['auto', 'auto'] };
            case 'targetConsensus': return { name: 'Price Target ($)', color: '#a855f7', domain: ['auto', 'auto'] };
            case 'upside': return { name: 'Analyst Upside (%)', color: '#10b981', domain: [(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)] };
            case 'cagr2YForward': return { name: '2Y CAGR (%)', color: '#38bdf8', domain: [(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)] };
            case 'psRatioForward': return { name: 'P/S 2Y Forward', color: '#6366f1', domain: [0, (max: number) => Math.ceil(max + 1)] };
            case 'psgRatio': return { name: 'PSG Ratio', color: '#f59e0b', domain: [0, (max: number) => max + 0.5] };
            default: return { name: 'Value', color: '#fff', domain: ['auto', 'auto'] };
        }
    };

    if (activeMetrics.length === 0) {
        return <div className="empty-state" style={{ marginTop: '2rem' }}>Wybierz przynajmniej jeden wskaźnik po lewej stronie, aby wyświetlić wykres.</div>;
    }

    return (
        <div className="charts-list charts-list-container">
            {activeMetrics.map(metric => {
                const config = getMetricConfig(metric);
                const overlay = overlaySettings?.[metric];
                return (
                    <ChartItem 
                        key={metric} 
                        metric={metric} 
                        config={config} 
                        data={data} 
                        selectedSymbols={selectedSymbols} 
                        overlay={overlay}
                    />
                );
            })}
        </div>
    );
};

