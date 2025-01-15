import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Spin, Checkbox } from 'antd';
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
        expires_in_days: values.never_expires ? -1 : values.expires_in_days
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
            name="never_expires"
            label="永不过期"
            valuePropName="checked"
          >
            <Checkbox
              onChange={(e) => {
                if (e.target.checked) {
                  form.setFieldsValue({
                    expires_in_days: -1,
                    never_expires: true
                  });
                } else {
                  form.setFieldsValue({
                    expires_in_days: 30,
                    never_expires: false
                  });
                }
              }}
            >
              永不过期
            </Checkbox>
          </Form.Item>
          <Form.Item
            name="expires_in_days"
            label="有效期（天）"
            initialValue={30}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('never_expires') || (value >= 1 && value <= 365)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('有效期应在1-365天之间'));
                },
              }),
            ]}
          >
            <Input 
              type="number" 
              min={1} 
              max={365} 
              disabled={form.getFieldValue('never_expires')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default APIKeyManagement;