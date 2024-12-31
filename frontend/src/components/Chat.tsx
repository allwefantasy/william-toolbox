import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { Input, Button, List, Avatar, Typography, Select, Space, Dropdown, Menu, Modal, Spin, Tooltip, Timeline, Table } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined, DeleteOutlined, LoadingOutlined, RobotOutlined, RedoOutlined, BulbOutlined } from '@ant-design/icons';
import axios from 'axios';
import './Chat.css';
import { message as MessageBox } from 'antd';
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
  id?: string;
  thoughts?: string[]; // Add thoughts array for AI thinking process
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

  const [listType, setListType] = useState<'models' | 'rags' | 'super-analysis'>('models');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [itemList, setItemList] = useState<string[]>([]);

  const [response_message_id, setResponseMessageId] = useState<string>('');

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const [csvPreviewVisible, setCsvPreviewVisible] = useState(false);
  interface CSVRow {
    [key: string]: string | number | boolean | null;
  }

  interface CSVMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  }

  interface CSVColumn {
    key: string;
    title: string;
    dataIndex: string;
  }

  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvMeta, setCsvMeta] = useState<CSVMeta | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columns, setColumns] = useState<CSVColumn[]>([]);
  const [pendingMessage, setPendingMessage] = useState('');

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

  const handleRegenerateResponse = async (message: Message) => {

    const canProceed = await checkOpenAIService();
    if (!canProceed) {
      return;
    }

    const messageIndex = messages.findIndex(msg => msg.id === message.id);
    if (messageIndex === -1) return;

    const messagesToSend = messages.slice(0, messageIndex + 1);
    setIsLoading(true);

    try {
      const username = sessionStorage.getItem('username') || '';
      const streamResponse = await axios.post(`/chat/conversations/${currentConversationId}/messages/stream?username=${encodeURIComponent(username)}`, {
        conversation_id: currentConversationId,
        messages: messagesToSend,
        list_type: listType,
        selected_item: selectedItem
      });

      if (streamResponse.data && streamResponse.data.request_id) {
        const requestId = streamResponse.data.request_id;
        let currentIndex = 0;
        let assistantMessage = '';

        const assistant_message_id = streamResponse.data.response_message_id;
        setResponseMessageId(assistant_message_id);

        const nextMessage = messages[messageIndex + 1];

        let newMessages;
        if (nextMessage && nextMessage.role === 'assistant') {
          newMessages = [
            ...messages.slice(0, messageIndex + 1),
            { id: assistant_message_id, role: 'assistant', content: '', timestamp: new Date().toISOString() },
            ...messages.slice(messageIndex + 2)
          ];
        } else {
          newMessages = [
            ...messages.slice(0, messageIndex + 1),
            { id: assistant_message_id, role: 'assistant', content: '', timestamp: new Date().toISOString() },
            ...messages.slice(messageIndex + 1)
          ];
        }
        setMessages(newMessages as Message[]);

        while (true) {
          const eventsResponse = await axios.get(`/chat/conversations/events/${requestId}/${currentIndex}`);
          const events = eventsResponse.data.events;

          if (!events || events.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          for (const event of events) {
            if (event.event === 'error') {
              throw new Error(event.content);
            }

            if (event.event === "chunk") {
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
            } else if (event.event === "thought") {
              setMessages(prevMessages =>
                prevMessages.map(msg => {
                  if (msg.id === assistant_message_id) {
                    const currentThoughts = msg.thoughts || [];
                    return {
                      ...msg,
                      thoughts: [...currentThoughts, event.content]
                    };
                  }
                  return msg;
                })
              );
              currentIndex = event.index + 1;
            }

            if (event.event === 'done') {
              // Update conversation after regeneration is complete
              try {
                setMessages(prevMessages => {
                  const updatedMessages = prevMessages.map(msg => {
                    if (msg.id === assistant_message_id) {
                      return { ...msg, content: assistantMessage, thoughts: msg.thoughts || [] };
                    }
                    return msg;
                  }, {
                    params: {
                      username: username
                    }
                  });

                  // Update conversation in server
                  (async () => {
                    try {
                      const username = sessionStorage.getItem('username') || '';
                      await axios.put(`/chat/conversations/${currentConversationId}?username=${encodeURIComponent(username)}`, {
                        id: currentConversationId,
                        title: currentConversationTitle,
                        messages: updatedMessages,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      });
                    } catch (error) {
                      console.error('Error updating conversation:', error);
                      MessageBox.error('Failed to update conversation');
                    }
                  })();

                  return updatedMessages;
                });
              } catch (error) {
                console.error('Error updating conversation:', error);
                MessageBox.error('Failed to update conversation');
              }
              return;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error regenerating response:', error);
      Modal.error({
        title: 'Error regenerating response',
        content: (
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {error.response?.data?.detail || error.message || 'Failed to regenerate response'}
          </div>
        ),
        width: 600
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const username = sessionStorage.getItem('username') || '';
      const response = await axios.get(`/chat/conversations?username=${encodeURIComponent(username)}`);
      setConversations(response.data);
      if (response.data.length > 0) {
        setCurrentConversationId(response.data[0].id);
        setCurrentConversationTitle(response.data[0].title);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      MessageBox.error('Failed to load conversations');
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const username = sessionStorage.getItem('username') || '';
      const response = await axios.get(`/chat/conversations/${conversationId}?username=${encodeURIComponent(username)}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      MessageBox.error('Failed to load messages');
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
      } else if (listType === 'rags') {
        response = await axios.get('/rags');
        const runningRags = response.data.filter((rag: any) => rag.status === 'running').map((rag: any) => rag.name);
        setItemList(runningRags);
        if (runningRags.length > 0 && !selectedItem) {
          setSelectedItem(runningRags[0]);
        }
      } else {
        response = await axios.get('/super-analysis');
        const runningSuperAnalyses = response.data.filter((analysis: any) => analysis.status === 'running').map((analysis: any) => analysis.name);
        setItemList(runningSuperAnalyses);
        if (runningSuperAnalyses.length > 0 && !selectedItem) {
          setSelectedItem(runningSuperAnalyses[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching item list:', error);
    }
  };

  useEffect(() => {
    fetchItemList();
  }, []);

  const checkOpenAIService = async () => {
    if (listType === 'models') {
      // 检查 OpenAI 兼容服务状态
      try {
        const response = await axios.get('/openai-compatible-service/status');
        if (!response.data.isRunning) {
          MessageBox.error('OpenAI 兼容服务未启动，点击菜单， 模型列表/OpenAI 兼容服务 启动对应的服务');
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error checking OpenAI service status:', error);
        MessageBox.error('检查 OpenAI 兼容服务状态失败');
        return false;
      }
    }
    return true;
  };



  const handleCsvPreviewOk = async () => {
    if (selectedColumns.length === 0) {
      MessageBox.error('请至少选择一列');
      return;
    }

    // 获取选中的列头
    const selectedHeaders = selectedColumns.join(',');

    // 使用选中的列提取数据，并保留原始header
    const filteredData = csvData.map(row =>
      selectedColumns.map(field => row[field]).join(',')
    ).join('\n');

    // 构建完整的CSV内容
    const fullCsvContent = `${selectedHeaders}\n${filteredData}`;

    // 提取原始CSV代码块
    const csvResponse = await axios.post('/chat/extract_csv', {
      content: pendingMessage
    });
    const csvContent = csvResponse.data.csv_content;

    // 使用原始CSV代码块进行替换
    const newMessage = pendingMessage.replace(csvContent, fullCsvContent);
    setInputMessage(newMessage);
    setCsvPreviewVisible(false);
    setPendingMessage('');
    setSelectedColumns([]);
    setCsvData([]);
    setCsvMeta(null);

    // 继续发送消息
    handleSendMessageInternal(newMessage);
  };

  const handleCsvPreviewCancel = () => {
    setCsvPreviewVisible(false);
    setPendingMessage('');
    setSelectedColumns([]);
    setCsvData([]);
    setCsvMeta(null);
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    await handleSendMessageInternal(inputMessage);
  };

  const ask = async (message: string) => {
    try {
      const response = await axios.post('/chat/ask', {
        message: message
      });
      return response.data.response;
    } catch (error) {
      console.error('Error in ask:', error);
      throw error;
    }
  };

  const handleSendMessageInternal = async (message: string) => {
    if (message.trim() && currentConversationId) {
      setIsLoading(true);
      // 检查 OpenAI 兼容服务状态
      const canProceed = await checkOpenAIService();
      if (!canProceed) {
        return;
      }

      // 检查是否包含 CSV 内容
      try {
        const response = await axios.post('/chat/extract_csv', {
          content: message
        });
        const csvContent = response.data.csv_content;
        if (!csvContent) {
          // 如果没有直接提取到 CSV，使用 ask 方法检测是否包含 CSV 数据                             │
          const askResponse = await axios.post('/chat/ask', {
            message: `下面是用户提供的信息：\n${message} \n\n请判断以下内容是否包含 CSV 表格数据，只需回答是或否`
          });
          if (askResponse.data.response !== "否") {
            Modal.confirm({
            title: 'CSV 数据检测',
            content: '检测到可能包含 CSV 数据，请使用 ```csv ``` 代码块包裹 CSV 内容',
            okText: '确认',
            cancelText: '取消',
            onOk: () => {
              // 用户确认后的操作
            },
          });
            setIsLoading(false);
            return;
          }
        }
        if (csvContent) {
          // 使用 PapaParse 解析 CSV 数据
          const parsedData: { data: CSVRow[]; meta: CSVMeta } = Papa.parse(csvContent, {
            delimiter: ',',
            newline: '\n',
            skipEmptyLines: true,
            dynamicTyping: true,
            header: true,
            preview: 10
          });


          const totalCells = parsedData.data.length * Object.keys(parsedData.data[0] || {}).length;
          console.log(totalCells);
          if (totalCells > 500) {
            setCsvData(parsedData.data);
            setCsvMeta(parsedData.meta);
            setPendingMessage(message);
            setCsvPreviewVisible(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error extracting CSV:', error);
        // 如果没有直接提取到 CSV，使用 ask 方法检测是否包含 CSV 数据                             │
        const askResponse = await axios.post('/chat/ask', {
          message: `下面是用户提供的信息：\n${message} \n\n请判断以下内容是否包含 CSV 表格数据，只需回答是或否`
        });
        if (askResponse.data.response !== "否") {
          Modal.confirm({
            title: 'CSV 数据检测',
            content: '检测到可能包含 CSV 数据，请使用 ```csv ``` 代码块包裹 CSV 内容',
            okText: '确认',
            cancelText: '取消',
            onOk: () => {
              // 用户确认后的操作
            },
          });
          setIsLoading(false);
          return;
        }
      }



      const newUserMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36)
      };
      setMessages([...messages, newUserMessage]);
      setInputMessage('');

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
        const username = sessionStorage.getItem('username') || '';
        const streamResponse = await axios.post(`/chat/conversations/${currentConversationId}/messages/stream?username=${encodeURIComponent(username)}`, {
          conversation_id: currentConversationId,
          messages: [...messages, newUserMessage],
          list_type: listType,
          selected_item: selectedItem
        });

        if (streamResponse.data && streamResponse.data.request_id) {
          const requestId = streamResponse.data.request_id;
          let currentIndex = 0;
          let assistantMessage = '';

          const assistant_message_id = streamResponse.data.response_message_id;
          setResponseMessageId(assistant_message_id);
          // Add initial assistant message
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

              if (event.event === "chunk") {
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
              } else if (event.event === "thought") {
                setMessages(prevMessages =>
                  prevMessages.map(msg => {
                    if (msg.id === assistant_message_id) {
                      const currentThoughts = msg.thoughts || [];
                      return {
                        ...msg,
                        thoughts: [...currentThoughts, event.content]
                      };
                    }
                    return msg;
                  })
                );
                currentIndex = event.index + 1;
              }

              if (event.event === 'done') {
                // Update conversation after receiving assistant's response
                try {
                  setMessages(prevMessages => {
                    const updatedMessages = prevMessages.map(msg => {
                      if (msg.id === assistant_message_id) {
                        return { ...msg, content: assistantMessage, thoughts: msg.thoughts || [] };
                      }
                      return msg;
                    });

                    // Update conversation in server
                    (async () => {
                      try {
                        await axios.put(`/chat/conversations/${currentConversationId}?username=${encodeURIComponent(username)}`, {
                          id: currentConversationId,
                          title: currentConversationTitle,
                          messages: updatedMessages,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        });
                      } catch (error) {
                        console.error('Error updating conversation:', error);
                        MessageBox.error('Failed to update conversation');
                      }
                    })();

                    return updatedMessages;
                  });
                } catch (error) {
                  console.error('Error updating conversation:', error);
                  MessageBox.error('Failed to update conversation');
                } finally {
                  setIsLoading(false);
                  if (countdownInterval) {
                    clearInterval(countdownInterval);
                    setCountdownInterval(null);
                  }
                  setCountdown(null);
                }
                return;
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error sending message:', error);
        Modal.error({
          title: 'Error sending message',
          content: (
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {error.response?.data?.detail || error.message || 'Failed to send message'}
            </div>
          ),
          width: 600
        });
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
      // 使用 /chat/conversations/{conversation_id}/title 接口
      const username = sessionStorage.getItem('username') || '';
      await axios.put(`/chat/conversations/${conv.id}/title?username=${encodeURIComponent(username)}`, { title: editingTitle });
      setConversations(conversations.map(c =>
        c.id === conv.id ? { ...c, title: editingTitle } : c
      ));
      if (currentConversationId === conv.id) {
        setCurrentConversationTitle(editingTitle);
      }
      setEditingTitleId(null);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      MessageBox.error('Failed to update conversation title');
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '你确定要删除这个会话吗？',
      onOk: async () => {
        try {
          const username = sessionStorage.getItem('username') || '';
          await axios.delete(`/chat/conversations/${convId}?username=${encodeURIComponent(username)}`);
          setConversations(conversations.filter(c => c.id !== convId));
          if (currentConversationId === convId) {
            setCurrentConversationId(null);
            setCurrentConversationTitle('');
            setMessages([]);
          }
          MessageBox.success('会话已删除');
        } catch (error) {
          console.error('Error deleting conversation:', error);
          MessageBox.error('删除会话失败');
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

  useEffect(() => {
    if (csvMeta?.fields) {
      const newColumns: CSVColumn[] = csvMeta.fields.map((field) => ({
        title: field,
        dataIndex: field,
        key: field,
      }));
      setColumns(newColumns);
    }
  }, [csvMeta]);

  return (
    <div className="chat-container">
      <Modal
        title="请筛选列以减少数据量（500个cell以内）"
        open={csvPreviewVisible}
        onOk={handleCsvPreviewOk}
        onCancel={handleCsvPreviewCancel}
        width={1200}
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text>请选择要包含的列：</Typography.Text>
          </div>
          <Table
            dataSource={csvData.map((row, index) => ({
              ...row,
              key: index,
            }))}
            columns={columns.map(col => ({
              ...col,
              render: (text: string) => (
                <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {text}
                </div>
              )
            }))}
            pagination={false}
            scroll={{ x: true, y: 500 }}
            rowSelection={undefined}
          />
          <div style={{ marginTop: 16 }}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="请选择要包含的列"
              value={selectedColumns}
              onChange={(values: string[]) => setSelectedColumns(values)}
              options={columns.map(col => ({
                label: col.title,
                value: col.key,
              }))}
            />
          </div>
        </div>
      </Modal>
      <div className="sidebar">
        <Button
          type="primary"
          icon={<PlusCircleOutlined />}
          style={{ marginBottom: 20, width: '100%' }}
          onClick={async () => {
            try {
              const username = sessionStorage.getItem('username') || '';
              const response = await axios.post(`/chat/conversations?username=${encodeURIComponent(username)}`, {
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
              MessageBox.error('创建新对话失败');
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
                      {isLoading && item.id === response_message_id && (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            <Typography.Text>
                              Assistant is typing...
                            </Typography.Text>
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                            {countdown !== null && (
                              <Typography.Text style={{ marginLeft: 10 }}>
                                思考中...{countdown}s
                              </Typography.Text>
                            )}
                          </Space>
                        </Space>
                      )}
                      {item.thoughts && item.thoughts.length > 0 && (
                        <div style={{
                          marginBottom: 24,
                          padding: '16px',
                          backgroundColor: '#f7f7f7',
                          borderRadius: '8px',
                          border: '1px solid #e8e8e8'
                        }}>
                          <div style={{ marginBottom: '12px' }}>
                            <Typography.Text type="secondary">思考过程:</Typography.Text>
                          </div>
                          <Timeline>
                            {item.thoughts.map((thought: string, index: number) => (
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
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '16px',
                        backgroundColor: item.role === 'assistant' ? '#fff' : 'transparent',
                        borderRadius: '8px',
                        marginTop: item.thoughts && item.thoughts.length > 0 ? '16px' : '0'
                      }}>
                        {listType === 'super-analysis' && item.role === 'assistant' ? (
                          <div style={{ flex: 1 }}>
                            {(() => {
                              try {
                                const result = JSON.parse(item.content);
                                if (result.schema && result.data) {
                                  const columns = result.schema.fields.map((field: any) => ({
                                    title: field.name,
                                    dataIndex: field.name,
                                    key: field.name,
                                  }));

                                  return (
                                    <Table
                                      dataSource={result.data}
                                      columns={columns}
                                      pagination={false}
                                      bordered
                                      size="small"
                                    />
                                  );
                                }
                                // 如果不是预期的格式，回退到普通文本显示
                                return (
                                  <Typography.Text style={{ color: '#389e0d' }}>
                                    {item.content}
                                  </Typography.Text>
                                );
                              } catch (e) {
                                // 如果解析JSON失败，回退到普通文本显示
                                return (
                                  <Typography.Text style={{ color: '#389e0d' }}>
                                    {item.content}
                                  </Typography.Text>
                                );
                              }
                            })()}
                          </div>
                        ) : (
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
                        )}
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
                onChange={(value: 'models' | 'rags' | 'super-analysis') => {
                  setListType(value);
                  setSelectedItem('');
                }}
              >
                <Option value="models">模型列表</Option>
                <Option value="rags">RAG列表</Option>
                <Option value="super-analysis">Super Analysis列表</Option>
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
