import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Menu, Typography, Space, Button } from 'antd';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { RocketOutlined, AppstoreOutlined, DatabaseOutlined, FolderOutlined, SettingOutlined, MessageOutlined, CodeOutlined, ThunderboltOutlined, LogoutOutlined, KeyOutlined } from '@ant-design/icons';
import ModelList from './components/ModelList';
import CreateModel from './components/CreateModel';
import RAGList from './components/RAGList';
import CreateRAG from './components/CreateRAG';
import ConfigList from './components/ConfigList';
import ConfigAdd from './components/ConfigAdd';
import ConfigEdit from './components/ConfigEdit';
import OpenAICompatibleService from './components/OpenAICompatibleService';
import Chat from './components/Chat';
import AutoCoderChatViz from './components/AutoCoderChatViz';
import APIKeyManagement from './components/APIKeyManagement';
import SuperAnalysisList from './components/SuperAnalysisList';
import ByzerSQLList from './components/ByzerSQLList';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import FileManagement from './components/FileManagement';
import AppStore from './components/AppStore';
import Annotation from './components/Annotation';
import './App.css';
import axios from 'axios';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { SubMenu } = Menu;

const menuKeyToPermission: { [key: string]: string } = {
  '1.1': '模型列表',
  '1.2': 'OpenAI兼容服务',
  '2': 'RAG管理',
  '3.1': '查看配置',
  '3.2': '添加配置',
  '3.3': '编辑配置',
  '4': '聊天',
  '5': 'AutoCoder',
  '6': '超级分析',
  '7': 'ByzerSQL',
  '8': '用户管理',
  '9': '文件管理',
  '10': '应用广场',
  '11': 'API Key管理'
};

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshRAGTrigger, setRefreshRAGTrigger] = useState(0);
  const [refreshConfigTrigger, setRefreshConfigTrigger] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchUserPermissions = async () => {
    try {
      const response = await axios.get(`/api/users/${username}`);
      const { permissions } = response.data;
      setPermissions(permissions);
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
    }
  };

  useEffect(() => {
    // 从sessionStorage恢复登录状态
    const storedUsername = sessionStorage.getItem('username');
    const storedToken = sessionStorage.getItem('access_token');
    if (storedUsername && storedToken) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
      // 设置axios默认headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      // 获取最新权限
      fetchUserPermissions();
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      // 每次路由切换时获取最新权限
      fetchUserPermissions();
    }
  }, [selectedKey]);

  const refreshModelList = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshRAGList = useCallback(() => {
    setRefreshRAGTrigger(prev => prev + 1);
  }, []);

  const refreshConfigList = useCallback(() => {
    setRefreshConfigTrigger(prev => prev + 1);
  }, []);

  const handleLoginSuccess = async (username: string, permissions: string[], access_token: string) => {
    setIsLoggedIn(true);
    setUsername(username);
    // 保存到sessionStorage
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('access_token', access_token);
    // 设置axios默认headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    // 获取最新权限
    await fetchUserPermissions();
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPermissions([]);
    // 清除sessionStorage
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('access_token');
    // 清除axios默认headers
    delete axios.defaults.headers.common['Authorization'];
  };

  const hasPermission = (key: string): boolean => {
    if (permissions.includes('*')) return true;
    const requiredPermission = menuKeyToPermission[key];
    return permissions.includes(requiredPermission);
  };

  const renderContent = () => {
    if (!hasPermission(selectedKey)) {
      return <div>无权访问此页面</div>;
    }

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
      case '5':
        return <AutoCoderChatViz />;
      case '6':
        return <SuperAnalysisList refreshTrigger={refreshTrigger} />;
      case '7':
        return <ByzerSQLList refreshTrigger={refreshTrigger} />;
      case '8':
        return <UserManagement />;
      case '9':
        return <FileManagement />;
      case '10':
        return <AppStore onNavigate={setSelectedKey} />;
      case '11':
        return <APIKeyManagement />;
      case 'annotation':
        return <Annotation />;
      default:
        return (
          <>
            <CreateModel onModelAdded={refreshModelList} />
            <ModelList refreshTrigger={refreshTrigger} />
          </>
        );
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
      <Layout style={{ minHeight: '100vh' }} className="app-container">
      <Sider width={250} style={{ background: '#fff' }}>
        <div className="logo" style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }}>
          <div style={{ padding: '20px', color: '#1890ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>欢迎, {username}</span>
            <Button 
              type="text" 
              icon={<LogoutOutlined />} 
              onClick={handleLogout}
              style={{ color: '#1890ff' }}
            />
          </div>
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['1']}
          defaultOpenKeys={['1', '3']}
          onSelect={({ key }) => setSelectedKey(key)}
          style={{ borderRight: 0 }}
        >
          {hasPermission('1.1') && (
            <SubMenu key="1" icon={<RocketOutlined />} title="模型管理">
              <Menu.Item key="1.1">模型列表</Menu.Item>
              {hasPermission('1.2') && <Menu.Item key="1.2">OpenAI兼容服务</Menu.Item>}
            </SubMenu>
          )}
          {hasPermission('2') && (
            <Menu.Item key="2" icon={<DatabaseOutlined />}>
              RAG管理
            </Menu.Item>
          )}
          {(hasPermission('3.1') || hasPermission('3.2') || hasPermission('3.3')) && (
            <SubMenu key="3" icon={<SettingOutlined />} title="配置管理">
              {hasPermission('3.1') && <Menu.Item key="3.1">查看配置</Menu.Item>}
              {hasPermission('3.2') && <Menu.Item key="3.2">添加配置</Menu.Item>}
              {hasPermission('3.3') && <Menu.Item key="3.3">编辑配置</Menu.Item>}
            </SubMenu>
          )}
          {hasPermission('4') && (
            <Menu.Item key="4" icon={<MessageOutlined />}>
              聊天
            </Menu.Item>
          )}
          {hasPermission('5') && (
            <Menu.Item key="5" icon={<CodeOutlined />}>
              AutoCoder
            </Menu.Item>
          )}
          {hasPermission('6') && (
            <Menu.Item key="6" icon={<ThunderboltOutlined />}>
              超级分析
            </Menu.Item>
          )}
          {hasPermission('7') && (
            <Menu.Item key="7" icon={<AppstoreOutlined />}>
              ByzerSQL
            </Menu.Item>
          )}
          {(username === 'admin' || permissions.includes('*')) && (
            <Menu.Item key="8" icon={<SettingOutlined />}>
              用户管理
            </Menu.Item>
          )}
          {hasPermission('9') && (
            <Menu.Item key="9" icon={<FolderOutlined />}>
              文件管理
            </Menu.Item>
          )}
          {hasPermission('10') && (
            <Menu.Item key="10" icon={<AppstoreOutlined />}>
              应用广场
            </Menu.Item>
          )}
          {hasPermission('11') && (
            <Menu.Item key="11" icon={<KeyOutlined />}>
              API Key管理
            </Menu.Item>
          )}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, boxShadow: '0 1px 4px rgba(0,21,41,.08)' }} />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          {renderContent()}
        </Content>
        </Layout>
      </Layout>    
  );
}

export default App;