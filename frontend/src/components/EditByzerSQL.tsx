import React, { useEffect } from 'react';
import { Form, Input, Button, message, Modal, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface ByzerSQL {
  name: string;
  status: string;
  install_dir: string;
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