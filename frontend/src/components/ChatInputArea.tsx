import React, { useState } from 'react';
import { Input, Button, Select, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

interface ChatInputAreaProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setCsvPreviewVisible: (visible: boolean) => void;
  setCsvData: (data: any[]) => void;
  setCsvMeta: (meta: any) => void;
  setPendingMessage: (message: string) => void;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  isLoading,
  setIsLoading,
  setCsvPreviewVisible,
  setCsvData,
  setCsvMeta,
  setPendingMessage
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [listType, setListType] = useState<'models' | 'rags' | 'super-analysis'>('models');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [itemList, setItemList] = useState<string[]>([]);

  // ... 保持原有逻辑

  return (
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
  );
};

export default ChatInputArea;