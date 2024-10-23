import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Typography, Select, Space, Dropdown, Menu, Modal, Spin, Tooltip } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined, DeleteOutlined, LoadingOutlined, RobotOutlined, RedoOutlined } from '@ant-design/icons';
import axios from 'axios';
import './Chat.css';
import { message } from 'antd';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;  // Add this line
}

interface Conversation {
  id: string;
  title: string;
  time: string;
  messages: number;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  const [listType, setListType] = useState<'models' | 'rags'>('models');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [itemList, setItemList] = useState<string[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    fetchItemList();
    fetchConversations();
  }, []);

  useEffect(() => {
    fetchItemList();
  }, [listType]);

  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    }
  }, [currentConversationId]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/chat/conversations');
      setConversations(response.data);
      if (response.data.length > 0) {
        setCurrentConversationId(response.data[0].id);
        setCurrentConversationTitle(response.data[0].title);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      message.error('Failed to load conversations');
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await axios.get(`/chat/conversations/${conversationId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      message.error('Failed to load messages');
    }
  };

  const fetchItemList = async () => {
    try {
      let response;
      if (listType === 'models') {
        response = await axios.get('/models');
        const runningModels = response.data.filter((model: any) => model.status === 'running').map((model: any) => model.name);
        setItemList(runningModels);
        if (runningModels.length > 0 && !selectedItem) {
          setSelectedItem(runningModels[0]);
        }
      } else {
        response = await axios.get('/rags');
        const runningRags = response.data.filter((rag: any) => rag.status === 'running').map((rag: any) => rag.name);
        setItemList(runningRags);
        if (runningRags.length > 0 && !selectedItem) {
          setSelectedItem(runningRags[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching item list:', error);
    }
  };

  useEffect(() => {
    fetchItemList();
  }, []);

  const handleSendMessage = async () => {
    if (inputMessage.trim() && currentConversationId) {
      const newUserMessage: Message = {
        role: 'user',
        content: inputMessage,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substring(7)
      };
      setMessages([...messages, newUserMessage]);
      setInputMessage('');
      setIsLoading(true);

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
        // Call the stream endpoint  
        const streamResponse = await axios.post(`/chat/conversations/${currentConversationId}/messages/stream`, {
          conversation_id: currentConversationId,
          message: newUserMessage,
          list_type: listType,
          selected_item: selectedItem
        });

        if (streamResponse.data && streamResponse.data.request_id) {
          const requestId = streamResponse.data.request_id;
          let currentIndex = 0;
          let assistantMessage = '';

          // Add initial assistant message
          const tempMessage = { role: 'assistant' as const, content: '', timestamp: new Date().toISOString() };
          setMessages(prevMessages => [...prevMessages, tempMessage]);

          // Poll for events
          while (true) {
            const eventsResponse = await axios.get(`/chat/conversations/events/${requestId}/${currentIndex}`);
            const events = eventsResponse.data.events;

            if (!events || events.length === 0) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before next poll
              continue;
            }

            for (const event of events) {
              if (event.event === 'error') {
                // Clear countdown on error
                if (countdownInterval) {
                  clearInterval(countdownInterval);
                  setCountdownInterval(null);
                }
                setCountdown(null);
                throw new Error(event.content);
              }

              if (event.event === 'chunk') {
                // Clear countdown on first content
                if (!assistantMessage) {
                  if (countdownInterval) {
                    clearInterval(countdownInterval);
                    setCountdownInterval(null);
                  }
                  setCountdown(null);
                }
                assistantMessage += event.content;
            // Update the assistant message at the correct position
            setMessages(prevMessages =>
              prevMessages.map((msg, index) => {
                if (index === messageIndex + 1 && msg.role === 'assistant') {
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
        message.error('Failed to send message');
        // Remove the assistant message if there's an error
        setMessages(prevMessages => prevMessages.slice(0, -1));
      } finally {
        setIsLoading(false);
        // Clear countdown
        if (countdownInterval) {
          clearInterval(countdownInterval);
          setCountdownInterval(null);
        }
        setCountdown(null);
      }
    }
  };

  const handleTitleDoubleClick = (conv: Conversation) => {
    setEditingTitleId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  };

  const handleTitleUpdate = async (conv: Conversation) => {
    if (editingTitle.trim() === '') return;

    try {
      await axios.put(`/chat/conversations/${conv.id}`, { title: editingTitle });
      setConversations(conversations.map(c =>
        c.id === conv.id ? { ...c, title: editingTitle } : c
      ));
      if (currentConversationId === conv.id) {
        setCurrentConversationTitle(editingTitle);
      }
      setEditingTitleId(null);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      message.error('Failed to update conversation title');
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '你确定要删除这个会话吗？',
      onOk: async () => {
        try {
          await axios.delete(`/chat/conversations/${convId}`);
          setConversations(conversations.filter(c => c.id !== convId));
          if (currentConversationId === convId) {
            setCurrentConversationId(null);
            setCurrentConversationTitle('');
            setMessages([]);
          }
          message.success('会话已删除');
        } catch (error) {
          console.error('Error deleting conversation:', error);
          message.error('删除会话失败');
        }
      },
    });
  };

  const menu = (conv: Conversation) => (
    <Menu>
      <Menu.Item key="delete" onClick={() => handleDeleteConversation(conv.id)} icon={<DeleteOutlined />}>
        删除会话
      </Menu.Item>
    </Menu>
  );

  const CodeBlock = ({ language, value }: { language: string, value: string }) => (
    <SyntaxHighlighter language={language} style={coy}>
      {value}
    </SyntaxHighlighter>
  );

  return (
    <div className="chat-container">
      <div className="sidebar">
        <Button
          type="primary"
          icon={<PlusCircleOutlined />}
          style={{ marginBottom: 20, width: '100%' }}
          onClick={async () => {
            try {
              const response = await axios.post("/chat/conversations", {
                title: "新的聊天"
              });
              const newConversation: Conversation = {
                id: response.data.id,
                title: response.data.title,
                time: response.data.created_at,
                messages: response.data.messages.length
              };
              setConversations([newConversation, ...conversations]);
              setCurrentConversationId(newConversation.id);
              setCurrentConversationTitle(newConversation.title);
              setMessages(response.data.messages);
            } catch (error) {
              console.error('Error creating new conversation:', error);
              message.error('创建新对话失败');
            }
          }}
        >
          新的聊天
        </Button>
        {conversations.map((conv) => (
          <Dropdown overlay={menu(conv)} trigger={['contextMenu']} key={conv.id}>
            <div
              className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentConversationId(conv.id);
                setCurrentConversationTitle(conv.title);
              }}
              onDoubleClick={() => handleTitleDoubleClick(conv)}
            >
              {editingTitleId === conv.id ? (
                <Input
                  value={editingTitle}
                  onChange={handleTitleChange}
                  onPressEnter={() => handleTitleUpdate(conv)}
                  onBlur={() => handleTitleUpdate(conv)}
                  autoFocus
                />
              ) : (
                <>
                  <Typography.Text strong>{conv.title}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">{conv.messages}条对话</Typography.Text>
                  <Typography.Text type="secondary" style={{ float: 'right' }}>{conv.time}</Typography.Text>
                </>
              )}
            </div>
          </Dropdown>
        ))}
      </div>
      <div className="chat-area">
        <Title level={4} style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
          {currentConversationTitle || '选择或创建一个对话'}
        </Title>
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
                description={
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      {isLoading && messages.indexOf(item) === messages.length - 1 ? (
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
                      ) : (
                        <Typography.Text style={{ color: item.role === 'user' ? '#096dd9' : '#389e0d' }}>
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
                      )}
                    </div>
                    {item.role === 'user' && (
                      <Tooltip title="重新发送">
                        <Button
                          icon={<RedoOutlined />}
                          type="text"
                          onClick={async () => {
                            // 找到当前用户消息以及紧跟其后的系统回复
                            const currentIndex = messages.findIndex(msg => msg.id === item.id);
                            if (currentIndex === -1) return;

                            // 假设每个用户消息后面都跟着一个系统回复
                            // 找到当前消息及其后的系统回复
                            const previousMessages = [...messages];
                            const messageIndex = currentIndex;
                            let assistantIndex = -1;
                            // 我们需要找到紧接着这条消息的系统回复
                            if (messageIndex + 1 < previousMessages.length && 
                                previousMessages[messageIndex + 1].role === 'assistant') {
                                assistantIndex = messageIndex + 1;
                            }
                            
                            // 更新系统回复内容
                            if (assistantIndex !== -1) {
                                previousMessages[assistantIndex] = {
                                    ...previousMessages[assistantIndex],
                                    content: ''  // 清空内容以显示加载状态
                                };
                            } else {
                                // 如果找不到现有的系统回复，在用户消息后添加一个空的系统回复
                                previousMessages.splice(messageIndex + 1, 0, {
                                    role: 'assistant',
                                    content: '',
                                    timestamp: new Date().toISOString()
                                });
                                assistantIndex = messageIndex + 1;
                            }
                            setMessages(previousMessages);

                            // 重新发送请求获取回复
                            setIsLoading(true);
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
                                message: item,
                                list_type: listType,
                                selected_item: selectedItem
                              });

                              if (streamResponse.data && streamResponse.data.request_id) {
                                const requestId = streamResponse.data.request_id;
                                let currentIndex = 0;
                                let assistantMessage = '';

                                const tempMessage = { role: 'assistant' as const, content: '', timestamp: new Date().toISOString() };
                                setMessages(prev => [...prev, tempMessage]);

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
                                        prevMessages.map((msg, index) =>
                                          index === prevMessages.length - 1
                                            ? { ...msg, content: assistantMessage }
                                            : msg
                                        )
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
                              console.error('Error refreshing message:', error);
                              message.error('Failed to refresh message');
                              // 如果发生错误，恢复到原来的系统回复
                              setMessages(prevMessages => {
                                const updatedMessages = [...prevMessages];
                                const assistantIndex = updatedMessages.findIndex(
                                  (msg, idx) => idx > messageIndex && msg.role === 'assistant'
                                );
                                if (assistantIndex !== -1) {
                                  updatedMessages[assistantIndex] = {
                                    ...updatedMessages[assistantIndex],
                                    content: '发送失败，请重试'
                                  };
                                }
                                return updatedMessages;
                              });
                            } finally {
                              setIsLoading(false);
                              if (countdownInterval) {
                                clearInterval(countdownInterval);
                                setCountdownInterval(null);
                              }
                              setCountdown(null);
                            }
                          }}
                        />
                      </Tooltip>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
        <div className="input-area">
          <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Select
                style={{ width: 240 }}
                value={listType}
                onChange={(value: 'models' | 'rags') => {
                  setListType(value);
                  setSelectedItem('');
                }}
              >
                <Option value="models">模型列表</Option>
                <Option value="rags">RAG列表</Option>
              </Select>
              <Select
                style={{ width: 240 }}
                value={selectedItem}
                onChange={(value: string) => setSelectedItem(value)}
              >
                {itemList.map((item) => (
                  <Option key={item} value={item}>{item}</Option>
                ))}
              </Select>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} disabled={isLoading}>
                发送
              </Button>
            </div>
            <TextArea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="有什么可以帮你的吗"
              autoSize={{ minRows: 3, maxRows: 6 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ borderRadius: '8px', flex: 1 }}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="tool-bar">
          <div>
            <Button icon={<SettingOutlined />} type="text" />
            <Button icon={<GithubOutlined />} type="text" />
          </div>
          <div>
            <Button icon={<PictureOutlined />} type="text" />
            <Button icon={<FileOutlined />} type="text" />
            <Button icon={<DatabaseOutlined />} type="text" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
