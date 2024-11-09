import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, message, Modal, Typography, Space, Select } from 'antd';
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
  const [rags, setRags] = useState<Array<{name: string, host: string, port: number}>>([]);
  const [schemaRagMode, setSchemaRagMode] = useState<'input' | 'select'>('input');
  const [contextRagMode, setContextRagMode] = useState<'input' | 'select'>('input');

  useEffect(() => {
    const fetchRags = async () => {
      try {
        const response = await axios.get('/rags');
        // 只设置状态为 running 的 RAGs
        setRags(response.data.filter((rag: any) => rag.status === 'running'));
      } catch (error) {
        console.error('Error fetching RAGs:', error);
        message.error('获取RAG列表失败');
      }
    };
    fetchRags();
  }, []);

  const handleRagSelect = (field: string, ragName: string) => {
    const selectedRag = rags.find(rag => rag.name === ragName);
    if (selectedRag) {
      const host = selectedRag.host === '0.0.0.0' ? '127.0.0.1' : selectedRag.host;
      const url = `http://${host}:${selectedRag.port}/v1`;
      form.setFieldsValue({
        [field]: url
      });
    }
  };

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
        <Form.Item label="Schema RAG URL" required>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              value={schemaRagMode}
              onChange={value => setSchemaRagMode(value)}
              style={{ width: '120px' }}
            >
              <Select.Option value="input">手动输入</Select.Option>
              <Select.Option value="select">选择RAG</Select.Option>
            </Select>
            {schemaRagMode === 'input' ? (
              <Form.Item
                name="schema_rag_base_url"
                noStyle
                rules={[{ required: true, message: '请输入Schema RAG URL' }]}
              >
                <Input style={{ width: 'calc(100% - 120px)' }} />
              </Form.Item>
            ) : (
              <Select
                style={{ width: 'calc(100% - 120px)' }}
                onChange={(value) => handleRagSelect('schema_rag_base_url', value)}
              >
                {rags.map(rag => (
                  <Select.Option key={rag.name} value={rag.name}>{rag.name}</Select.Option>
                ))}
              </Select>
            )}
          </Space.Compact>
        </Form.Item>
        
        <Form.Item label="Context RAG URL" required>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              value={contextRagMode}
              onChange={value => setContextRagMode(value)}
              style={{ width: '120px' }}
            >
              <Select.Option value="input">手动输入</Select.Option>
              <Select.Option value="select">选择RAG</Select.Option>
            </Select>
            {contextRagMode === 'input' ? (
              <Form.Item
                name="context_rag_base_url"
                noStyle
                rules={[{ required: true, message: '请输入Context RAG URL' }]}
              >
                <Input style={{ width: 'calc(100% - 120px)' }} />
              </Form.Item>
            ) : (
              <Select
                style={{ width: 'calc(100% - 120px)' }}
                onChange={(value) => handleRagSelect('context_rag_base_url', value)}
              >
                {rags.map(rag => (
                  <Select.Option key={rag.name} value={rag.name}>{rag.name}</Select.Option>
                ))}
              </Select>
            )}
          </Space.Compact>
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