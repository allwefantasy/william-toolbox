import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message, Switch, Tag, Tooltip, AutoComplete } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

interface EditRAGProps {
  visible: boolean;
  ragData: any;
  onClose: () => void;
  onUpdate: () => void;
}

const EditRAG: React.FC<EditRAGProps> = ({ visible, ragData, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [models, setModels] = useState<Array<{ name: string, status: string }>>([]);
  const [tokenizerPaths, setTokenizerPaths] = useState<Array<{value: string, label: string}>>([]);

  useEffect(() => {
    fetchModels();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (visible && ragData) {
      form.setFieldsValue({        
        model: ragData.model,
        recall_model: ragData.recall_model,
        chunk_model: ragData.chunk_model,
        qa_model: ragData.qa_model,
        tokenizer_path: ragData.tokenizer_path,
        doc_dir: ragData.doc_dir,
        rag_doc_filter_relevance: ragData.rag_doc_filter_relevance,
        host: ragData.host,
        port: ragData.port,
        required_exts: ragData.required_exts,
        disable_inference_enhance: ragData.disable_inference_enhance,
        inference_deep_thought: ragData.inference_deep_thought,
        enable_hybrid_index: ragData.enable_hybrid_index,
        hybrid_index_max_output_tokens: ragData.hybrid_index_max_output_tokens,
        without_contexts: ragData.without_contexts,
        product_type: ragData.product_type || 'lite',
        infer_params: ragData.infer_params ? Object.entries(ragData.infer_params).map(([key, value]) => ({
          key,
          value
        })) : []
      });
    }
  }, [visible, ragData, form]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/config');
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
      setModels(response.data.filter((model: { name: string, status: string }) => model.status === 'running'));
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Convert infer_params array to object
      if (values.infer_params) {
        const params: { [key: string]: string } = {};
        values.infer_params.forEach((param: { key: string, value: string }) => {
          params[param.key] = param.value;
        });
        values.infer_params = params;        
      }

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

  // Check if the RAG is running
  const isRagRunning = ragData?.status === 'running';

  return (
    <Modal
      title="编辑RAG"
      visible={visible}
      onOk={handleOk}
      onCancel={onClose}
      okButtonProps={{ disabled: isRagRunning }}
      okText={isRagRunning ? "运行中无法编辑" : "确认"}
    >
      {isRagRunning && (
        <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
          <span style={{ color: '#faad14' }}><strong>提示：</strong>RAG服务正在运行中，请先停止服务后再进行编辑。</span>
        </div>
      )}
      
      <Form form={form} layout="vertical">
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
  );
};

export default EditRAG;