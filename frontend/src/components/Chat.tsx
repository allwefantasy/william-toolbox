import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Typography, Select, Space } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';
import './Chat.css';

const { TextArea } = Input;
const { Option } = Select;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState([
    { title: 'Ray设置temp_dir', time: '10/21/2024, 4:12:50 PM', messages: 2 },
    { title: '新的聊天', time: '10/17/2024, 9:41:31 PM', messages: 4 },
    { title: '银行贷款健康', time: '10/9/2024, 8:11:39 PM', messages: 2 },
    { title: '银行健康', time: '10/17/2024, 11:34:38 AM', messages: 4 },
    { title: '阿里巴巴营收中位数', time: '10/5/2024, 10:13:36 AM', messages: 2 },
    { title: '公司营收比较', time: '10/5/2024, 9:55:37 AM', messages: 4 },
    { title: '公司营收比较', time: '10/5/2024, 9:31:47 AM', messages: 2 },
    { title: '阿里巴巴营收增长', time: '10/5/2024, 9:55:59 AM', messages: 6 },
    { title: '新的聊天', time: '9/30/2024, 9:14:56 PM', messages: 2 },
  ]);

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
}, [listType]);

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
      const newUserMessage = { role: 'user' as const, content: inputMessage };
      setMessages([...messages, newUserMessage]);
      setInputMessage('');

      try {
        const response = await axios.post(`/chat/conversations/${currentConversationId}/messages`, {
          message: newUserMessage,
          list_type: listType,
          selected_item: selectedItem
        });

        if (response.data && response.data.role === 'assistant') {
          setMessages(prevMessages => [...prevMessages, response.data]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        message.error('Failed to send message');
      }
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <Button 
          type="primary" 
          icon={<PlusCircleOutlined />} 
          style={{ marginBottom: 20, width: '100%' }}
          onClick={async () => {
            try {
              const response = await axios.post('/chat/conversations', { title: '新的聊天' });
              const newConversation = response.data;
              setConversations([newConversation, ...conversations]);
              setCurrentConversationId(newConversation.id);
              setMessages([]);
            } catch (error) {
              console.error('Error creating new conversation:', error);
              message.error('创建新对话失败');
            }
          }}
        >
          新的聊天
        </Button>
        {conversations.map((conv) => (
          <div 
            key={conv.id} 
            className="conversation-item"
            onClick={() => {
              setCurrentConversationId(conv.id);
              // 这里需要加载选中对话的消息
              // TODO: 实现加载选中对话消息的逻辑
            }}
          >
            <Typography.Text strong>{conv.title}</Typography.Text>
            <br />
            <Typography.Text type="secondary">{conv.messages.length}条对话</Typography.Text>
            <Typography.Text type="secondary" style={{ float: 'right' }}>{conv.updated_at}</Typography.Text>
          </div>
        ))}
      </div>
      <div className="chat-area">
        <List
          className="message-list"
          dataSource={messages}
          renderItem={(item: Message) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={item.role === 'user' ? <EditOutlined /> : <img src="/path/to/assistant-avatar.png" alt="Assistant" />} />}
                title={item.role === 'user' ? 'You' : 'Assistant'}
                description={item.content}
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
              <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage}>
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