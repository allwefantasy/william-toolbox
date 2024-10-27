import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message, Switch, Tag, Tooltip, AutoComplete } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { PlusOutlined } from '@ant-design/icons';

const { Option } = Select;

interface FormValues {
  name: string;
  model: string;
  tokenizer_path: string;
  doc_dir: string;
  rag_doc_filter_relevance: number;
  host: string;
  port: number;
  required_exts: string;
  disable_inference_enhance: boolean;
  inference_deep_thought: boolean;
  enable_hybrid_index: boolean;
  hybrid_index_max_output_tokens: number;
}

interface Model {
  name: string;
  status: string;
}

interface CreateRAGProps {
  onRAGAdded: () => void;
}

const CreateRAG: React.FC<CreateRAGProps> = ({ onRAGAdded }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [models, setModels] = useState<Model[]>([]);
  const [tokenizerPaths, setTokenizerPaths] = useState<Array<{value: string, label: string}>>([]);

  useEffect(() => {
    fetchModels();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/config');
      // Extract tokenizer paths from commons config
      const tokenizerPathsFromCommons = response.data.commons?.filter((item: any) => 
        item.value.includes('tokenizer.json')
      ) || [];
      setTokenizerPaths(tokenizerPathsFromCommons);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('Failed to fetch configuration');
    }
  };

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
      rag_doc_filter_relevance: 2.0,
      host: '0.0.0.0',
      port: 8000,
      required_exts: '',
      disable_inference_enhance: false,
      inference_deep_thought: false,
      enable_hybrid_index: false,
      hybrid_index_max_output_tokens: 1000000
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await axios.post('/rags/add', values);
      setIsModalVisible(false);
      form.resetFields();
      message.success('RAG添加成功');
      onRAGAdded(); // Call the callback to refresh the RAG list
    } catch (error) {
      console.error('Error adding RAG:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`添加RAG失败: ${error.response.data.detail}`);
      } else {
        message.error('添加RAG失败');
      }
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
            {tokenizerPaths.length > 0 ? (
              <AutoComplete
                options={tokenizerPaths}
                placeholder="选择或输入 Tokenizer 路径"
              >
                <Input />
              </AutoComplete>
            ) : (
              <Input placeholder="输入 Tokenizer 路径" />
            )}
          </Form.Item>
          <Form.Item name="doc_dir" label="文档目录" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="rag_doc_filter_relevance" label="文档过滤相关度" initialValue={2.0}>
            <InputNumber min={0} step={0.1} max={10} />
          </Form.Item>
          <Form.Item name="host" label="主机" initialValue="0.0.0.0">
            <Input />
          </Form.Item>
          <Form.Item name="port" label="端口" initialValue={8000}>
            <InputNumber min={1024} max={65535} />
          </Form.Item>
          <Form.Item name="required_exts" label="必需的扩展名" initialValue="">
            <Input placeholder="用逗号分隔，例如: .txt,.pdf" />
          </Form.Item>
          <Form.Item 
            name="disable_inference_enhance" 
            label={
              <span>
                禁用推理增强
                <Tag color="blue" style={{ marginLeft: '8px' }}>Pro</Tag>
              </span>
            } 
            valuePropName="checked" 
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item 
            name="inference_deep_thought" 
            label={
              <span>
                推理深度思考
                <Tag color="blue" style={{ marginLeft: '8px' }}>Pro</Tag>
              </span>
            } 
            valuePropName="checked" 
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item 
            name="enable_hybrid_index" 
            label={
              <span>
                启用混合索引加速                
                <Tooltip title="使用此功能需要先通过 byzerllm storage start 启动一个加速引擎以及创建一个名字为 emb 的向量模型">
                  <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            } 
            valuePropName="checked" 
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item 
            name="hybrid_index_max_output_tokens" 
            label="混合索引最大输出令牌数" 
            initialValue={1000000}
          >
            <InputNumber min={1} max={10000000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CreateRAG;