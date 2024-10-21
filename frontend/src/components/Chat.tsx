import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Typography } from 'antd';
import { SendOutlined, PlusCircleOutlined, GithubOutlined, SettingOutlined, EditOutlined, PictureOutlined, FileOutlined, DatabaseOutlined } from '@ant-design/icons';
import './Chat.css';

const { TextArea } = Input;

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

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

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
          <TextArea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="有什么可以帮你的吗"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{ borderRadius: '8px' }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} style={{ marginLeft: '10px' }}>
            发送
          </Button>
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