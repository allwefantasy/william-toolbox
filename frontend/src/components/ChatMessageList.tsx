import React, { useState, useEffect, useRef } from 'react';
import { List, Avatar, Typography, Space, Spin, Timeline, Table } from 'antd';
import { EditOutlined, RobotOutlined, RedoOutlined, BulbOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";

const { Title } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
  thoughts?: string[];
}

const ChatMessageList: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [response_message_id, setResponseMessageId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // ... 保持原有逻辑

  return (
    <>
      <Title level={4} style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
        当前会话标题
      </Title>
      <List
        className="message-list"
        dataSource={messages}
        renderItem={(item: Message) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar icon={item.role === 'user' ? <EditOutlined /> : <RobotOutlined />} />}
              title={
                <Text strong style={{ color: item.role === 'user' ? '#1890ff' : '#52c41a' }}>
                  {item.role === 'user' ? 'You' : 'Assistant'}
                </Text>
              }
              description={
                // ... 保持原有消息内容渲染逻辑
              }
            />
          </List.Item>
        )}
      />
      <div ref={messagesEndRef} />
    </>
  );
};

export default ChatMessageList;