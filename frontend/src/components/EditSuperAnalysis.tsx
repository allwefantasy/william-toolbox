import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Button, message, Modal, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface SuperAnalysis {
  name: string;
  status: string;
  served_model_name: string;
  port: number;
  schema_rag_base_url: string;
  context_rag_base_url: string;
  byzer_sql_url: string;
  host: string;
}

interface EditSuperAnalysisProps {
  analysis: SuperAnalysis;
  onAnalysisUpdated: () => void;
  visible: boolean;
  onCancel: () => void;
}

const EditSuperAnalysis: React.FC<EditSuperAnalysisProps> = ({ analysis, onAnalysisUpdated, visible, onCancel }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(analysis);
  }, [analysis, form]);

  const handleSubmit = async (values: any) => {
    try {
      await axios.put(`/super-analysis/${analysis.name}`, values);
      message.success('Super Analysis更新成功');
      onAnalysisUpdated();
    } catch (error) {
      console.error('Error updating analysis:', error);
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
          编辑 Super Analysis
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
          label="名称"
        >
          <Input disabled />
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
            更新
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditSuperAnalysis;