import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Option } = Select;

interface FormValues {
  name: string;
  model: string;
  tokenizer_path: string;
  doc_dir: string;
  rag_doc_filter_relevance: number;
}

interface Model {
  name: string;
  status: string;
}

const CreateRAG: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/models');
      setModels(response.data.filter((model: Model) => model.status === 'running'));
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
    form.setFieldsValue({ 
      rag_doc_filter_relevance: 2
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await axios.post('/rags/add', values);
      setIsModalVisible(false);
      form.resetFields();
      message.success('RAG添加成功');
    } catch (error) {
      console.error('Error adding RAG:', error);
      message.error('添加RAG失败');
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
        添加RAG
      </Button>
      <Modal
        title="添加RAG"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="RAG名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label="模型" rules={[{ required: true }]}>
            <Select>
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tokenizer_path" label="Tokenizer路径" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="doc_dir" label="文档目录" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="rag_doc_filter_relevance" label="文档过滤相关度" initialValue={2}>
            <InputNumber min={0} step={0.1} max={10} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CreateRAG;