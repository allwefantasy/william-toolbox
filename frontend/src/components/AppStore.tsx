import React from 'react';
import { Row, Col, Card, Typography, Input, Button } from 'antd';
import { SearchOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import './AppStore.css';

const { Title, Text } = Typography;
const { Meta } = Card;

const apps = [
  {
    title: 'AI批注',
    description: '智能文档批注工具，支持自动标注和内容分析',
    icon: '📄',
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