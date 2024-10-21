import React from 'react';
import { Card, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Chat: React.FC = () => {
  return (
    <Card>
      <Title level={2}>
        <MessageOutlined /> 聊天
      </Title>
      <p>这里是聊天界面的内容。您可以在此添加聊天功能。</p>
    </Card>
  );
};

export default Chat;