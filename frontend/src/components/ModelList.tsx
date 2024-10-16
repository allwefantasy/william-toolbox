import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, message, Spin } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined } from '@ant-design/icons';

interface Model {
  name: string;
  status: 'stopped' | 'running';
}

const ModelList: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    }
  };

  const handleAction = async (modelName: string, action: 'start' | 'stop') => {
    try {
      await axios.post(`/models/${modelName}/${action}`);
      fetchModels();
      message.success(`${action === 'start' ? '启动' : '停止'}模型成功`);
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
      message.error(`${action === 'start' ? '启动' : '停止'}模型失败`);
    }
  };

  const refreshStatus = async (modelName: string) => {
    setLoading(prev => ({ ...prev, [modelName]: true }));
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
      setLoading(prev => ({ ...prev, [modelName]: false }));
    }
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span style={{ color: status === 'running' ? 'green' : 'red' }}>
          {status === 'running' ? '运行中' : '已停止'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Model) => (
        <>
          <Button
            type={record.status === 'stopped' ? 'primary' : 'default'}
            icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
            onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
            style={{ 
              backgroundColor: record.status === 'stopped' ? '#52c41a' : '#f5222d',
              borderColor: record.status === 'stopped' ? '#52c41a' : '#f5222d',
              marginRight: '8px'
            }}
          >
            {record.status === 'stopped' ? '启动' : '停止'}
          </Button>
          <Button
            icon={<SyncOutlined spin={loading[record.name]} />}
            onClick={() => refreshStatus(record.name)}
            disabled={loading[record.name]}
          >
            刷新状态
          </Button>
        </>
      ),
    },
  ];

  return (
    <div>
      <h1>模型列表</h1>
      <Table columns={columns} dataSource={models} rowKey="name" />
    </div>
  );
};

export default ModelList;