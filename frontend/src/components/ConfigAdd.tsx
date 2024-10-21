import React, { useState } from 'react';
import axios from 'axios';
import { Form, Input, Button, message, Card, Typography, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface ConfigAddProps {
  onConfigAdded: () => void;
}

const ConfigAdd: React.FC<ConfigAddProps> = ({ onConfigAdded }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await axios.post('/config', { [values.key]: values.value });
      message.success('配置项添加成功');
      form.resetFields();
      onConfigAdded();
    } catch (error) {
      console.error('Error adding config:', error);
      message.error('添加配置项失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={2}>
        <Space>
          <PlusOutlined />
          添加配置
        </Space>
      </Title>
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item name="key" label="配置项" rules={[{ required: true, message: '请输入配置项' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            添加
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ConfigAdd;