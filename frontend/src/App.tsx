import React, { useState, useCallback } from 'react';
import { Layout, Menu, Typography, Space } from 'antd';
import { RocketOutlined, AppstoreOutlined, DatabaseOutlined, SettingOutlined, MessageOutlined } from '@ant-design/icons';
import ModelList from './components/ModelList';
import CreateModel from './components/CreateModel';
import RAGList from './components/RAGList';
import CreateRAG from './components/CreateRAG';
import ConfigList from './components/ConfigList';
import ConfigAdd from './components/ConfigAdd';
import ConfigEdit from './components/ConfigEdit';
import OpenAICompatibleService from './components/OpenAICompatibleService';
import Chat from './components/Chat';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { SubMenu } = Menu;

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshRAGTrigger, setRefreshRAGTrigger] = useState(0);
  const [refreshConfigTrigger, setRefreshConfigTrigger] = useState(0);

  const refreshModelList = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshRAGList = useCallback(() => {
    setRefreshRAGTrigger(prev => prev + 1);
  }, []);

  const refreshConfigList = useCallback(() => {
    setRefreshConfigTrigger(prev => prev + 1);
  }, []);

  const renderContent = () => {
    switch (selectedKey) {
      case '1.1':
        return (
          <>
            <CreateModel onModelAdded={refreshModelList} />
            <ModelList refreshTrigger={refreshTrigger} />
          </>
        );
      case '1.2':
        return <OpenAICompatibleService />;
      case '2':
        return (
          <>
            <CreateRAG onRAGAdded={refreshRAGList} />
            <RAGList refreshTrigger={refreshRAGTrigger} />
          </>
        );
      case '3.1':
        return <ConfigList refreshTrigger={refreshConfigTrigger} />;
      case '3.2':
        return <ConfigAdd onConfigAdded={refreshConfigList} />;
      case '3.3':
        return <ConfigEdit onConfigUpdated={refreshConfigList} />;
      case '4':
        return <Chat />;
      default:
        return (
          <>
            <CreateModel onModelAdded={refreshModelList} />
            <ModelList refreshTrigger={refreshTrigger} />
          </>
        );
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} style={{ background: '#fff' }}>
        <div className="logo" style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu mode="inline" defaultSelectedKeys={['1']} defaultOpenKeys={['1', '3']} onSelect={({ key }) => setSelectedKey(key)} style={{ borderRight: 0 }}>
          <SubMenu key="1" icon={<RocketOutlined />} title="模型管理">
            <Menu.Item key="1.1">模型列表</Menu.Item>
            <Menu.Item key="1.2">OpenAI兼容服务</Menu.Item>
          </SubMenu>
          <Menu.Item key="2" icon={<DatabaseOutlined />}>
            RAG管理
          </Menu.Item>
          <SubMenu key="3" icon={<SettingOutlined />} title="配置管理">
            <Menu.Item key="3.1">查看配置</Menu.Item>
            <Menu.Item key="3.2">添加配置</Menu.Item>
            <Menu.Item key="3.3">编辑配置</Menu.Item>
          </SubMenu>
          <Menu.Item key="4" icon={<MessageOutlined />}>
            聊天
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