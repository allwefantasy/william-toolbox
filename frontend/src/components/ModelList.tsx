import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, RocketOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Model {
  name: string;
  status: 'stopped' | 'running';
}

const ModelList: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (modelName: string, action: 'start' | 'stop') => {
    try {
      await axios.post(`/models/${modelName}/${action}`);
      await fetchModels();
      message.success(`${action === 'start' ? '启动' : '停止'}模型成功`);
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
      message.error(`${action === 'start' ? '启动' : '停止'}模型失败`);
    }
  };

  const refreshStatus = async (modelName: string) => {
    setRefreshing(prev => ({ ...prev, [modelName]: true }));
    try {
      const response = await axios.get(`/models/${modelName}/status`);
      const newStatus = response.data.success ? 'running' : 'stopped';
      setModels(prevModels =>
        prevModels.map(model =>
          model.name === modelName ? { ...model, status: newStatus } : model
        )
      );
      message.success(`刷新状态成功: ${newStatus}`);
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [modelName]: false }));
    }
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'running' ? 'green' : 'red'}>
          {status === 'running' ? '运行中' : '已停止'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Model) => (
        <Space size="middle">
          <Button
            type={record.status === 'stopped' ? 'primary' : 'default'}
            icon={record.status === 'stopped' ? <RocketOutlined /> : <PauseCircleOutlined />}
            onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
          >
            {record.status === 'stopped' ? '启动' : '停止'}
          </Button>
          <Button
            icon={<SyncOutlined spin={refreshing[record.name]} />}
            onClick={() => refreshStatus(record.name)}
            disabled={refreshing[record.name]}
          >
            刷新状态
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Title level={2}>
        <Space>
          <RocketOutlined />
          模型列表
        </Space>
      </Title>
      <Table 
        columns={columns} 
        dataSource={models} 
        rowKey="name" 
        loading={loading}
        pagination={false}
        bordered
      />
    </Card>
  );
};

export default ModelList;