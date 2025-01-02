import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Spin } from 'antd';
import axios from 'axios';

const { Option } = Select;

interface User {
  username: string;
  is_admin: boolean;
  permissions: string[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [ragsList, setRagsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [availablePages] = useState([
    '模型列表',
    'OpenAI兼容服务',
    'RAG管理',
    '查看配置',
    '添加配置',
    '编辑配置',
    '聊天',
    'AutoCoder',
    '超级分析',
    'ByzerSQL'
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersResponse = await axios.get('/api/users');
      const usersArray = Object.entries(usersResponse.data).map(([username, data]: [string, any]) => ({
        username,
        ...data
      }));
      setUsers(usersArray);

      // Fetch models
      const modelsResponse = await axios.get('/models');
      setModelsList(modelsResponse.data.map((model: any) => model.name));

      // Fetch RAGs
      const ragsResponse = await axios.get('/rags');
      setRagsList(ragsResponse.data.map((rag: any) => rag.name));
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      const usersArray = Object.entries(response.data).map(([username, data]: [string, any]) => ({
        username,
        ...data
      }));
      setUsers(usersArray);
    } catch (error) {
      message.error('获取用户列表失败');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async (values: any) => {
    try {
      await axios.post('/api/users', {
        username: values.username,
        password: values.password,
        permissions: values.permissions,
        is_admin: values.is_admin
      });
      message.success('添加用户成功');
      setIsModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('添加用户失败');
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      await axios.delete(`/api/users/${username}`);
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  const handleUpdatePermissions = async (
    username: string, 
    permissions: string[], 
    model_permissions: string[] = [], 
    rag_permissions: string[] = []
  ) => {
    try {
      await axios.put(`/api/users/${username}/permissions`, {
        username,
        permissions,
        model_permissions,
        rag_permissions
      });
      message.success('更新权限成功');
      fetchData();
    } catch (error) {
      message.error('更新权限失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '管理员',
      dataIndex: 'is_admin',
      key: 'is_admin',
      render: (isAdmin: boolean) => isAdmin ? '是' : '否',
    },
    {
      title: '页面权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[], record: User) => (
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={permissions}
          onChange={(value) => handleUpdatePermissions(record.username, value)}
          disabled={record.username === 'admin'}
        >
          {availablePages.map(page => (
            <Option key={page} value={page}>{page}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '模型权限',
      dataIndex: 'model_permissions',
      key: 'model_permissions',
      render: (model_permissions: string[], record: User) => (
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={model_permissions || []}
          onChange={(value) => handleUpdatePermissions(record.username, record.permissions, value, record.rag_permissions)}
          disabled={record.username === 'admin'}
        >
          {modelsList.map(model => (
            <Option key={model} value={model}>{model}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'RAG权限',
      dataIndex: 'rag_permissions',
      key: 'rag_permissions',
      render: (rag_permissions: string[], record: User) => (
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={rag_permissions || []}
          onChange={(value) => handleUpdatePermissions(record.username, record.permissions, record.model_permissions, value)}
          disabled={record.username === 'admin'}
        >
          {ragsList.map(rag => (
            <Option key={rag} value={rag}>{rag}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: User) => (
        <Space size="middle">
          <Button
            danger
            onClick={() => handleDeleteUser(record.username)}
            disabled={record.username === 'admin'}
          >
            删除
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
      >
        添加用户
      </Button>

      <Table columns={columns} dataSource={users} rowKey="username" />

      <Modal
        title="添加用户"
        visible={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          onFinish={handleAddUser}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限"
            rules={[{ required: true, message: '请选择权限' }]}
          >
            <Select mode="multiple">
              {availablePages.map(page => (
                <Option key={page} value={page}>{page}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="is_admin"
            label="是否为管理员"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
