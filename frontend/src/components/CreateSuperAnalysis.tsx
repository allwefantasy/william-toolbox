import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, message, Modal, Typography, Space, Select, AutoComplete } from 'antd';
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
  const [byzerSQLInstances, setByzerSQLInstances] = useState<Array<{name: string, host: string, port: number, status: string}>>([]);
  const [schemaRagMode, setSchemaRagMode] = useState<'input' | 'select'>('input');
  const [contextRagMode, setContextRagMode] = useState<'input' | 'select'>('input');
  const [runningModels, setRunningModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch RAGs
        const ragsResponse = await axios.get('/rags');
        setRags(ragsResponse.data.filter((rag: any) => rag.status === 'running'));
        
        // Fetch Models
        const modelsResponse = await axios.get('/models');
        const runningModelsList = modelsResponse.data
          .filter((model: any) => model.status === 'running')
          .map((model: any) => model.name);
        setRunningModels(runningModelsList);

        // Fetch Byzer SQL instances
        const byzerSQLResponse = await axios.get('/byzer-sql');
        setByzerSQLInstances(byzerSQLResponse.data.filter((instance: any) => instance.status === 'running'));
      } catch (error) {
        console.error('Error fetching data:', error);
        message.error('获取数据失败');
      }
    };
    fetchData();
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
          <AutoComplete
            options={runningModels.map(model => ({ value: model }))}
            placeholder="输入或选择模型名称"
            filterOption={(inputValue, option) =>
              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
            }
          />
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
          <AutoComplete
            options={rags.map(rag => {
              const host = rag.host === '0.0.0.0' ? '127.0.0.1' : rag.host;
              return {
                value: `http://${host}:${rag.port}/v1`,
                label: rag.name
              };
            })}
            placeholder="输入或选择Schema RAG URL"
            filterOption={(inputValue, option) =>
              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1 ||
              option!.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
            }
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="context_rag_base_url"
          label="Context RAG URL"
          rules={[{ required: true, message: '请输入Context RAG URL' }]}
        >
          <AutoComplete
            options={rags.map(rag => {
              const host = rag.host === '0.0.0.0' ? '127.0.0.1' : rag.host;
              return {
                value: `http://${host}:${rag.port}/v1`,
                label: rag.name
              };
            })}
            placeholder="输入或选择Context RAG URL"
            filterOption={(inputValue, option) =>
              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1 ||
              option!.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
            }
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="byzer_sql_url"
          label="Byzer SQL URL"
          rules={[{ required: true, message: '请选择或输入Byzer SQL URL' }]}
        >
          <AutoComplete
            options={byzerSQLInstances.map(instance => ({
              value: `http://${instance.host === '0.0.0.0' ? '127.0.0.1' : instance.host}:${instance.port}/run/script`,
              label: `${instance.name} (${instance.host}:${instance.port})`
            }))}
            placeholder="选择或输入 Byzer SQL URL"
            filterOption={(inputValue, option) =>
              option!.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
            }
            style={{ width: '100%' }}
          />
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