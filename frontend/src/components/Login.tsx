import React, { useState } from 'react';
import { Form, Input, Button, message, Modal } from 'antd';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: (username: string, permissions: string[]) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [changePasswordForm] = Form.useForm();

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      const response = await axios.post('/api/login', values);
      if (response.data.first_login) {
        setUsername(values.username);
        setChangePasswordVisible(true);
      } else {
        onLoginSuccess(values.username, response.data.permissions);
      }
    } catch (error) {
      message.error('登录失败');
    }
  };

  const handleChangePassword = async (values: { new_password: string }) => {
    try {
      await axios.post('/api/change-password', {
        username,
        new_password: values.new_password,
      });
      message.success('密码修改成功');
      setChangePasswordVisible(false);
      // 使用新密码重新登录
      const response = await axios.post('/api/login', {
        username,
        password: values.new_password,
      });
      onLoginSuccess(username, response.data.permissions);
    } catch (error) {
      message.error('密码修改失败');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#f0f2f5'
    }}>
      <div style={{ 
        width: 400, 
        padding: '40px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>登录</h1>
        <Form
          name="login"
          onFinish={handleLogin}
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
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <Modal
          title="修改密码"
          visible={changePasswordVisible}
          onOk={() => changePasswordForm.submit()}
          onCancel={() => setChangePasswordVisible(false)}
        >
          <Form
            form={changePasswordForm}
            onFinish={handleChangePassword}
            layout="vertical"
          >
            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度至少6位' }
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认密码"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default Login;
