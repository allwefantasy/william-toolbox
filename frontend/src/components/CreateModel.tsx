import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Checkbox, Select, message, AutoComplete, Tooltip, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

enum InferBackend {
  Transformers = "transformers",
  VLLM = "ray/vllm",
  LLAMA_CPP = "llama_cpp",
  DeepSpeed = "ray/deepspeed",
  SaaS = "saas"
}

interface InferParam {
  key: string;
  value: string;
}

enum ProductType {
  Pro = "pro",
  Lite = "lite"
}

interface FormValues {
  name: string;
  pretrained_model_type: string;
  cpus_per_worker: number;
  gpus_per_worker: number;
  num_workers: number;
  worker_concurrency: number;
  infer_backend: InferBackend;
  model_path?: string;
  infer_params?: InferParam[] | any;
  'saas.base_url'?: string;
  'saas.api_key'?: string;
  'saas.model'?: string;
  product_type: ProductType;
  is_reasoning?: boolean;
  input_price?: number;
  output_price?: number;
}

interface CreateModelProps {
  onModelAdded: () => void;
}

const CreateModel: React.FC<CreateModelProps> = ({ onModelAdded }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [selectedBackend, setSelectedBackend] = useState<InferBackend>(InferBackend.SaaS);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('');
  const [saasBaseUrls, setSaasBaseUrls] = useState<Array<{value: string, label: string}>>([]);
  const [pretrainedModelTypes, setPretrainedModelTypes] = useState<Array<{value: string, label: string}>>([]);
  const [productType, setProductType] = useState<ProductType>(ProductType.Lite);

  useEffect(() => {
    // Fetch configuration when component mounts
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/config');
      setSaasBaseUrls(response.data.saasBaseUrls);
      setPretrainedModelTypes(response.data.pretrainedModelTypes);
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('Failed to fetch configuration');
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
    form.setFieldsValue({ 
      pretrained_model_type: 'saas/openai',
      worker_concurrency: 1000,
      infer_backend: InferBackend.SaaS,
      product_type: ProductType.Lite
    });
    setProductType(ProductType.Lite);
  };

  const handlePretrainedModelTypeChange = (value: string) => {
    form.setFieldsValue({ pretrained_model_type: value });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const infer_params: Record<string, string> = {};
      
      // Collect all infer_params
      if (values.infer_params) {
        values.infer_params.forEach((param: InferParam) => {
          infer_params[param.key] = param.value;
        });
      }

      if (values["saas.base_url"]) {
        infer_params["saas.base_url"] = values["saas.base_url"];
      }
      if (values["saas.api_key"]) {
        infer_params["saas.api_key"] = values["saas.api_key"];
      }
      if (values["saas.model"]) {
        infer_params["saas.model"] = values["saas.model"];
      }
  
      // Replace infer_params in values
      values.infer_params = infer_params

      await axios.post('/models/add', values);
      setIsModalVisible(false);
      form.resetFields();
      message.success('模型添加成功');
      onModelAdded(); // Call the callback to refresh the model list
    } catch (error) {
      console.error('Error adding model:', error);
      message.error('添加模型失败');
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleInferBackendChange = (value: string) => {
    setSelectedBackend(value as InferBackend);
    form.setFieldsValue({ infer_params: [] });
  };

  const handleBaseUrlChange = (value: string) => {
    setSelectedBaseUrl(value);
    if (value === 'https://api.deepseek.com/beta') {
      form.setFieldsValue({ 'saas.model': 'deepseek-chat' });
    }
  };

  const handleProductTypeChange = (value: ProductType) => {
    setProductType(value);
    // 如果从Pro切换到Lite，重置一些Pro专有的字段
    if (value === ProductType.Lite) {
      form.setFieldsValue({
        cpus_per_worker: 0.001,
        gpus_per_worker: 0,
        num_workers: 1,
        worker_concurrency: 1000,
        infer_backend: InferBackend.SaaS,
      });
    }
  };

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
        添加模型
      </Button>
      <Modal
        title="添加模型"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模型名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          <Form.Item name="product_type" label="产品模式" initialValue={ProductType.Lite}>
            <Select onChange={(value) => handleProductTypeChange(value as ProductType)}>
              <Option value={ProductType.Pro}>专业版 (Pro)</Option>
              <Option value={ProductType.Lite}>轻量版 (Lite)</Option>
            </Select>
          </Form.Item>

          {productType === ProductType.Pro && (
            <>
              <Divider orientation="left">Pro 专有配置</Divider>
              <Form.Item
                name="pretrained_model_type"
                label={
                  <span>
                    预训练模型类型&nbsp;
                    <Tooltip title="如果你需要部署私有模型，可以选择 custom/模型名称 并且合理配置推理后端以及 GPU 数">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </span>
                }
                initialValue="saas/openai"
                rules={[{ required: true }]}
              >
                <AutoComplete
                  options={pretrainedModelTypes}
                  onChange={handlePretrainedModelTypeChange}
                  placeholder="选择或输入预训练模型类型"
                >
                  <Input />
                </AutoComplete>
              </Form.Item>
              <Form.Item name="cpus_per_worker" label="每个 Worker CPU" initialValue={0.001}>
                <InputNumber min={0} step={0.001} />
              </Form.Item>
              <Form.Item name="gpus_per_worker" label="每个 Worker GPU" initialValue={0}>
                <InputNumber min={0} />
              </Form.Item>
              <Form.Item name="num_workers" label="Worker 数量" initialValue={1}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="worker_concurrency" label="Worker 并发数" initialValue={1000}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="infer_backend" label="推理后端" initialValue={InferBackend.SaaS} rules={[{ required: true }]}>
                <Select onChange={handleInferBackendChange}>
                  {Object.values(InferBackend).map((backend) => (
                    <Option key={backend} value={backend}>{backend}</Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedBackend && selectedBackend !== InferBackend.SaaS && (
                <Form.Item name="model_path" label="模型路径">
                  <Input />
                </Form.Item>
              )}
            </>
          )}

          <Divider orientation="left">通用配置</Divider>
          
          {/* SaaS配置部分对两种模式都显示 */}
          <Form.Item name="saas.base_url" label="SaaS Base URL">
            <AutoComplete
              options={saasBaseUrls}
              onChange={handleBaseUrlChange}
              placeholder="选择或输入 Base URL"
            >
              <Input />
            </AutoComplete>
          </Form.Item>
          <Form.Item name="saas.api_key" label="SaaS API Key" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="saas.model" label="SaaS Model" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          <Form.Item name="is_reasoning" label="是否为推理模型" valuePropName="checked">
            <Checkbox />
          </Form.Item>
          <Form.Item name="input_price" label="输入价格 (元/百万token)">
            <InputNumber min={0} precision={4} />
          </Form.Item>
          <Form.Item name="output_price" label="输出价格 (元/百万token)">
            <InputNumber min={0} precision={4} />
          </Form.Item>
          
          {productType === ProductType.Pro && (
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
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default CreateModel;