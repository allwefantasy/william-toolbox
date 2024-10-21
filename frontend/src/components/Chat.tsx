import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Typography, Select, Space, Dropdown, Menu, Modal, Spin } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';
import './Chat.css';
import { message } from 'antd';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/chat/conversations');
      setConversations(response.data);
      if (response.data.length > 0) {
        setCurrentConversationId(response.data[0].id);
        setCurrentConversationTitle(response.data[0].title);
        fetchMessages(response.data[0].id);
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
      const newUserMessage = { role: 'user' as const, content: inputMessage, timestamp: new Date().toISOString() };
      setMessages([...messages, newUserMessage]);
      setInputMessage('');
      setIsLoading(true);

      // Add a temporary "Assistant is typing..." message
      const tempMessage = { role: 'assistant' as const, content: 'Assistant is typing...', timestamp: new Date().toISOString() };
      setMessages(prevMessages => [...prevMessages, tempMessage]);

      try {
        const response = await axios.post(`/chat/conversations/${currentConversationId}/messages`, {
          conversation_id: currentConversationId,
          message: newUserMessage,
          list_type: listType,
          selected_item: selectedItem
        });

        if (response.data && response.data.role === 'assistant') {
          // Remove the temporary message and add the real response
          setMessages(prevMessages => prevMessages.filter(msg => msg !== tempMessage).concat(response.data));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        message.error('Failed to send message');
        // Remove the temporary message if there's an error
        setMessages(prevMessages => prevMessages.filter(msg => msg !== tempMessage));
      } finally {
        setIsLoading(false);
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
                fetchMessages(conv.id);
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
                avatar={<Avatar icon={item.role === 'user' ? <EditOutlined /> : <img src="/path/to/assistant-avatar.png" alt="Assistant" />} />}
                title={item.role === 'user' ? 'You' : 'Assistant'}
                description={item.content === 'Assistant is typing...' ? <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} /> : item.content}
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