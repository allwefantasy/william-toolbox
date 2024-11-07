import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Typography, Select, Space, Dropdown, Menu, Modal, Spin, Tooltip, Card } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined, DeleteOutlined, LoadingOutlined, RobotOutlined, RedoOutlined, BulbOutlined } from '@ant-design/icons';
import { message as MessageBox } from 'antd';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";
import axios from 'axios';
import './Chat.css';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
}

// ... (保留其他 interface 定义)

const Chat: React.FC = () => {
  // ... (保留之前的 state 定义)
  
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [showingThoughts, setShowingThoughts] = useState<boolean>(false);

  // ... (保留之前的函数定义)

  // 修改处理消息流的部分
  const handleSendMessage = async () => {
    if (inputMessage.trim() && currentConversationId) {
      const canProceed = await checkOpenAIService();
      if (!canProceed) {
        return;
      }

      const newUserMessage: Message = {
        role: 'user',
        content: inputMessage,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36)
      };
      setMessages([...messages, newUserMessage]);
      setInputMessage('');
      setIsLoading(true);
      setThoughts([]); // 重置思考过程
      setShowingThoughts(false);

      // Start 120s countdown
      setCountdown(120);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      setCountdownInterval(interval);

      try {
        const streamResponse = await axios.post(`/chat/conversations/${currentConversationId}/messages/stream`, {
          conversation_id: currentConversationId,
          messages: [...messages, newUserMessage],
          list_type: listType,
          selected_item: selectedItem
        });

        if (streamResponse.data && streamResponse.data.request_id) {
          const requestId = streamResponse.data.request_id;
          let currentIndex = 0;
          let assistantMessage = '';
          let currentThoughts: string[] = [];

          const assistant_message_id = streamResponse.data.response_message_id;
          setResponseMessageId(assistant_message_id);
          const tempMessage = { id: assistant_message_id, role: 'assistant' as const, content: '', timestamp: new Date().toISOString() };
          setMessages(prevMessages => [...prevMessages, tempMessage]);

          while (true) {
            const eventsResponse = await axios.get(`/chat/conversations/events/${requestId}/${currentIndex}`);
            const events = eventsResponse.data.events;

            if (!events || events.length === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
              continue;
            }

            for (const event of events) {
              if (event.event === 'error') {
                if (countdownInterval) {
                  clearInterval(countdownInterval);
                  setCountdownInterval(null);
                }
                setCountdown(null);
                throw new Error(event.content);
              }

              if (event.event === 'thought') {
                // 收集思考过程
                currentThoughts.push(event.content);
                setThoughts(currentThoughts);
                setShowingThoughts(true);
              }

              if (event.event === 'chunk') {
                if (!assistantMessage) {
                  if (countdownInterval) {
                    clearInterval(countdownInterval);
                    setCountdownInterval(null);
                  }
                  setCountdown(null);
                }
                assistantMessage += event.content;
                setMessages(prevMessages =>
                  prevMessages.map(msg => {
                    if (msg.id === assistant_message_id) {
                      return { ...msg, content: assistantMessage };
                    }
                    return msg;
                  })
                );
                currentIndex = event.index + 1;
              }

              if (event.event === 'done') {
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        MessageBox.error('Failed to send message');
        setMessages(prevMessages => prevMessages.slice(0, -1));
      } finally {
        setIsLoading(false);
        if (countdownInterval) {
          clearInterval(countdownInterval);
          setCountdownInterval(null);
        }
        setCountdown(null);
      }
    }
  };

  const renderMessageContent = (item: Message) => {
    // 如果是助手的消息且有思考过程，显示思考过程卡片
    const showThoughtsForMessage = showingThoughts && item.id === response_message_id;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {showThoughtsForMessage && thoughts.length > 0 && (
          <Card
            size="small"
            title={
              <Space>
                <BulbOutlined style={{ color: '#faad14' }} />
                <Text strong>思考过程</Text>
              </Space>
            }
            className="thoughts-card"
            style={{
              marginBottom: '12px',
              background: '#fffbe6',
              border: '1px solid #ffe58f'
            }}
          >
            <List
              size="small"
              dataSource={thoughts}
              renderItem={(thought, index) => (
                <List.Item style={{ 
                  padding: '8px', 
                  borderBottom: index === thoughts.length - 1 ? 'none' : '1px solid #ffe58f'
                }}>
                  <Space align="start">
                    <Text type="warning">{index + 1}.</Text>
                    <Text>{thought}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}
        
        {isLoading && item.id === response_message_id && (
          <div>
            <Typography.Text>
              Assistant is typing...
            </Typography.Text>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
            {countdown !== null && (
              <Typography.Text style={{ marginLeft: 10 }}>
                思考中...{countdown}s
              </Typography.Text>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography.Text style={{ color: item.role === 'user' ? '#096dd9' : '#389e0d', flex: 1 }}>
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
              {item.content}
            </ReactMarkdown>
          </Typography.Text>
          {item.role === 'user' && (
            <Tooltip title="Regenerate response">
              <Button
                type="text"
                icon={<RedoOutlined />}
                onClick={() => handleRegenerateResponse(item)}
                style={{ marginLeft: '8px' }}
              />
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-container">
      {/* ... (保持之前的布局代码) */}
      <List
        className="message-list"
        dataSource={messages}
        renderItem={(item: Message) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar icon={item.role === 'user' ? <EditOutlined /> : <RobotOutlined />} />}
              title={
                <Typography.Text strong style={{ color: item.role === 'user' ? '#1890ff' : '#52c41a' }}>
                  {item.role === 'user' ? 'You' : 'Assistant'}
                </Typography.Text>
              }
              description={renderMessageContent(item)}
            />
          </List.Item>
        )}
      />
      {/* ... (保持之前的其他代码) */}
    </div>
  );
};

export default Chat;