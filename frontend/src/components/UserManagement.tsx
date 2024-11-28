import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message } from 'antd';
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
    fetchUsers();
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

  const handleUpdatePermissions = async (username: string, permissions: string[]) => {
    try {
      await axios.put(`/api/users/${username}/permissions`, {
        username,
        permissions
      });
      message.success('更新权限成功');
      fetchUsers();
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
      title: '权限',
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
