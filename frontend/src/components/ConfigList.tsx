import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, message, Card, Typography, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Config {
  key: string;
  value: any;
}

interface ConfigListProps {
  refreshTrigger: number;
}

const ConfigList: React.FC<ConfigListProps> = ({ refreshTrigger }) => {
  const [config, setConfig] = useState<Config[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [refreshTrigger]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/config');
      const configData = Object.entries(response.data).map(([key, value]) => ({ key, value }));
      setConfig(configData);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('获取配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '配置项',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: any) => JSON.stringify(value),
    },
  ];

  return (
    <Card>
      <Title level={2}>
        <Space>
          <SettingOutlined />
          配置列表
        </Space>
      </Title>
      <Table 
        columns={columns} 
        dataSource={config} 
        rowKey="key" 
        loading={loading}
        pagination={false}
        bordered
      />
    </Card>
  );
};

export default ConfigList;