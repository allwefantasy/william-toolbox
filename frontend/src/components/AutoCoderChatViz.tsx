import React, { useState } from 'react';
import { Input, Button, List, Card, Typography, message } from 'antd';
import { FolderOutlined, MessageOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Query {
  query: string;
  timestamp?: string;
}

const AutoCoderChatViz: React.FC = () => {
  const [projectPath, setProjectPath] = useState<string>('');
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>
          <FolderOutlined /> Auto-Coder Chat 可视化
        </Title>
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

        <List
          dataSource={queries}
          renderItem={(item, index) => (
            <List.Item>
              <Card 
                style={{ width: '100%' }}
                title={
                  <div>
                    <MessageOutlined style={{ marginRight: '8px' }} />
                    Query #{index + 1}
                    {item.timestamp && (
                      <Text type="secondary" style={{ marginLeft: '10px', fontSize: '12px' }}>
                        {item.timestamp}
                      </Text>
                    )}
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
      </Card>
    </div>
  );
};

export default AutoCoderChatViz;