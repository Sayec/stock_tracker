import React, { useState, useMemo } from 'react';
import type { Company } from '../types';

type SearchBarProps = {
    companies: Company[];
    onSelectCompany: (symbol: string) => void;
};

export const SearchBar: React.FC<SearchBarProps> = ({ companies, onSelectCompany }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCompanies = useMemo(() => {
        if (!searchTerm) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return companies
            .filter(c => c.symbol.toLowerCase().includes(lowerSearch) || c.name.toLowerCase().includes(lowerSearch))
            .slice(0, 10);
    }, [searchTerm, companies]);

    return (
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
                                onSelectCompany(c.symbol);
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
    );
};
