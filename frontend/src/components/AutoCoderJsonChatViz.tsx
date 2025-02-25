import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Card, Typography, message, Space, Avatar, Divider, Empty, Badge, Tag, Tabs, List, Menu } from 'antd';
import { UserOutlined, RobotOutlined, FolderOutlined, SendOutlined, CommentOutlined, HistoryOutlined, MessageOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

interface ChatMessage {
  role: string;
  content: string;
}

// Corrected interface to reflect conversation_history as an array of conversations
interface ChatHistory {
  ask_conversation: ChatMessage[];
  conversation_history: ChatMessage[][]; // Array of conversation arrays
  // Could be expanded with other conversation types later
}

const AutoCoderJsonChatViz: React.FC = () => {
  const [projectPath, setProjectPath] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('1');
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when chat history changes or tab changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, activeTab, selectedHistoryIndex]);

  const loadChatHistory = async () => {
    if (!projectPath) {
      message.error('请输入项目路径');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/auto-coder-chat/json-history?path=${encodeURIComponent(projectPath)}`);
      if (response.data.success) {
        // Ensure both conversation arrays exist
        const history = response.data.chatHistory;
        history.ask_conversation = history.ask_conversation || [];
        history.conversation_history = history.conversation_history || [];
        
        // Reset selected history index to 0
        setSelectedHistoryIndex(0);
        
        setChatHistory(history);
        message.success('加载成功');
      } else {
        message.error(response.data.message || '无法加载聊天历史');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // Generate a title for a conversation from its first user message
  const generateConversationTitle = (conversation: ChatMessage[]) => {
    if (!conversation || conversation.length === 0) {
      return "空对话";
    }
    
    // Find the first user message
    const firstUserMessage = conversation.find(msg => msg.role === 'user');
    if (!firstUserMessage) {
      return "无用户消息的对话";
    }
    
    // Get first 20 chars of the message
    let title = firstUserMessage.content.slice(0, 20);
    if (firstUserMessage.content.length > 20) {
      title += '...';
    }
    
    return title;
  };

  // Extract CodeBlock to a separate component
  const CodeBlock = ({ language, value }: { language: string, value: string }) => (
    <SyntaxHighlighter 
      language={language} 
      style={vscDarkPlus}
      customStyle={{
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '8px',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      {value}
    </SyntaxHighlighter>
  );

  // Function to render code blocks in markdown
  const renderContent = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <CodeBlock
                language={match[1]}
                value={String(children).replace(/\n$/, '')}
              />
            ) : (
              <code 
                className={className} 
                {...props}
                style={{
                  background: '#f0f0f0',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                {children}
              </code>
            );
          },
          p: ({ children }) => (
            <p style={{ 
              margin: '0 0 8px 0',
              lineHeight: '1.6'
            }}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul style={{ 
              paddingLeft: '20px',
              margin: '0 0 12px 0' 
            }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ 
              paddingLeft: '20px',
              margin: '0 0 12px 0' 
            }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ 
              margin: '4px 0'
            }}>
              {children}
            </li>
          ),
          h1: ({ children }) => (
            <h1 style={{ fontSize: '22px', margin: '16px 0 8px 0', fontWeight: '600' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: '18px', margin: '14px 0 8px 0', fontWeight: '600' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: '16px', margin: '12px 0 8px 0', fontWeight: '600' }}>{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  // Function to format message timestamp
  const formatTimestamp = (index: number, total: number) => {
    const date = new Date();
    // Simulate message times by subtracting minutes based on index
    date.setMinutes(date.getMinutes() - total + index);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Function to render conversation messages
  const renderConversation = (messages: ChatMessage[] | undefined) => {
    if (!messages || messages.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%' 
        }}>
          <Empty 
            description="无对话记录" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      );
    }

    return messages.map((message, index) => (
      <div 
        key={index} 
        className={`message-container ${message.role === 'user' ? 'user' : 'assistant'}`}
        style={{ 
          display: 'flex',
          marginBottom: '16px',
          flexDirection: message.role === 'user' ? 'row' : 'row-reverse',
          alignItems: 'flex-start',
        }}
      >
        <Avatar 
          icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />} 
          style={{ 
            backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
            margin: message.role === 'user' ? '0 12px 0 0' : '0 0 0 12px',
            flexShrink: 0,
          }}
          size={40}
        />
        
        <div style={{ maxWidth: '80%' }}>
          <div 
            className="message-bubble"
            style={{ 
              padding: '12px 16px',
              borderRadius: message.role === 'user' 
                ? '0 16px 16px 16px' 
                : '16px 0 16px 16px',
              backgroundColor: message.role === 'user' 
                ? '#e6f7ff' 
                : '#ffffff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              position: 'relative',
              fontSize: '15px',
            }}
          >
            {renderContent(message.content)}
          </div>
          
          <div 
            className="message-meta"
            style={{ 
              fontSize: '12px', 
              color: '#8c8c8c',
              marginTop: '4px',
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-start' : 'flex-end'
            }}
          >
            <Text type="secondary">
              {formatTimestamp(index, messages.length)}
            </Text>
          </div>
        </div>
      </div>
    ));
  };

  // Get the active conversation based on tab
  const getActiveConversation = () => {
    if (!chatHistory) return [];
    
    if (activeTab === '1') {
      return chatHistory.ask_conversation || [];
    } else {
      // For tab 2, get the selected conversation from history
      const historyConversations = chatHistory.conversation_history || [];
      return historyConversations[selectedHistoryIndex] || [];
    }
  };

  // Get message count for a specific conversation type
  const getMessageCount = (type: 'ask_conversation' | 'conversation_history') => {
    if (!chatHistory || !chatHistory[type]) return 0;
    
    if (type === 'ask_conversation') {
      return chatHistory.ask_conversation.length;
    } else {
      // For conversation_history, return number of conversations
      return chatHistory.conversation_history.length;
    }
  };

  // Get total number of messages in conversation_history
  const getTotalHistoryMessages = () => {
    if (!chatHistory || !chatHistory.conversation_history) return 0;
    
    return chatHistory.conversation_history.reduce((total, conversation) => {
      return total + conversation.length;
    }, 0);
  };

  // Render the content based on active tab
  const renderTabContent = () => {
    if (!chatHistory) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%' 
        }}>
          <Empty 
            description={loading ? '加载中...' : '请输入项目路径加载对话历史'} 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      );
    }

    if (activeTab === '1') {
      // Tab 1: Show latest conversation
      return (
        <div 
          ref={chatContainerRef}
          className="chat-messages" 
          style={{ 
            flex: 1, 
            padding: '20px', 
            overflowY: 'auto',
            background: 'linear-gradient(to bottom, #f4f7f9, #edf1f7)'
          }}
        >
          {renderConversation(chatHistory.ask_conversation)}
        </div>
      );
    } else {
      // Tab 2: Show history with sidebar
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          {/* Sidebar for conversation list */}
          <div 
            className="conversation-sidebar"
            style={{
              width: '240px',
              borderRight: '1px solid #e8e8e8',
              overflowY: 'auto',
              background: '#f9f9f9'
            }}
          >
            <List
              size="small"
              header={
                <div style={{ padding: '8px 16px', fontWeight: 'bold' }}>
                  历史会话列表 ({chatHistory.conversation_history.length})
                </div>
              }
              bordered={false}
              dataSource={chatHistory.conversation_history}
              renderItem={(conversation, index) => (
                <List.Item 
                  onClick={() => setSelectedHistoryIndex(index)}
                  style={{ 
                    cursor: 'pointer',
                    background: selectedHistoryIndex === index ? '#e6f7ff' : 'transparent',
                    borderLeft: selectedHistoryIndex === index ? '3px solid #1890ff' : '3px solid transparent',
                    padding: '12px 16px'
                  }}
                >
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <FileTextOutlined style={{ color: '#1890ff' }} />
                      <Text strong>{`对话 ${index + 1}`}</Text>
                      <Badge 
                        count={conversation.length} 
                        size="small" 
                        style={{ backgroundColor: '#52c41a' }}
                      />
                    </div>
                    <Text 
                      type="secondary" 
                      style={{ 
                        fontSize: '12px',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '200px'
                      }}
                    >
                      {generateConversationTitle(conversation)}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </div>
          
          {/* Conversation display area */}
          <div 
            ref={chatContainerRef}
            className="chat-messages" 
            style={{ 
              flex: 1, 
              padding: '20px', 
              overflowY: 'auto',
              background: 'linear-gradient(to bottom, #f4f7f9, #edf1f7)'
            }}
          >
            {renderConversation(chatHistory.conversation_history[selectedHistoryIndex])}
          </div>
        </div>
      );
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        style={{ 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 16px 0' }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>
              <FolderOutlined /> AutoCoder 对话历史
            </Title>
            {chatHistory && (
              <Space>
                <Tag color="blue" icon={<MessageOutlined />}>
                  最新对话: {getMessageCount('ask_conversation')} 条消息
                </Tag>
                <Tag color="green" icon={<HistoryOutlined />}>
                  历史对话: {getMessageCount('conversation_history')} 个会话 ({getTotalHistoryMessages()} 条消息)
                </Tag>
              </Space>
            )}
          </Space>
        </div>

        <div className="chat-app-container" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '75vh',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Header section with search */}
          <div className="chat-header" style={{ 
            padding: '16px', 
            borderBottom: '1px solid #e8e8e8',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Search
              placeholder="请输入auto-coder.chat项目路径"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onSearch={loadChatHistory}
              enterButton={
                <Button 
                  type="primary" 
                  loading={loading}
                  icon={<SendOutlined />}
                >
                  加载
                </Button>
              }
              style={{ width: '90%' }}
              size="large"
            />
            
            {chatHistory && (
              <Badge 
                count={activeTab === '1' 
                  ? getMessageCount('ask_conversation') 
                  : chatHistory.conversation_history[selectedHistoryIndex]?.length || 0} 
                style={{ backgroundColor: activeTab === '1' ? '#1890ff' : '#52c41a' }}
                title="当前对话数量"
              >
                {activeTab === '1' 
                  ? <MessageOutlined style={{ fontSize: '20px', marginLeft: '16px' }} /> 
                  : <HistoryOutlined style={{ fontSize: '20px', marginLeft: '16px' }} />
                }
              </Badge>
            )}
          </div>

          {/* Tabs for different conversation types */}
          <Tabs 
            activeKey={activeTab} 
            onChange={(key) => {
              setActiveTab(key);
              setSelectedHistoryIndex(0);
            }}
            type="card"
            style={{ 
              padding: '0 16px', 
              marginBottom: 0,
              backgroundColor: '#f0f2f5'
            }}
          >
            <TabPane 
              tab={
                <span>
                  <MessageOutlined /> 
                  最新对话
                  {chatHistory && getMessageCount('ask_conversation') > 0 && (
                    <Badge 
                      count={getMessageCount('ask_conversation')} 
                      style={{ 
                        backgroundColor: '#1890ff', 
                        marginLeft: '8px'
                      }} 
                    />
                  )}
                </span>
              } 
              key="1"
            />
            <TabPane 
              tab={
                <span>
                  <HistoryOutlined /> 
                  历史对话
                  {chatHistory && getMessageCount('conversation_history') > 0 && (
                    <Badge 
                      count={getMessageCount('conversation_history')} 
                      style={{ 
                        backgroundColor: '#52c41a', 
                        marginLeft: '8px'
                      }} 
                    />
                  )}
                </span>
              } 
              key="2"
            />
          </Tabs>

          {/* Content area (changes based on active tab) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderTabContent()}
          </div>

          {/* Status footer with more prominent message count */}
          <div className="chat-footer" style={{ 
            padding: '12px 16px', 
            borderTop: '1px solid #e8e8e8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa'
          }}>
            <Space align="center">
              {activeTab === '1' 
                ? <MessageOutlined style={{ color: '#1890ff' }} /> 
                : <HistoryOutlined style={{ color: '#52c41a' }} />
              }
              <Text strong style={{ 
                fontSize: '14px', 
                color: activeTab === '1' ? '#1890ff' : '#52c41a'
              }}>
                {activeTab === '1' 
                  ? `最新对话: ${getActiveConversation().length} 条消息` 
                  : `历史对话 ${selectedHistoryIndex + 1}/${getMessageCount('conversation_history')}: ${getActiveConversation().length} 条消息`
                }
              </Text>
            </Space>
            {projectPath && (
              <Text type="secondary" style={{ fontSize: '13px', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                项目: {projectPath}
              </Text>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AutoCoderJsonChatViz; 