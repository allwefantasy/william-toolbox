import React, { useState, useRef, useEffect } from 'react';
import ChatSidebar from './ChatSidebar';
import ChatMessageList from './ChatMessageList';
import ChatInputArea from './ChatInputArea';
import ChatCsvPreview from './ChatCsvPreview';
import { Spin } from 'antd';
import './Chat.css';

const ChatMain: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [csvPreviewVisible, setCsvPreviewVisible] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvMeta, setCsvMeta] = useState<any>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [pendingMessage, setPendingMessage] = useState('');

  const handleCsvPreviewOk = async () => {
    // ... 保持原有逻辑
  };

  const handleCsvPreviewCancel = () => {
    // ... 保持原有逻辑
  };

  return (
    <div className="chat-container">
      <ChatCsvPreview
        visible={csvPreviewVisible}
        onOk={handleCsvPreviewOk}
        onCancel={handleCsvPreviewCancel}
        csvData={csvData}
        csvMeta={csvMeta}
        selectedColumns={selectedColumns}
        setSelectedColumns={setSelectedColumns}
      />
      <ChatSidebar />
      <div className="chat-area">
        <ChatMessageList />
        <ChatInputArea 
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          setCsvPreviewVisible={setCsvPreviewVisible}
          setCsvData={setCsvData}
          setCsvMeta={setCsvMeta}
          setPendingMessage={setPendingMessage}
        />
      </div>
    </div>
  );
};

export default ChatMain;