import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, message, Card, Typography, Space, Switch, Tabs } from 'antd';
import { RocketOutlined, SyncOutlined } from '@ant-design/icons';

const { Title } = Typography;

const OpenAICompatibleService: React.FC = () => {
  const [form] = Form.useForm();
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [outLog, setOutLog] = useState('');
  const [errLog, setErrLog] = useState('');

  const fetchLogs = async () => {
    try {
      const outResponse = await axios.get('/openai-compatible-service/logs/out');
      const errResponse = await axios.get('/openai-compatible-service/logs/err');
      setOutLog(outResponse.data.content);
      setErrLog(errResponse.data.content);
    } catch (error) {
      console.error('Error fetching logs:', error);
      message.error('获取日志失败');
    }
  };

  useEffect(() => {
    // 如果服务正在运行,每5秒刷新一次日志
    let logInterval: NodeJS.Timeout | null = null;
    if (isRunning) {
      fetchLogs();
      logInterval = setInterval(fetchLogs, 5000);
    }

    return () => {
      if (logInterval) {
        clearInterval(logInterval);
      }
    };
  }, [isRunning]);

  useEffect(() => {
    fetchServiceStatus();
  }, []);

  const fetchServiceStatus = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get('/openai-compatible-service/status');
      setIsRunning(response.data.isRunning);
      
      // 如果服务在运行,从config中获取host和port
      if (response.data.isRunning) {
        const config = await axios.get('/config');
        const openaiServer = config.data.openaiServerList?.[0];
        if (openaiServer) {
          form.setFieldsValue({
            host: openaiServer.host,
            port: openaiServer.port
          });
        }
      } else {
        // 服务未运行时设置默认值
        form.setFieldsValue({
          host: '0.0.0.0',
          port: 8000
        });
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
      message.error('获取服务状态失败');
    } finally {
      setRefreshing(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isRunning) {
        await axios.post('/openai-compatible-service/stop');
        message.success('OpenAI兼容服务已停止');
        setIsRunning(false);
        // 服务停止后重置表单为默认值
        form.setFieldsValue({
          host: '0.0.0.0',
          port: 8000
        });
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
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isRunning ? '停止服务' : '启动服务'}
            </Button>
            <Button 
              icon={<SyncOutlined spin={refreshing} />}
              onClick={fetchServiceStatus}
              disabled={refreshing}
            >
              刷新状态
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {isRunning && (
        <Card style={{ marginTop: 16 }}>
          <Tabs defaultActiveKey="out">
            <Tabs.TabPane tab="标准输出" key="out">
              <pre style={{ 
                maxHeight: '400px', 
                overflow: 'auto',
                backgroundColor: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px'
              }}>
                {outLog || '暂无日志'}
              </pre>
            </Tabs.TabPane>
            <Tabs.TabPane tab="错误日志" key="err">
              <pre style={{
                maxHeight: '400px',
                overflow: 'auto',
                backgroundColor: '#f5f5f5',
                padding: '12px',
                borderRadius: '4px'
              }}>
                {errLog || '暂无日志'}
              </pre>
            </Tabs.TabPane>
          </Tabs>
        </Card>
      )}
    </Card>
  );
};

export default OpenAICompatibleService;