import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, Select, message, Card, Typography, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

interface ConfigEditProps {
  onConfigUpdated: () => void;
}

const ConfigEdit: React.FC<ConfigEditProps> = ({ onConfigUpdated }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('获取配置列表失败');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await axios.put(`/config/${values.key}`, { [values.key]: values.value });
      message.success('配置项更新成功');
      form.resetFields();
      onConfigUpdated();
      fetchConfig();
    } catch (error) {
      console.error('Error updating config:', error);
      message.error('更新配置项失败');
    } finally {
      setLoading(false);
    }
  };

  const onKeyChange = (key: string) => {
    form.setFieldsValue({ value: JSON.stringify(config[key]) });
  };

  return (
    <Card>
      <Title level={2}>
        <Space>
          <EditOutlined />
          编辑配置
        </Space>
      </Title>
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item name="key" label="配置项" rules={[{ required: true, message: '请选择配置项' }]}>
          <Select onChange={onKeyChange}>
            {Object.keys(config).map(key => (
              <Option key={key} value={key}>{key}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            更新
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ConfigEdit;