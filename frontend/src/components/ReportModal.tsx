import React from 'react';

type ReportModalProps = {
    report: string | null;
    loading: boolean;
    onClose: () => void;
};

export const ReportModal: React.FC<ReportModalProps> = ({ report, loading, onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
                    <h2 style={{ color: '#ec4899', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✨ Tygodniowy Raport AI
                    </h2>
                </div>
                
                {loading ? (
                    <div style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--text-muted)' }}>
                        <div className="loading-dots" style={{ fontSize: '1.5rem', color: '#8b5cf6' }}></div>
                        <p style={{ marginTop: '1rem' }}>AI analizuje rynki i wyszukuje najnowsze wiadomości dla Twojego portfela...</p>
                        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>To może zająć do kilkunastu sekund w zależności od liczby spółek.</p>
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-main)', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                        {report || 'Brak raportu. Spróbuj wygenerować go ponownie.'}
                    </div>
                )}
            </div>
        </div>
    );
};
