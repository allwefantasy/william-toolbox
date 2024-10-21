import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, message, Card, Typography, Space, Switch } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

const { Title } = Typography;

const OpenAICompatibleService: React.FC = () => {
  const [form] = Form.useForm();
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServiceStatus();
  }, []);

  const fetchServiceStatus = async () => {
    try {
      const response = await axios.get('/openai-compatible-service/status');
      setIsRunning(response.data.isRunning);
    } catch (error) {
      console.error('Error fetching service status:', error);
      message.error('获取服务状态失败');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isRunning) {
        await axios.post('/openai-compatible-service/stop');
        message.success('OpenAI兼容服务已停止');
        setIsRunning(false);
      } else {
        await axios.post('/openai-compatible-service/start', values);
        message.success('OpenAI兼容服务已启动');
        setIsRunning(true);
      }
    } catch (error) {
      console.error('Error managing service:', error);
      message.error(isRunning ? '停止服务失败' : '启动服务失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={2}>
        <Space>
          <RocketOutlined />
          OpenAI兼容服务
        </Space>
      </Title>
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item name="host" label="主机" initialValue="0.0.0.0">
          <Input disabled={isRunning} />
        </Form.Item>
        <Form.Item name="port" label="端口" initialValue={8000}>
          <Input type="number" disabled={isRunning} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isRunning ? '停止服务' : '启动服务'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default OpenAICompatibleService;