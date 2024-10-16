import React, { useState } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

enum InferBackend {
  Transformers = "transformers",
  VLLM = "ray/vllm",
  LLAMA_CPP = "llama_cpp",
  DeepSpeed = "ray/deepspeed",
  SaaS = "saas/openai"
}

interface InferParam {
  key: string;
  value: string;
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
  infer_params?: InferParam[];
  'saas.base_url'?: string;
  'saas.api_key'?: string;
  'saas.model'?: string;
}

const CreateModel: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [selectedBackend, setSelectedBackend] = useState<InferBackend>(InferBackend.SaaS);

  const showModal = () => {
    setIsModalVisible(true);
    form.setFieldsValue({ 
      pretrained_model_type: 'saas/openai',
      worker_concurrency: 1000,
      infer_backend: InferBackend.SaaS
    });
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

      // Add SaaS specific params if SaaS backend is selected
      if (values.infer_backend === InferBackend.SaaS) {
        if (values['saas.base_url']) infer_params['saas.base_url'] = values['saas.base_url'];
        if (values['saas.api_key']) infer_params['saas.api_key'] = values['saas.api_key'];
        if (values['saas.model']) infer_params['saas.model'] = values['saas.model'];
      }

      // Replace infer_params in values
      values.infer_params = infer_params;

      await axios.post('/models/add', values);
      setIsModalVisible(false);
      form.resetFields();
      message.success('模型添加成功');
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
    setSelectedBackend(value);
    form.setFieldsValue({ infer_params: [] });
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
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模型名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pretrained_model_type" label="预训练模型类型" initialValue="saas/openai" rules={[{ required: true }]}>
            <Input />
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
          {selectedBackend === InferBackend.SaaS && (
            <>
              <Form.Item name="saas.base_url" label="SaaS Base URL" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="saas.api_key" label="SaaS API Key" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="saas.model" label="SaaS Model" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </>
          )}
          {selectedBackend && selectedBackend !== InferBackend.SaaS && (
            <Form.Item name="model_path" label="模型路径">
              <Input />
            </Form.Item>
          )}
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

export default CreateModel;