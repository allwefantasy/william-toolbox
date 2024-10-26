import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message, Switch, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

interface EditRAGProps {
  visible: boolean;
  ragData: any;
  onClose: () => void;
  onUpdate: () => void;
}

const EditRAG: React.FC<EditRAGProps> = ({ visible, ragData, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [models, setModels] = useState<{name: string, status: string}[]>([]);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {    
    if (visible && ragData?.name) {
      fetchRAGDetails(ragData.name);
    }
  }, [visible, ragData?.name]);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/models');
      setModels(response.data.filter((model: {name: string, status: string}) => 
        model.status === 'running'
      ));
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    }
  };

  const fetchRAGDetails = async (ragName: string) => {
    try {
      const response = await axios.get(`/rags/${ragName}`);
      const ragInfo = response.data;
      
      form.setFieldsValue({
        model: ragInfo.model,
        tokenizer_path: ragInfo.tokenizer_path,
        doc_dir: ragInfo.doc_dir,
        rag_doc_filter_relevance: ragInfo.rag_doc_filter_relevance,
        host: ragInfo.host,
        port: ragInfo.port,
        required_exts: ragInfo.required_exts,
        disable_inference_enhance: ragInfo.disable_inference_enhance,
        inference_deep_thought: ragInfo.inference_deep_thought,
        enable_hybrid_index: ragInfo.enable_hybrid_index,
        hybrid_index_max_output_tokens: ragInfo.hybrid_index_max_output_tokens
      });
    } catch (error) {
      console.error('Error fetching RAG details:', error);
      message.error('获取RAG详情失败');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      values.name = ragData.name;
      
      await axios.put(`/rags/${ragData.name}`, values);
      message.success('RAG更新成功');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating RAG:', error);
      message.error('更新RAG失败');
    }
  };

  return (
    <Modal
      title="编辑RAG"
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      width={800}
    >
      <Form form={form} layout="vertical">
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
        <Form.Item name="rag_doc_filter_relevance" label="文档过滤相关度" initialValue={2.0}>
          <InputNumber min={0} step={0.1} max={10} />
        </Form.Item>
        <Form.Item name="host" label="主机" initialValue="0.0.0.0">
          <Input />
        </Form.Item>
        <Form.Item name="port" label="端口" initialValue={8000}>
          <InputNumber min={1024} max={65535} />
        </Form.Item>
        <Form.Item name="required_exts" label="必需的扩展名">
          <Input placeholder="用逗号分隔，例如: .txt,.pdf" />
        </Form.Item>
        <Form.Item 
          name="disable_inference_enhance" 
          label={
            <span>
              禁用推理增强
              <Tooltip title="禁用推理增强可能会影响结果质量">
                <QuestionCircleOutlined style={{ marginLeft: 8 }} />
              </Tooltip>
            </span>
          } 
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          name="inference_deep_thought" 
          label={
            <span>
              推理深度思考
              <Tooltip title="启用深度思考可能会增加响应时间">
                <QuestionCircleOutlined style={{ marginLeft: 8 }} />
              </Tooltip>
            </span>
          } 
          valuePropName="checked"
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
        >
          <Switch />
        </Form.Item>
        <Form.Item 
          name="hybrid_index_max_output_tokens" 
          label="混合索引最大输出令牌数"
        >
          <InputNumber min={1} max={10000000} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditRAG;