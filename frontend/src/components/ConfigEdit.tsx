import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, Select, message, Card, Typography, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

interface ConfigEditProps {
  onConfigUpdated: () => void;
}

interface ConfigItem {
  value: string;
  label: string;
}

interface Config {
  [key: string]: ConfigItem[];
}

const ConfigEdit: React.FC<ConfigEditProps> = ({ onConfigUpdated }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config>({});
  const [selectedConfigType, setSelectedConfigType] = useState<string>('');
  const [selectedConfigItem, setSelectedConfigItem] = useState<string>('');

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
      const updatedConfig = {...config};
      const itemIndex = updatedConfig[selectedConfigType].findIndex(item => item.value === selectedConfigItem);
      if (itemIndex !== -1) {
        updatedConfig[selectedConfigType][itemIndex] = {
          value: values.value,
          label: values.label
        };
      }
      await axios.put(`/config/${selectedConfigType}`, { [selectedConfigType]: updatedConfig[selectedConfigType] });
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

  const onConfigTypeChange = (configType: string) => {
    setSelectedConfigType(configType);
    form.resetFields(['configItem', 'value', 'label']);
  };

  const onConfigItemChange = (configItemValue: string) => {
    setSelectedConfigItem(configItemValue);
    const selectedItem = config[selectedConfigType].find(item => item.value === configItemValue);
    if (selectedItem) {
      form.setFieldsValue({
        value: selectedItem.value,
        label: selectedItem.label
      });
    }
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
        <Form.Item name="configType" label="配置类型" rules={[{ required: true, message: '请选择配置类型' }]}>
          <Select onChange={onConfigTypeChange}>
            {Object.keys(config).map(key => (
              <Option key={key} value={key}>{key}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="configItem" label="配置项" rules={[{ required: true, message: '请选择配置项' }]}>
          <Select onChange={onConfigItemChange} disabled={!selectedConfigType}>
            {selectedConfigType && config[selectedConfigType]?.map(item => (
              <Option key={item.value} value={item.value}>{item.label}</Option>
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
            更新
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ConfigEdit;