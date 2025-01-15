import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Spin } from 'antd';
import axios from 'axios';
import { KeyOutlined } from '@ant-design/icons';

interface APIKey {
  key: string;
  name: string;
  description?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

const APIKeyManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);

  const fetchAPIKeys = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      message.error('获取API Key列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const handleCreateAPIKey = async (values: any) => {
    try {
      const response = await axios.post('/api-keys', {
        name: values.name,
        description: values.description,
        expires_in_days: values.expires_in_days
      });
      setApiKeys([...apiKeys, response.data]);
      message.success('创建API Key成功');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('创建API Key失败');
    }
  };

  const handleRevokeAPIKey = async (key: string) => {
    try {
      await axios.delete(`/api-keys/${key}`);
      message.success('撤销API Key成功');
      fetchAPIKeys();
    } catch (error) {
      message.error('撤销API Key失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => isActive ? '有效' : '已撤销',
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: APIKey) => (
        <Space size="middle">
          <Button
            danger
            onClick={() => handleRevokeAPIKey(record.key)}
            disabled={!record.is_active}
          >
            撤销
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin /></div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Button
        type="primary"
        onClick={() => setIsModalVisible(true)}
        style={{ marginBottom: '16px' }}
        icon={<KeyOutlined />}
      >
        创建API Key
      </Button>

      <Table 
        columns={columns} 
        dataSource={apiKeys} 
        rowKey="key"
        pagination={false}
      />

      <Modal
        title="创建API Key"
        visible={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          onFinish={handleCreateAPIKey}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入API Key名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea />
          </Form.Item>
          <Form.Item
            name="expires_in_days"
            label="有效期（天）"
            initialValue={30}
            rules={[{ required: true, message: '请输入有效期' }]}
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default APIKeyManagement;
import React, { useState } from 'react';
import { Button, Table, Modal, Form, Input, Checkbox, message } from 'antd';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';

interface APIKey {
  key: string;
  name: string;
  description?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

const APIKeyManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAPIKeys = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      message.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAPIKey = async (values: any) => {
    try {
      // If never_expire is checked, set expires_in_days to -1
      const requestData = {
        ...values,
        expires_in_days: values.never_expire ? -1 : values.expires_in_days
      };
      
      const response = await axios.post('/api-keys', requestData);
      setApiKeys([...apiKeys, response.data]);
      setIsModalVisible(false);
      form.resetFields();
      message.success('API key created successfully');
    } catch (error) {
      message.error('Failed to create API key');
    }
  };

  const handleRevokeAPIKey = async (key: string) => {
    try {
      await axios.delete(`/api-keys/${key}`);
      setApiKeys(apiKeys.filter(k => k.key !== key));
      message.success('API key revoked successfully');
    } catch (error) {
      message.error('Failed to revoke API key');
    }
  };

  const columns: ColumnsType<APIKey> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (text, record) => record.expires_at === '-1' ? 'Never' : record.expires_at,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (is_active) => is_active ? 'Active' : 'Revoked',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          danger
          onClick={() => handleRevokeAPIKey(record.key)}
          disabled={!record.is_active}
        >
          Revoke
        </Button>
      ),
    },
  ];

  React.useEffect(() => {
    fetchAPIKeys();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Button
        type="primary"
        onClick={() => setIsModalVisible(true)}
        style={{ marginBottom: '16px' }}
      >
        Create API Key
      </Button>

      <Table
        columns={columns}
        dataSource={apiKeys}
        rowKey="key"
        loading={loading}
      />

      <Modal
        title="Create API Key"
        visible={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          onFinish={handleCreateAPIKey}
          layout="vertical"
          initialValues={{ expires_in_days: 30 }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input the name!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea />
          </Form.Item>

          <Form.Item
            name="never_expire"
            valuePropName="checked"
          >
            <Checkbox>Never expire</Checkbox>
          </Form.Item>

          <Form.Item
            name="expires_in_days"
            label="Expires in (days)"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('never_expire') || value > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Expiration days must be positive'));
                },
              }),
            ]}
          >
            <Input type="number" disabled={form.getFieldValue('never_expire')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default APIKeyManagement;