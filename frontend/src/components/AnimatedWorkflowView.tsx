import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Tag, Steps } from 'antd';
import { FileOutlined, MessageOutlined, CodeOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
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
      case 0: // 展示相关文件
        return (
          <div className="animated-content">
            <Title level={4}>相关文件</Title>
            {currentQuery.urls?.map((url, index) => (
              <Card key={index} size="small" className="file-card">
                <FileOutlined /> {url}
              </Card>
            ))}
          </div>
        );
      case 1: // 展示查询内容
        return (
          <div className="animated-content">
            <Title level={4}>查询内容</Title>
            <Card className="query-card">
              <pre>{currentQuery.query}</pre>
            </Card>
          </div>
        );
      case 2: // 展示Diff
        return (
          <div className="animated-content">
            <Title level={4}>代码变更</Title>
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

  return (
    <div className="animated-workflow-view">
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
            title: '相关文件',
            icon: <FileOutlined />,
          },
          {
            title: '需求',
            icon: <MessageOutlined />,
          },
          {
            title: '代码变更',
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
};

export default AnimatedWorkflowView;