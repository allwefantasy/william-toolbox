import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message, Switch, Tag, Tooltip, AutoComplete } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

interface FormValues {
  name: string;
  model: string;
  recall_model?: string;
  chunk_model?: string;
  qa_model?: string;
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
  without_contexts: boolean;
  product_type: string;
  infer_params?: { key: string; value: string }[] | { [key: string]: string };
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

  const showModal = async () => {
    setIsModalVisible(true);
    
    // 获取当前RAG列表以计算最大端口号
    let maxPort = 8000;
    try {
      const response = await axios.get('/rags');
      if (response.data && response.data.length > 0) {
        maxPort = Math.max(...response.data.map((rag: any) => rag.port || 8000)) + 1;
      }
    } catch (error) {
      console.error('Error fetching RAGs:', error);
    }

    form.setFieldsValue({ 
      rag_doc_filter_relevance: 2.0,
      host: '0.0.0.0',
      port: maxPort,
      required_exts: '',
      disable_inference_enhance: true,
      inference_deep_thought: false,
      enable_hybrid_index: false,
      hybrid_index_max_output_tokens: 1000000,
      without_contexts: false,
      product_type: 'lite'
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Convert infer_params array to object
      if (values.infer_params) {
        const params: { [key: string]: string } = {};
        const old_infer_params = values.infer_params as { key: string; value: string }[]
        old_infer_params.forEach((param: { key: string, value: string }) => {
          params[param.key] = param.value;
        });
        values.infer_params = params;        
      }
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
          
          <Form.Item 
            name="product_type" 
            label="配置类型" 
            initialValue="lite"
          >
            <Select>
              <Option value="lite">轻量版 (Lite)</Option>
              <Option value="pro">专业版 (Pro)</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="model" label="主模型" rules={[{ required: true }]}>
            <Select>
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="recall_model"
            label={
              <span>
                召回模型
                <Tooltip title="用于文档检索的模型">
                  <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
          >
            <Select allowClear placeholder="选择召回模型（可选）">
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="chunk_model"
            label={
              <span>
                抽取模型
                <Tooltip title="用于文本分块的模型">
                  <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
          >
            <Select allowClear placeholder="选择抽取模型（可选）">
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="qa_model"
            label={
              <span>
                回答模型
                <Tooltip title="用于生成最终回答的模型">
                  <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
          >
            <Select allowClear placeholder="选择回答模型（可选）">
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="tokenizer_path" label="Tokenizer路径">
            {tokenizerPaths.length > 0 ? (
              <AutoComplete
                options={tokenizerPaths}
                placeholder="选择或输入 Tokenizer 路径（可选）"
              >
                <Input />
              </AutoComplete>
            ) : (
              <Input placeholder="输入 Tokenizer 路径（可选）" />
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

          <Form.Item 
            name="without_contexts" 
            label={
              <span>
                禁用上下文
              </span>
            } 
            valuePropName="checked" 
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.List name="infer_params">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Form.Item
                    key={key}
                    label={name === 0 ? "额外参数" : ""}
                    required={false}
                    style={{ marginBottom: 8 }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'key']}
                      validateTrigger={['onChange', 'onBlur']}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "请输入参数名称或删除此字段",
                        },
                      ]}
                      noStyle
                    >
                      <Input placeholder="参数名称" style={{ width: '45%' }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      validateTrigger={['onChange', 'onBlur']}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "请输入参数值或删除此字段",
                        },
                      ]}
                      noStyle
                    >
                      <Input style={{ width: '45%', marginLeft: 8 }} placeholder="参数值" />
                    </Form.Item>
                    <MinusCircleOutlined
                      className="dynamic-delete-button"
                      onClick={() => remove(name)}
                      style={{ margin: '0 8px' }}
                    />
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加参数
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default CreateRAG;