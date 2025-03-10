import React, { useState, useEffect } from 'react';
import { Input, Button, Select, Typography, Space, List, Divider } from 'antd';
import { SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

interface SearchHomeProps {
  onSearch: (query: string, ragName: string) => void;
}

const SearchHome: React.FC<SearchHomeProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [selectedRag, setSelectedRag] = useState<string>('');
  const [ragList, setRagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Fetch RAG list and recent searches
  useEffect(() => {
    fetchRagList();
    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches).slice(0, 5));
    }
  }, []);

  const fetchRagList = async () => {
    try {
      const username = sessionStorage.getItem('username') || '';
      
      // Get user RAG permissions
      const userResponse = await axios.get(`/api/users/${username}`);
      const ragPermissions = userResponse.data.rag_permissions || [];

      // Get all RAGs and filter by permissions
      const response = await axios.get('/rags');
      const runningRags = response.data
        .filter((rag: any) => rag.status === 'running' && 
          (ragPermissions.includes('*') || ragPermissions.includes(rag.name)))
        .map((rag: any) => rag.name);
      
      setRagList(runningRags);
      if (runningRags.length > 0) {
        setSelectedRag(runningRags[0]);
      }
    } catch (error) {
      console.error('Error fetching RAG list:', error);
    }
  };

  const handleSearch = () => {
    if (!query.trim() || !selectedRag) return;
    setLoading(true);
    
    // Save to recent searches
    const updatedSearches = [query, ...recentSearches.filter(item => item !== query)].slice(0, 5);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    
    onSearch(query, selectedRag);
    setLoading(false);
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    // Optional: automatically perform search
    // setTimeout(() => handleSearch(), 100);
  };

  return (
    <div className="search-home-container" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '80px 20px 0',
      minHeight: 'calc(100vh - 160px)',
      background: '#fff'
    }}>
      {/* Logo and Title */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <Title 
          level={1} 
          style={{ 
            fontSize: '42px', 
            marginBottom: '12px',
            color: '#1967d2',
            fontWeight: 500,
            letterSpacing: '-1px'
          }}
        >
          知识库搜索
        </Title>
        <Text style={{ fontSize: '16px', color: '#5f6368' }}>
          快速搜索文档原文
        </Text>
      </div>
      
      {/* Search Box */}
      <div style={{ 
        width: '100%', 
        maxWidth: '650px',
        marginBottom: '30px'
      }}>
        {/* Knowledge Base Selection */}
        <Select
          placeholder="选择知识库"
          style={{ 
            width: '100%', 
            marginBottom: '16px'
          }}
          value={selectedRag || undefined}
          onChange={(value) => setSelectedRag(value)}
          size="large"
          bordered
          suffixIcon={<SearchOutlined style={{ color: '#5f6368' }} />}
          dropdownStyle={{ borderRadius: '4px' }}
        >
          {ragList.map(rag => (
            <Option key={rag} value={rag}>{rag}</Option>
          ))}
        </Select>
        
        {/* Search Input */}
        <div style={{ 
          border: '1px solid #dfe1e5',
          borderRadius: '24px',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 6px rgba(32,33,36,0.28)',
          transition: 'all 0.3s',
          width: '100%',
          background: '#fff',
          maxWidth: '650px'
        }}>
          <SearchOutlined style={{ fontSize: '20px', color: '#9aa0a6', margin: '0 12px' }} />
          <Input 
            placeholder="输入搜索关键词..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            onPressEnter={handleSearch}
            size="large"
            style={{ 
              border: 'none',
              fontSize: '16px',
              flex: 1,
              boxShadow: 'none',
              padding: '12px 0'
            }}
            bordered={false}
          />
          {query && (
            <Button 
              type="text" 
              size="small" 
              onClick={() => setQuery('')}
              style={{ marginRight: '8px', color: '#70757a' }}
            >
              ✕
            </Button>
          )}
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          margin: '24px 0' 
        }}>
          <Button 
            size="large"
            onClick={handleSearch}
            loading={loading}
            style={{ 
              marginRight: '12px',
              backgroundColor: '#f8f9fa',
              borderColor: '#f8f9fa',
              color: '#3c4043',
              fontWeight: 400,
              padding: '0 16px',
              borderRadius: '4px',
              height: '36px'
            }}
          >
            搜索
          </Button>
        </div>
      </div>
      
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div style={{ maxWidth: '650px', width: '100%' }}>
          <Divider plain>
            <Space>
              <HistoryOutlined style={{ color: '#5f6368' }} />
              <span style={{ color: '#5f6368', fontSize: '14px' }}>最近搜索</span>
            </Space>
          </Divider>
          
          <List
            size="small"
            bordered={false}
            dataSource={recentSearches}
            renderItem={(item) => (
              <List.Item 
                style={{ 
                  cursor: 'pointer', 
                  padding: '8px 16px',
                  color: '#1a73e8',
                  borderRadius: '4px'
                }}
                onClick={() => handleRecentSearchClick(item)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f3f4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <HistoryOutlined style={{ marginRight: '8px', fontSize: '14px', color: '#70757a' }} />
                <span>{item}</span>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );
};

export default SearchHome; 