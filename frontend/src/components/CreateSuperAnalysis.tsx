import React from 'react';
import { Form, Input, InputNumber, Button, message, Modal, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface CreateSuperAnalysisProps {
  onAnalysisAdded: () => void;
}

interface CreateSuperAnalysisProps {
  onAnalysisAdded: () => void;
  visible: boolean;
  onCancel: () => void;
}

const CreateSuperAnalysis: React.FC<CreateSuperAnalysisProps> = ({ onAnalysisAdded, visible, onCancel }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    try {
      await axios.post('/super-analysis/add', values);
      message.success('Super Analysis添加成功');
      form.resetFields();
      onAnalysisAdded();
    } catch (error) {
      console.error('Error adding analysis:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`添加失败: ${error.response.data.detail}`);
      } else {
        message.error('添加失败');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          添加 Super Analysis
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
        initialValues={{
          host: '0.0.0.0',
          port: 8000,
          byzer_sql_url: 'http://127.0.0.1:9003/run/script'
        }}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="served_model_name"
          label="服务模型名称"
          rules={[{ required: true, message: '请输入服务模型名称' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="port"
          label="端口"
          rules={[{ required: true, message: '请输入端口号' }]}
        >
          <InputNumber min={1024} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="schema_rag_base_url"
          label="Schema RAG URL"
          rules={[{ required: true, message: '请输入Schema RAG URL' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="context_rag_base_url"
          label="Context RAG URL"
          rules={[{ required: true, message: '请输入Context RAG URL' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="byzer_sql_url"
          label="Byzer SQL URL"
          rules={[{ required: true, message: '请输入Byzer SQL URL' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="host"
          label="主机"
        >
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSuperAnalysis;