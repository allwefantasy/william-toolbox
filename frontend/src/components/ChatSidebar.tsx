import React, { useState } from 'react';
import { Button, Typography, Dropdown, Menu, Modal } from 'antd';
import { PlusCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { message as MessageBox } from 'antd';

const { Text } = Typography;

interface Conversation {
  id: string;
  title: string;
  time: string;
  messages: number;
}

const ChatSidebar: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // ... 保持原有逻辑

  return (
    <div className="sidebar">
      <Button
        type="primary"
        icon={<PlusCircleOutlined />}
        style={{ marginBottom: 20, width: '100%' }}
        onClick={handleNewConversation}
      >
        新的聊天
      </Button>
      {conversations.map((conv) => (
        <Dropdown overlay={menu(conv)} trigger={['contextMenu']} key={conv.id}>
          <div
            className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
            onClick={() => setCurrentConversationId(conv.id)}
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
                <Text strong>{conv.title}</Text>
                <br />
                <Text type="secondary">{conv.messages}条对话</Text>
                <Text type="secondary" style={{ float: 'right' }}>{conv.time}</Text>
              </>
            )}
          </div>
        </Dropdown>
      ))}
    </div>
  );
};

export default ChatSidebar;