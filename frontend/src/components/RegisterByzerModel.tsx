import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, message, Typography, Space } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const { Option } = Select;

interface RegisterByzerModelProps {
  visible: boolean;
  onCancel: () => void;
  serviceName: string;
  host: string;
  port: number;
}

const RegisterByzerModel: React.FC<RegisterByzerModelProps> = ({ 
  visible, 
  onCancel, 
  serviceName,
  host,
  port 
}) => {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchAvailableModels();
    }
  }, [visible]);

  const fetchAvailableModels = async () => {
    try {
      const response = await axios.get('/models');
      const runningModels = response.data
        .filter((model: any) => model.status === 'running')
        .map((model: any) => model.name);
      setAvailableModels(runningModels);
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取可用模型列表失败');
    }
  };

  const handleRegister = async () => {
    if (!selectedModels.length) {
      message.warning('请选择至少一个模型');
      return;
    }

    setLoading(true);
    try {
      for (const modelName of selectedModels) {
        const sql = `!byzerllm setup single;\n\nrun command as LLM.\`\` where\naction="infer"\nand reconnect="true"\nand pretrainedModelType="saas/openai"\nand udfName="${modelName}";`;
        
        await axios.post('/run/script', {
          sql: sql,
          engine_url: `http://${host}:${port}`,
          owner: 'admin'
        });
      }
      message.success('模型注册成功');
      onCancel();
    } catch (error) {
      console.error('Error registering models:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`模型注册失败: ${error.response.data.detail}`);
      } else {
        message.error('模型注册失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          注册模型到 Byzer SQL
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button 
          key="register" 
          type="primary" 
          onClick={handleRegister}
          loading={loading}
        >
          注册
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          注意：目前仅支持 SaaS 类型的模型
        </Typography.Text>
      </div>
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="请选择要注册的模型"
        value={selectedModels}
        onChange={setSelectedModels}
      >
        {availableModels.map(model => (
          <Option key={model} value={model}>{model}</Option>
        ))}
      </Select>
    </Modal>
  );
};

export default RegisterByzerModel;