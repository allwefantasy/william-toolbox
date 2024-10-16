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

const CreateModel: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [selectedBackend, setSelectedBackend] = useState<string>('');

  const showModal = () => {
    setIsModalVisible(true);
    form.setFieldsValue({ pretrained_model_type: 'saas/openai' });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (values.infer_backend === InferBackend.SaaS) {
        values.infer_params = {
          'saas.base_url': values['saas.base_url'],
          'saas.api_key': values['saas.api_key'],
          'saas.model': values['saas.model'],
        };
      }
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
    form.setFieldsValue({ infer_params: {} });
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
          <Form.Item name="worker_concurrency" label="Worker 并发数">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="infer_backend" label="推理后端" rules={[{ required: true }]}>
            <Select onChange={handleInferBackendChange}>
              {Object.values(InferBackend).map((backend) => (
                <Option key={backend} value={backend}>{backend}</Option>
              ))}
            </Select>
          </Form.Item>
          {selectedBackend === InferBackend.SaaS ? (
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
          ) : (
            <>
              {selectedBackend && (
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
                        <Input
                          {...restField}
                          style={{ width: '45%', marginLeft: 8 }}
                          placeholder="参数值"
                        />
                        {fields.length > 0 ? (
                          <MinusCircleOutlined
                            className="dynamic-delete-button"
                            onClick={() => remove(name)}
                            style={{ margin: '0 8px' }}
                          />
                        ) : null}
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
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default CreateModel;