import React from 'react';
import { Row, Col, Card, Typography, Input, Button } from 'antd';
import { SearchOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import './AppStore.css';

const { Title, Text } = Typography;
const { Meta } = Card;

const apps = [
  {
    title: '数据可视化',
    description: '强大的数据可视化工具，支持多种图表类型',
    icon: '📊',
    url: '#'
  },
  {
    title: 'AI 助手',
    description: '智能对话助手，提供实时问答和知识检索',
    icon: '🤖',
    url: '#'
  },
  {
    title: '文档处理',
    description: '文档格式转换、内容提取和批量处理工具',
    icon: '📄',
    url: '#'
  },
  {
    title: '代码生成',
    description: '根据需求自动生成代码片段和完整项目',
    icon: '💻',
    url: '#'
  },
  {
    title: 'API 测试',
    description: '全面的API测试工具，支持多种协议',
    icon: '🔌',
    url: '#'
  },
  {
    title: '项目管理',
    description: '敏捷开发管理工具，支持看板和甘特图',
    icon: '📅',
    url: '#'
  }
];

const AppStore = () => {
  return (
    <div className="app-store-container">
      <div className="app-store-header">
        <Title level={2}>应用广场</Title>
        <Text type="secondary">探索和安装各种生产力工具</Text>
        <div className="search-bar">
          <Input 
            placeholder="搜索应用..." 
            prefix={<SearchOutlined />}
            style={{ width: 400 }}
          />
          <Button type="primary" icon={<AppstoreAddOutlined />}>
            提交新应用
          </Button>
        </div>
      </div>
      
      <Row gutter={[24, 24]} className="app-grid">
        {apps.map((app, index) => (
          <Col key={index} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              cover={
                <div className="app-icon">
                  <span>{app.icon}</span>
                </div>
              }
              onClick={() => window.open(app.url, '_blank')}
            >
              <Meta
                title={app.title}
                description={app.description}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AppStore;