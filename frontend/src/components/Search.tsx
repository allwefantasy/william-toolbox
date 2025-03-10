import React, { useState } from 'react';
import SearchHome from './SearchHome';
import SearchResults from './SearchResults';

const Search: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'home' | 'results'>('home');
  const [query, setQuery] = useState('');
  const [selectedRag, setSelectedRag] = useState('');

  const handleSearch = (searchQuery: string, ragName: string) => {
    setQuery(searchQuery);
    setSelectedRag(ragName);
    setCurrentPage('results');
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
  };

  return (
    <>
      {currentPage === 'home' && (
        <SearchHome onSearch={handleSearch} />
      )}
      
      {currentPage === 'results' && (
        <SearchResults 
          query={query} 
          selectedRag={selectedRag} 
          onBack={handleBackToHome}
          onSearch={handleSearch}
        />
      )}
    </>
  );
};

export default Search; 