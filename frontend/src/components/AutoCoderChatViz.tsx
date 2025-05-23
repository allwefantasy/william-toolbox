import React, { useState } from 'react';
import { Input, Button, List, Card, Typography, message, Modal, Space, Radio, Tag } from 'antd';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"; 
import { FolderOutlined, MessageOutlined, CodeOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import axios from 'axios';
import WorkflowView from './WorkflowView';
import AnimatedWorkflowView from './AnimatedWorkflowView';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Query {
  query: string;
  timestamp?: string;
  response?: string;
  urls?: string[];
  file_number: number;
}

const AutoCoderChatViz: React.FC = () => {
  const [projectPath, setProjectPath] = useState<string>('');
  const [queries, setQueries] = useState<Query[]>([]);
  const [isAscending, setIsAscending] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [diffModalVisible, setDiffModalVisible] = useState<boolean>(false);
  const [currentDiff, setCurrentDiff] = useState<{diff: string, file_changes?: Array<{path: string, change_type: string}>}>({diff: ''});
  const [contextModalVisible, setContextModalVisible] = useState<boolean>(false);
  const [currentUrls, setCurrentUrls] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'workflow' | 'animated'>('list');

  const showDiff = async (response: string | undefined) => {    
    if (!projectPath || !response) return;

    try {
      const encodedPath = encodeURIComponent(projectPath);
      const encodedResponseId = encodeURIComponent(response);
      const diffResponse = await axios.get(`/auto-coder-chat/commit-diff/${encodedResponseId}?path=${encodedPath}`);
      
        if (diffResponse.data.success) {
          setCurrentDiff({
            diff: diffResponse.data.diff,
            file_changes: diffResponse.data.file_changes
          });
          if(diffResponse.data.file_changes) {
            // 更新当前查询的file_changes
            setQueries(prevQueries => prevQueries.map(q => {
              if(q.response === response) {
                return {...q, file_changes: diffResponse.data.file_changes};
              }
              return q;
            }));
          }
        setDiffModalVisible(true);
      } else {
        message.error(diffResponse.data.message || '获取diff失败');
      }
    } catch (error) {
      console.error('Error fetching diff:', error);
      message.error('获取diff失败');
    }
  };

  const validateAndLoadQueries = async () => {
    if (!projectPath) {
      message.error('请输入项目路径');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/auto-coder-chat/validate-and-load?path=${encodeURIComponent(projectPath)}`);
      if (response.data.success) {
        setQueries(response.data.queries);
        message.success('加载成功');
      } else {
        message.error(response.data.message || '无效的 auto-coder.chat 项目');
      }
    } catch (error) {
      console.error('Error loading queries:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (viewMode === 'workflow') {
      return <WorkflowView queries={queries} onShowDiff={showDiff} />;
    } else if (viewMode === 'animated') {
      return <AnimatedWorkflowView queries={queries} onShowDiff={async (response) => {
        if (!projectPath || !response) return '';
        try {
          const encodedPath = encodeURIComponent(projectPath);
          const encodedResponse = encodeURIComponent(response);
          const resp = await axios.get(`/auto-coder-chat/commit-diff/${encodedResponse}?path=${encodedPath}`);
          if (resp.data.success) {
            return resp.data
          }
          return '';
        } catch (error) {
          console.error('Error fetching diff:', error);
          return '';
        }
      }} />;
    }

    return (
      <List
        dataSource={queries}
        renderItem={(item, index) => (
          <List.Item>
            <Card 
              style={{ width: '100%' }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <MessageOutlined style={{ marginRight: '8px' }} />
                  {`${item.file_number}_chat_action.yml`}
                  {item.timestamp && (
                    <Text type="secondary" style={{ marginLeft: '10px', fontSize: '12px' }}>
                      {item.timestamp}
                    </Text>
                  )}
                </div>
                  <Space>
                    {item.urls && item.urls.length > 0 && (
                      <Button
                        icon={<FolderOutlined />}
                        type="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentUrls(item.urls || []);
                          setContextModalVisible(true);
                        }}
                      >
                        查看上下文
                      </Button>
                    )}
                    {item.response && (
                      <Button 
                        icon={<CodeOutlined />} 
                        type="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.response) {
                            showDiff(item.response);
                          }
                        }}
                      >
                        查看变更
                      </Button>
                    )}
                  </Space>
                </div>
              }
            >
              <pre style={{ 
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                backgroundColor: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px'
              }}>
                {item.query}
              </pre>
            </Card>
          </List.Item>
        )}
      />
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Modal
        title="文件上下文"
        visible={contextModalVisible}
        onCancel={() => setContextModalVisible(false)}
        width={600}
        footer={null}
      >
        <List
          dataSource={currentUrls || []}
          renderItem={(url) => (
            <List.Item>
              <Text copyable>{url}</Text>
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="Commit Diff"
        visible={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        width={800}
        footer={null}
      >
        <div>
          {currentDiff.file_changes && currentDiff.file_changes.length > 0 && (
            <div style={{ 
              marginBottom: '16px',
              padding: '8px',
              background: '#f5f5f5',
              borderRadius: '4px'
            }}>
              {currentDiff.file_changes.map((change, index) => (
                <Tag 
                  key={index} 
                  color={change.change_type === 'added' ? 'green' : 'blue'}
                  style={{ marginBottom: '8px', marginRight: '8px' }}
                >
                  <Space>
                    {change.change_type === 'added' ? <span>+</span> : <span>M</span>}
                    <Text>{change.path}</Text>
                  </Space>
                </Tag>
              ))}
            </div>
          )}
          <SyntaxHighlighter
            language="diff"
            style={vscDarkPlus}
            customStyle={{
              padding: '12px',
              borderRadius: '4px', 
              overflow: 'auto',
              maxHeight: '500px'
            }}
          >
            {currentDiff.diff}
          </SyntaxHighlighter>
        </div>
      </Modal>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <FolderOutlined /> Auto-Coder Chat 可视化
          </Title>
          <Space>
            <Radio.Group 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="animated">动画视图</Radio.Button>
              <Radio.Button value="list">列表视图</Radio.Button>
              <Radio.Button value="workflow">工作流视图</Radio.Button>              
            </Radio.Group>
            {viewMode === 'list' && (
              <Button 
                icon={isAscending ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={() => {
                  setIsAscending(!isAscending);
                  setQueries([...queries].reverse());
                }}
              >
                {isAscending ? '升序' : '降序'}
              </Button>
            )}
          </Space>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <Input.Search
            placeholder="请输入项目路径"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            onSearch={validateAndLoadQueries}
            enterButton="加载"
            loading={loading}
            style={{ width: '100%', maxWidth: '600px' }}
          />
        </div>

        {renderContent()}
      </Card>
    </div>
  );
};

export default AutoCoderChatViz;