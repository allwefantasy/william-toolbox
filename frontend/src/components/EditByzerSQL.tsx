import React, { useEffect } from 'react';
import { Form, Input, Button, message, Modal, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface ByzerSQL {
  name: string;
  status: string;
  install_dir: string;
  host: string;
  port: number;
}

interface EditByzerSQLProps {
  service: ByzerSQL | null;
  onServiceUpdated: () => void;
  visible: boolean;
  onCancel: () => void;
}

const EditByzerSQL: React.FC<EditByzerSQLProps> = ({ service, onServiceUpdated, visible, onCancel }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (service) {
      form.setFieldsValue(service);
    }
  }, [service, form]);

  const handleSubmit = async (values: any) => {
    if (!service) return;
    
    try {
      await axios.put(`/byzer-sql/${service.name}`, values);
      message.success('Byzer SQL更新成功');
      onServiceUpdated();
    } catch (error) {
      console.error('Error updating Byzer SQL:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`更新失败: ${error.response.data.detail}`);
      } else {
        message.error('更新失败');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          编辑 Byzer SQL
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="服务名称"
        >
          <Input disabled />
        </Form.Item>

        <Form.Item
          name="install_dir"
          label="安装目录"
          rules={[{ required: true, message: '请输入安装目录' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="host"
          label="主机地址"
          rules={[{ required: true, message: '请输入主机地址' }]}
        >
          <Input placeholder="127.0.0.1" />
        </Form.Item>

        <Form.Item
          name="port"
          label="端口"
          rules={[
            { required: true, message: '请输入端口号' },
            { type: 'number', transform: (value) => Number(value), message: '请输入有效的端口号' },
            { validator: (_, value) => {
                if (value > 0 && value < 65536) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('端口号必须在 1-65535 之间'));
              }
            }
          ]}
        >
          <Input type="number" placeholder="9003" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            更新
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditByzerSQL;