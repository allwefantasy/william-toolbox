import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Tag, Steps, Input } from 'antd';
import { FileOutlined, MessageOutlined, CodeOutlined, SearchOutlined, RobotOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactTypingEffect from 'react-typing-effect';
import './AnimatedWorkflowView.css';
import ReactTypingEffect from 'react-typing-effect';
import './AnimatedWorkflowView.css';

const { Text, Title } = Typography;

interface FileChange {
  path: string;
  change_type: 'added' | 'modified';
}

interface Query {
  query: string;
  timestamp?: string;
  response?: string;
  urls?: string[];
  file_number: number;  
}

interface DiffResponse {
  diff: string;
  file_changes: FileChange[];
}

interface AnimatedWorkflowViewProps {
  queries: Query[];
  onShowDiff: (response: string | undefined) => Promise<DiffResponse>;
}

const AnimatedWorkflowView: React.FC<AnimatedWorkflowViewProps> = ({ queries, onShowDiff }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [currentDiff, setCurrentDiff] = useState('');
  const [currentFileChanges, setCurrentFileChanges] = useState<FileChange[]>([]);
  const [sortedQueries, setSortedQueries] = useState<Query[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isTypingEffect, setIsTypingEffect] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isTypingEffect, setIsTypingEffect] = useState(false);

  useEffect(() => {
    // 按 file_number 从小到大排序
    const sorted = [...queries].sort((a, b) => a.file_number - b.file_number);
    setSortedQueries(sorted);
  }, [queries]);

  useEffect(() => {
    if (isPlaying) {
      const timer = setInterval(async () => {
        if (currentSubStep < 2) {
          setCurrentSubStep(prev => prev + 1);
        } else {
          if (currentStep < sortedQueries.length - 1) {
            setCurrentStep(prev => prev + 1);
            setCurrentSubStep(0);
          } else {
            setIsPlaying(false);
          }
        }
      }, 3000); // 3秒切换一个子步骤

      return () => clearInterval(timer);
    }
  }, [isPlaying, currentStep, currentSubStep, sortedQueries.length]);

  useEffect(() => {
    const loadDiffAndChanges = async () => {
      if (currentSubStep === 2 && sortedQueries[currentStep]?.response) {
        const response = sortedQueries[currentStep].response;
        const diffResponse = await onShowDiff(response);
        setCurrentDiff(diffResponse.diff);
        setCurrentFileChanges(diffResponse.file_changes);        
      }
    };
    loadDiffAndChanges();
  }, [currentSubStep, currentStep, sortedQueries, onShowDiff]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setCurrentSubStep(0);
    setIsPlaying(false);
    setCurrentDiff('');
    setCurrentFileChanges([]);
  }, []);

  const renderContent = () => {
    const currentQuery = sortedQueries[currentStep];    
    if (!currentQuery) return null;

    switch (currentSubStep) {
      case 0: // 展示查询内容
        return (
          <div className="animated-content">
            <Title level={4}>
              <Space>
                <RobotOutlined spin={isTypingEffect} />
                用户需求
              </Space>
            </Title>
            <Card className="query-card">
              {isTypingEffect ? (
                <ReactTypingEffect
                  text={[currentQuery.query]}
                  speed={50}
                  eraseDelay={1000000}
                  typingDelay={0}
                  className="typing-effect"
                  // onTypingEnd={() => setIsTypingEffect(false)}
                />
              ) : (
                <pre>{currentQuery.query}</pre>
              )}
            </Card>
            <div className="input-section">
              <Input.Search
                placeholder="输入您的需求,按回车键自动搜索相关文件..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onSearch={handleSearch}
                loading={isSearching}
                enterButton={
                  <Button type="primary" icon={<SearchOutlined />}>
                    搜索文件
                  </Button>
                }
              />
            </div>
          </div>
        );  
      case 1: // 展示相关文件
        return (
          <div className="animated-content search-animation">
            <Title level={4}>
              <Space>
                <SearchOutlined spin={isSearching} />
                收集的相关文件
              </Space>
            </Title>
  const renderContent = () => {
    const currentQuery = sortedQueries[currentStep];    
    if (!currentQuery) return null;

    switch (currentSubStep) {
      case 0: // 展示查询内容
        return (
          <div className="animated-content">
            <Title level={4}>
              <Space>
                <RobotOutlined spin={isTypingEffect} />
                用户需求
              </Space>
            </Title>
            <Card className="query-card">
              {isTypingEffect ? (
                <ReactTypingEffect
                  text={[currentQuery.query]}
                  speed={50}
                  eraseDelay={1000000}
                  typingDelay={0}
                  className="typing-effect"
                  // onTypingEnd={() => setIsTypingEffect(false)}
                />
              ) : (
                <pre>{currentQuery.query}</pre>
              )}
            </Card>
            <div className="input-section">
              <Input.Search
                placeholder="输入您的需求,按回车键自动搜索相关文件..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onSearch={handleSearch}
                loading={isSearching}
                enterButton={
                  <Button type="primary" icon={<SearchOutlined />}>
                    搜索文件
                  </Button>
                }
              />
            </div>
          </div>
        );  
      case 1: // 展示相关文件
        return (
          <div className="animated-content search-animation">
            <Title level={4}>
              <Space>
                <SearchOutlined spin={isSearching} />
                收集的相关文件
              </Space>
            </Title>
            <div className="files-container">
              {currentQuery.urls?.map((url, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  className={`file-card file-card-${index}`}
                  style={{
                    animation: `slideIn 0.5s ease-in ${index * 0.2}s forwards`,
                    opacity: 0
                  }}
                >
                  <Space>
                    <FileOutlined className="file-icon" />
                    {url}
                  </Space>
                </Card>
              ))}
            </div>
          </div>
        );
      case 2: // 展示Diff
        return (
          <div className="animated-content">
            <Title level={4}>自动提交代码</Title>
            {currentFileChanges && currentFileChanges.length > 0 && (
              <div className="file-changes-list">
                {currentFileChanges.map((change, index) => (
                  <Tag 
                    key={index} 
                    color={change.change_type === 'added' ? 'green' : 'blue'}
                    style={{ marginBottom: '8px' }}
                  >
                    <Space>
                      {change.change_type === 'added' ? <span>+</span> : <span>M</span>}
                      <Text>{change.path}</Text>
                    </Space>
                  </Tag>
                ))}
              </div>
            )}
            {currentDiff && <SyntaxHighlighter
              language="diff"
              style={vscDarkPlus}
              className="diff-highlighter"
            >
              {currentDiff}
            </SyntaxHighlighter>}
          </div>
        );
      default:
        return null;
    }
  };
  };

  // 新增搜索处理函数  
  const handleSearch = async () => {
    if (!userInput.trim()) return;
    
    setIsSearching(true);
    setCurrentSubStep(1); // 切换到文件搜索步骤
    
    // 模拟搜索延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSearching(false);
    setCurrentSubStep(2); // 自动进入代码生成步骤
  };

  // 新增搜索处理函数  
  const handleSearch = async () => {
    if (!userInput.trim()) return;
    
    setIsSearching(true);
    setCurrentSubStep(1); // 切换到文件搜索步骤
    
    // 模拟搜索延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSearching(false);
    setCurrentSubStep(2); // 自动进入代码生成步骤
  };

  return (
    <div className="animated-workflow-view cosmic-theme">
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          onClick={handlePlayPause}
        >
          {isPlaying ? '暂停' : '播放'}
        </Button>
        <Button onClick={handleReset}>重置</Button>
        <Text>当前: {`${sortedQueries[currentStep]?.file_number}_chat_action.yml`}</Text>
      </Space>

      <Steps
        current={currentSubStep}
        items={[
          {
            title: '用户需求',
            icon: <MessageOutlined />,
          },
          {
            title: '收集的相关文件',
            icon: <FileOutlined />,
          },
          {
            title: '自动提交代码',
            icon: <CodeOutlined />,
          },
        ]}
      />

      <div className="content-container">
        {renderContent()}
      </div>

      <div className="progress-indicator">
        {sortedQueries.map((query, index) => (
          <Tag 
            key={query.file_number}
            color={currentStep === index ? 'blue' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setCurrentStep(index);
              setCurrentSubStep(0);
              setIsPlaying(true);
              setCurrentDiff('');
            }}
          >
            #{query.file_number}
          </Tag>
        ))}
      </div>
    </div>
  );
  );
};

export default AnimatedWorkflowView;