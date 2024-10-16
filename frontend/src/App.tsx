import React, { useState } from 'react';
import { Layout, Menu, Typography, Space } from 'antd';
import { RocketOutlined, AppstoreOutlined, DatabaseOutlined } from '@ant-design/icons';
import ModelList from './components/ModelList';
import CreateModel from './components/CreateModel';
import RAGList from './components/RAGList';
import CreateRAG from './components/CreateRAG';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [selectedKey, setSelectedKey] = useState('1');

  const renderContent = () => {
    switch (selectedKey) {
      case '1':
        return (
          <>
            <CreateModel />
            <ModelList />
          </>
        );
      case '2':
        return (
          <>
            <CreateRAG />
            <RAGList />
          </>
        );
      default:
        return <div>其他功能</div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} style={{ background: '#fff' }}>
        <div className="logo" style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu mode="inline" defaultSelectedKeys={['1']} onSelect={({ key }) => setSelectedKey(key)} style={{ borderRight: 0 }}>
          <Menu.Item key="1" icon={<RocketOutlined />}>
            模型管理
          </Menu.Item>
          <Menu.Item key="2" icon={<DatabaseOutlined />}>
            RAG管理
          </Menu.Item>
          <Menu.Item key="3" icon={<AppstoreOutlined />}>
            其他功能
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <Space style={{ marginLeft: 24 }}>
            <RocketOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>William Toolbox</Title>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;