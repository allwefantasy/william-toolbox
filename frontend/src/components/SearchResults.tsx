import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Card, Typography, Space, Timeline, Spin, Select, Modal } from 'antd';
import { SearchOutlined, BulbOutlined, RollbackOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";
import { message as MessageBox } from 'antd';

const { Paragraph, Text } = Typography;
const { Option } = Select;

// 生成UUID函数
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, 
          v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface SearchResultsProps {
  query: string;
  selectedRag: string;
  onBack: () => void;
  onSearch: (query: string, ragName: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  query, 
  selectedRag, 
  onBack, 
  onSearch 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(query);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [result, setResult] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [ragList, setRagList] = useState<string[]>([]);
  const [currentRag, setCurrentRag] = useState(selectedRag);
  const [parsedResults, setParsedResults] = useState<{
    file_path: string;
    count: number;
    score: number;
  }[]>([]);
  const [resultDisplayMode, setResultDisplayMode] = useState<'raw' | 'files'>('raw');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileModalVisible, setFileModalVisible] = useState(false);

  // 加载RAG列表
  useEffect(() => {
    fetchRagList();
  }, []);

  useEffect(() => {
    if (query && selectedRag) {
      performSearch(query, selectedRag);
    }
  }, [query, selectedRag]);
 
  // 获取RAG列表，与Chat.tsx中的fetchItemList保持一致
  const fetchRagList = async () => {
    try {
      const username = sessionStorage.getItem('username') || '';
      
      // 获取用户RAG权限
      const userResponse = await axios.get(`/api/users/${username}`);
      const ragPermissions = userResponse.data.rag_permissions || [];

      // 获取所有RAG并根据权限过滤
      const response = await axios.get('/rags');
      const runningRags = response.data
        .filter((rag: any) => rag.status === 'running' && 
          (ragPermissions.includes('*') || ragPermissions.includes(rag.name)))
        .map((rag: any) => rag.name);
      
      setRagList(runningRags);
      
      // 如果当前选中的RAG不在列表中，则选择第一个可用的RAG
      if (runningRags.length > 0 && !runningRags.includes(currentRag)) {
        setCurrentRag(runningRags[0]);
      }
    } catch (error) {
      console.error('Error fetching RAG list:', error);
      MessageBox.error('获取RAG列表失败');
    }
  };

  const performSearch = async (searchQuery: string, rag: string) => {
    setIsLoading(true);
    setThoughts([]);
    setResult('');
    setParsedResults([]);
    setResultDisplayMode('raw');
    
    try {
      const username = sessionStorage.getItem('username') || '';
      
      // 生成消息ID
      const messageId = generateUUID();

      // 使用与Chat.tsx相同的API接口
      const streamResponse = await axios.post(
        `/chat/search/messages/stream?username=${encodeURIComponent(username)}`,
        {
          messages: [
            {
              id: messageId,
              role: "user",
              content: searchQuery,
              timestamp: new Date().toISOString(),
              extra_metadata: {
                only_contexts: true
              }
            }
          ],
          list_type: "rags",
          selected_item: rag
        }
      );

      if (streamResponse.data && streamResponse.data.request_id) {
        setRequestId(streamResponse.data.request_id);
        let currentIndex = 0;
        let resultContent = '';
        let qaModelThinkingDetected = false;

        // 轮询事件
        while (true) {
          const eventsResponse = await axios.get(`/chat/search/events/${streamResponse.data.request_id}/${currentIndex}`);
          const events = eventsResponse.data.events;

          if (!events || events.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }

          for (const event of events) {
            if (event.event === 'error') {
              throw new Error(event.content);
            }

            if (event.event === "chunk") {
              resultContent += event.content;
              setResult(resultContent);
              
              // Try to parse JSON result if it contains file search results
              try {
                // Check if the content is or ends with a JSON structure containing files
                if (event.content.includes('"files":')) {
                  const jsonMatch = event.content.match(/\{("files":\s*\[.*?\])\}/);
                  if (jsonMatch) {
                    const jsonStr = `{${jsonMatch[1]}}`;
                    const data = JSON.parse(jsonStr);
                    if (data.files && Array.isArray(data.files)) {
                      setParsedResults(data.files);
                      setResultDisplayMode('files');
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing results JSON:', e);
              }
              
              currentIndex = event.index + 1;
            } else if (event.event === "thought") {
              if (qaModelThinkingDetected) {
                setThoughts(prevThoughts => {
                  const updatedThoughts = [...prevThoughts];
                  if (updatedThoughts.length > 0) {
                    updatedThoughts[updatedThoughts.length - 1] += event.content;
                  } else {
                    updatedThoughts.push(event.content);
                  }
                  return updatedThoughts;
                });
              } else {
                setThoughts(prevThoughts => [...prevThoughts, event.content]);
              }

              currentIndex = event.index + 1;

              if (event.content.includes("qa_model_thinking")) {
                qaModelThinkingDetected = true;
              }
            } else if (event.event === "stream_thought") {
              setThoughts(prevThoughts => {
                if (prevThoughts.length === 0) {
                  return [event.content];
                } else {
                  return [
                    prevThoughts[0] + event.content,
                    ...prevThoughts.slice(1)
                  ];
                }
              });
              currentIndex = event.index + 1;
            }

            if (event.event === 'done') {
              setIsLoading(false);
              return;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error performing search:', error);
      setIsLoading(false);
      MessageBox.error('搜索失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleSearch = () => {
    if (!currentQuery.trim() || !currentRag) return;
    performSearch(currentQuery, currentRag);
  };

  const handleRagChange = (value: string) => {
    setCurrentRag(value);
  };

  // Function to fetch file content when a file is clicked
  const handleFileClick = async (filePath: string) => {
    try {
      setSelectedFile(filePath);
      setFileContent('Loading file content...');
      setFileModalVisible(true);
      
      // This would need a backend API endpoint to fetch the file content
      // For now, we'll just show the file path
      setFileContent(`File content for: ${filePath} would be displayed here.`);
      
      // Actual implementation would be something like:
      // const response = await axios.get(`/api/files/content?path=${encodeURIComponent(filePath)}`);
      // setFileContent(response.data.content);
    } catch (error) {
      console.error('Error fetching file content:', error);
      setFileContent('Error loading file content');
    }
  };

  const CodeBlock = ({ language, value }: { language: string, value: string }) => (
    <SyntaxHighlighter language={language} style={coy}>
      {value}
    </SyntaxHighlighter>
  );

  // New component to render file results
  const FileResultsList = () => (
    <div className="file-results-list">
      <div style={{ marginBottom: '15px' }}>
        <Space>
          <Text strong>搜索结果:</Text>
          <Text type="secondary">{parsedResults.length} 个文件匹配</Text>
          <Button 
            size="small" 
            onClick={() => setResultDisplayMode('raw')}
            type="link"
          >
            查看原始结果
          </Button>
        </Space>
      </div>
      
      {parsedResults.map((file, index) => {
        // Extract filename from path
        const fileName = file.file_path.split('/').pop() || file.file_path;
        // Remove "##File: " prefix if it exists
        const cleanPath = file.file_path.replace('##File: ', '');
        
        return (
          <Card 
            key={index} 
            size="small" 
            style={{ marginBottom: '10px', cursor: 'pointer' }}
            onClick={() => handleFileClick(cleanPath)}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>{fileName}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>{cleanPath}</Text>
              </div>
              <div>
                <Space direction="vertical" size="small" align="end">
                  <Text type="secondary">匹配次数: {file.count}</Text>
                  <Text type="secondary">相关度分数: {file.score.toFixed(4)}</Text>
                </Space>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="search-results-container">
      {/* Search Header */}
      <Card style={{ marginBottom: '20px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button 
            icon={<RollbackOutlined />} 
            onClick={onBack}
          >
            返回搜索
          </Button>
          <Space.Compact style={{ width: '60%' }}>
            <Input 
              placeholder="输入搜索关键词..." 
              value={currentQuery}
              onChange={e => setCurrentQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button 
              type="primary" 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
              loading={isLoading}
            >
              搜索
            </Button>
          </Space.Compact>
          
          <Select 
            value={currentRag} 
            style={{ width: 200 }} 
            onChange={handleRagChange}
            placeholder="选择知识库"
          >
            {ragList.map(rag => (
              <Option key={rag} value={rag}>{rag}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* Main content */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Thinking Process */}
        <Card 
          style={{ width: '40%', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
          title={
            <Space>
              <BulbOutlined />
              <span>思考过程</span>
            </Space>
          }
        >
          {thoughts.length > 0 ? (
            <Timeline>
              {thoughts.map((thought, index) => (
                <Timeline.Item
                  key={index}
                  dot={<BulbOutlined style={{ fontSize: '16px', color: '#1890ff' }} />}
                >
                  <ReactMarkdown
                    components={{
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <CodeBlock
                            language={match[1]}
                            value={String(children).replace(/\n$/, '')}
                            {...props}
                          />
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {thought}
                  </ReactMarkdown>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {isLoading ? (
                <Spin size="large" />
              ) : (
                <Paragraph type="secondary">还没有思考过程</Paragraph>
              )}
            </div>
          )}
        </Card>

        {/* Results */}
        <Card 
          style={{ width: '60%', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
          title={
            <Space>
              <SearchOutlined />
              <span>搜索结果</span>
              {resultDisplayMode === 'files' && parsedResults.length > 0 && (
                <Select 
                  defaultValue="relevance" 
                  size="small" 
                  style={{ width: 120 }}
                  onChange={(value) => {
                    const sortedResults = [...parsedResults];
                    if (value === 'relevance') {
                      sortedResults.sort((a, b) => b.score - a.score);
                    } else if (value === 'count') {
                      sortedResults.sort((a, b) => b.count - a.count);
                    } else if (value === 'name') {
                      sortedResults.sort((a, b) => a.file_path.localeCompare(b.file_path));
                    }
                    setParsedResults(sortedResults);
                  }}
                >
                  <Option value="relevance">按相关度排序</Option>
                  <Option value="count">按匹配次数排序</Option>
                  <Option value="name">按文件名排序</Option>
                </Select>
              )}
            </Space>
          }
          ref={resultsContainerRef}
        >
          {result ? (
            resultDisplayMode === 'files' && parsedResults.length > 0 ? (
              <FileResultsList />
            ) : (
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <CodeBlock
                        language={match[1]}
                        value={String(children).replace(/\n$/, '')}
                        {...props}
                      />
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {result}
              </ReactMarkdown>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {isLoading ? (
                <Spin size="large" />
              ) : (
                <Paragraph type="secondary">暂无搜索结果</Paragraph>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* File Content Modal */}
      <Modal
        title={selectedFile ? selectedFile.split('/').pop() : "File Content"}
        open={fileModalVisible}
        onCancel={() => setFileModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setFileModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <pre style={{ 
          maxHeight: '500px', 
          overflow: 'auto', 
          backgroundColor: '#f5f5f5', 
          padding: '15px',
          borderRadius: '4px'
        }}>
          {fileContent}
        </pre>
      </Modal>
    </div>
  );
};

export default SearchResults; 