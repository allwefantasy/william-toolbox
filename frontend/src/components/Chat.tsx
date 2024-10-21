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
        setItemList(response.data.filter((model: any) => model.status === 'running').map((model: any) => model.name));
      } else {
        response = await axios.get('/rags');
        setItemList(response.data.filter((rag: any) => rag.status === 'running').map((rag: any) => rag.name));
      }
    } catch (error) {
      console.error('Error fetching item list:', error);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      setMessages([...messages, { role: 'user', content: inputMessage }]);
      setInputMessage('');
      // TODO: Add logic to send message to backend and receive response
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <Button type="primary" icon={<PlusCircleOutlined />} style={{ marginBottom: 20, width: '100%' }}>
          新的聊天
        </Button>
        {conversations.map((conv, index) => (
          <div key={index} className="conversation-item">
            <Typography.Text strong>{conv.title}</Typography.Text>
            <br />
            <Typography.Text type="secondary">{conv.messages}条对话</Typography.Text>
            <Typography.Text type="secondary" style={{ float: 'right' }}>{conv.time}</Typography.Text>
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
          <Space style={{ width: '100%' }} align="start">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Select
                style={{ width: 120 }}
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
                style={{ width: 120 }}
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
              style={{ borderRadius: '8px', flexGrow: 1, minWidth: '300px' }}
            />
          </Space>
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