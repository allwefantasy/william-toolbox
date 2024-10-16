import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layout, Menu, Table, Button, message } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, PoweroffOutlined } from '@ant-design/icons';
import './App.css';

const { Header, Sider, Content } = Layout;

// 定义模型类型
interface Model {
  name: string;
  status: 'stopped' | 'running';
}

function App() {
  const [models, setModels] = useState<Model[]>([]);

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
      fetchModels(); // Refresh the model list after action
      message.success(`${action === 'start' ? '启动' : '停止'}模型成功`);
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
      message.error(`${action === 'start' ? '启动' : '停止'}模型失败`);
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
        <Button
          type={record.status === 'stopped' ? 'primary' : 'danger'}
          icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
          onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
          style={{ 
            backgroundColor: record.status === 'stopped' ? '#52c41a' : '#f5222d',
            borderColor: record.status === 'stopped' ? '#52c41a' : '#f5222d',
          }}
        >
          {record.status === 'stopped' ? '启动' : '停止'}
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div className="logo" />
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']}>
          <Menu.Item key="1">模型管理</Menu.Item>
        </Menu>
      </Sider>
      <Layout className="site-layout">
        <Header className="site-layout-background" style={{ padding: 0 }} />
        <Content style={{ margin: '16px' }}>
          <div className="site-layout-background" style={{ padding: 24, minHeight: 360 }}>
            <h1>模型管理</h1>
            <Table columns={columns} dataSource={models} rowKey="name" />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
