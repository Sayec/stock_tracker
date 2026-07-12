import React, { useEffect, useState } from 'react';
import type { QuoteInfo } from '../types';

type ReportModalProps = {
    watchlist: string[];
    onClose: () => void;
    onGoToChart: (symbol: string) => void;
};

export const ReportModal: React.FC<ReportModalProps> = ({ watchlist, onClose, onGoToChart }) => {
    const [quotes, setQuotes] = useState<QuoteInfo[]>([]);
    const [loadingQuotes, setLoadingQuotes] = useState(true);
    
    const [report, setReport] = useState<string | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        const fetchQuotes = async () => {
            if (watchlist.length === 0) {
                setLoadingQuotes(false);
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
                    setQuotes(data.quotes || []);
                }
            } catch (err) {
                console.error("Error fetching quotes:", err);
            } finally {
                setLoadingQuotes(false);
            }
        };

        fetchQuotes();
    }, [watchlist]);

    const handleGenerateAiReport = async () => {
        if (watchlist.length === 0) return;
        setLoadingReport(true);
        try {
            const res = await fetch('/api/portfolio/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: watchlist })
            });
            const data = await res.json();
            if (data.report) {
                setReport(data.report);
            } else {
                setReport('Wystąpił błąd podczas generowania raportu: ' + data.error);
            }
        } catch (err: any) {
            setReport('Błąd połączenia z serwerem: ' + err.message);
        } finally {
            setLoadingReport(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
                    <h2 style={{ color: '#ec4899', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✨ Raport Tygodnia
                    </h2>
                </div>
                
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.2rem' }}>Twoje obserwowane spółki ({watchlist.length})</h3>
                    {loadingQuotes ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Pobieranie aktualnych notowań...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '1rem' }}>Symbol</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Cena</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Zmiana (1D)</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map(q => (
                                    <tr key={q.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent)' }}>{q.symbol}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>${q.price?.toFixed(2)}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: q.changePercent >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                            {q.changePercent >= 0 ? '+' : ''}{q.changePercent?.toFixed(2)}%
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => onGoToChart(q.symbol)}
                                                style={{
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    color: '#8b5cf6',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                📈 Wykres
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {quotes.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Brak danych.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                    {!report && !loadingReport && (
                        <div style={{ textAlign: 'center' }}>
                            <button
                                onClick={handleGenerateAiReport}
                                style={{
                                    background: 'linear-gradient(45deg, #8b5cf6, #ec4899)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '1rem 2rem',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                                }}
                            >
                                🤖 Generuj Podsumowanie Wiadomości AI
                            </button>
                            <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>AI przeanalizuje najnowsze wiadomości rynkowe dla wszystkich powyższych spółek.</p>
                        </div>
                    )}

                    {loadingReport && (
                        <div style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>
                            <div className="loading-dots" style={{ fontSize: '1.5rem', color: '#8b5cf6' }}></div>
                            <p style={{ marginTop: '1rem' }}>AI analizuje rynki i wyszukuje najnowsze wiadomości dla Twojego portfela...</p>
                            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>To może zająć do kilkunastu sekund w zależności od liczby spółek.</p>
                        </div>
                    )}

                    {report && !loadingReport && (
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                            <h3 style={{ color: '#ec4899', marginTop: 0, marginBottom: '1rem' }}>Podsumowanie AI</h3>
                            <div style={{ color: 'var(--text-main)', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                                {report}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
