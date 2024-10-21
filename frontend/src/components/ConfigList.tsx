import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, message, Card, Typography, Space, Collapse } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Panel } = Collapse;

interface ConfigItem {
  value: string;
  label: string;
}

interface Config {
  [key: string]: ConfigItem[];
}

interface ConfigListProps {
  refreshTrigger: number;
}

const ConfigList: React.FC<ConfigListProps> = ({ refreshTrigger }) => {
  const [config, setConfig] = useState<Config>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [refreshTrigger]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('获取配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
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
      <Collapse>
        {Object.entries(config).map(([configType, items]) => (
          <Panel header={configType} key={configType}>
            <Table 
              columns={columns} 
              dataSource={items} 
              rowKey="value" 
              pagination={false}
              bordered
            />
          </Panel>
        ))}
      </Collapse>
    </Card>
  );
};

export default ConfigList;