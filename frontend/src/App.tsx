import React from 'react';
import { Layout, Menu } from 'antd';
import ModelList from './components/ModelList';
import CreateModel from './components/CreateModel';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
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
            <CreateModel />
            <ModelList />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;