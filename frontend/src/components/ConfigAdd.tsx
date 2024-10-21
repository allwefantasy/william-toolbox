import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, message, Card, Typography, Space, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

interface ConfigAddProps {
  onConfigAdded: () => void;
}

const ConfigAdd: React.FC<ConfigAddProps> = ({ onConfigAdded }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configTypes, setConfigTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchConfigTypes();
  }, []);

  const fetchConfigTypes = async () => {
    try {
      const response = await axios.get('/config');
      setConfigTypes(Object.keys(response.data));
    } catch (error) {
      console.error('Error fetching config types:', error);
      message.error('获取配置类型失败');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await axios.post('/config', {
        [values.configType]: [{
          value: values.value,
          label: values.label
        }]
      });
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
        <Form.Item name="configType" label="配置类型" rules={[{ required: true, message: '请选择配置类型' }]}>
          <Select>
            {configTypes.map(type => (
              <Option key={type} value={type}>{type}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入值' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="label" label="标签" rules={[{ required: true, message: '请输入标签' }]}>
          <Input />
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