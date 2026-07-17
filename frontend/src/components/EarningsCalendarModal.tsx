import React from 'react';
import type { QuoteInfo } from '../types';

type EarningsCalendarModalProps = {
    quotes: QuoteInfo[];
    onClose: () => void;
    onGoToCompany: (symbol: string) => void;
};

export const EarningsCalendarModal: React.FC<EarningsCalendarModalProps> = ({ quotes, onClose, onGoToCompany }) => {
    // Filtrujemy tylko te, które mają datę i sortujemy chronologicznie
    const upcoming = quotes
        .filter(q => q.earningsDate)
        .sort((a, b) => new Date(a.earningsDate!).getTime() - new Date(b.earningsDate!).getTime());

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div className="modal-header-container">
                    <h2 className="modal-title" style={{ color: '#3b82f6' }}>
                        📅 Kalendarz Wyników
                    </h2>
                </div>
                
                <div style={{ padding: '1rem' }}>
                    {upcoming.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                            Brak zaplanowanych wyników dla obserwowanych spółek.
                        </div>
                    ) : (
                        <div className="calendar-list">
                            {upcoming.map(q => {
                                const dateObj = new Date(q.earningsDate!);
                                const today = new Date();
                                const diffDays = Math.ceil((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                
                                let statusClass = 'status-normal';
                                if (diffDays < 0) statusClass = 'status-past';
                                else if (diffDays <= 7) statusClass = 'status-soon';

                                return (
                                    <div key={q.symbol} className="calendar-item" onClick={() => {
                                        onClose();
                                        onGoToCompany(q.symbol);
                                    }}>
                                        <div className="calendar-date-box">
                                            <div className="calendar-month">{dateObj.toLocaleString('pl-PL', { month: 'short' }).toUpperCase()}</div>
                                            <div className="calendar-day">{dateObj.getDate()}</div>
                                        </div>
                                        <div className="calendar-info">
                                            <span className="calendar-symbol">{q.symbol}</span>
                                            <span className={`calendar-status ${statusClass}`}>
                                                {diffDays < 0 ? 'Minęło' : diffDays === 0 ? 'Dziś!' : `Za ${diffDays} dni`}
                                            </span>
                                        </div>
                                        <div className="calendar-action">
                                            <span>👉 Raport</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
