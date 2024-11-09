import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Table, message, Space, Form } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;

interface TestByzerSQLProps {
  visible: boolean;
  onCancel: () => void;
  serviceName: string;
}

interface SQLResult {
  schema: {
    fields: {
      name: string;
      type: string;
    }[];
  };
  data: any[];
}

const RunByzerSQL: React.FC<TestByzerSQLProps> = ({ visible, onCancel, serviceName }) => {
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      // 当弹窗显示时,尝试获取已保存的引擎地址和用户名
      const savedEngineUrl = localStorage.getItem('byzerEngineUrl') || 'http://localhost:9003';
      const savedOwner = localStorage.getItem('byzerOwner') || 'admin';
      form.setFieldsValue({ 
        engineUrl: savedEngineUrl,
        owner: savedOwner
      });
    }
  }, [visible, form]);

  const handleExecute = async () => {
async function handleExecute() {
    if (!sql.trim()) {
      message.error('请输入SQL语句');
      return;
    }

    const values = await form.validateFields();
    const engineUrl = values.engineUrl;
    const owner = values.owner || 'admin';  // 使用表单中的owner值，如果没有则默认为admin

    // 保存引擎地址和用户名到本地存储
    localStorage.setItem('byzerEngineUrl', engineUrl);
    localStorage.setItem('byzerOwner', owner);

    setLoading(true);
    try {
      const response = await axios.post('/run/script', {
        sql: sql,
        engine_url: engineUrl,
        owner: owner
      });
      if (response.data) {
        setResult(response.data);
      }
    } catch (error) {
      console.error('Error executing SQL:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`执行失败: ${error.response.data.detail || error.message}`);
      } else {
        message.error('执行失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const getColumns = () => {
    if (!result?.schema?.fields) return [];
    return result.schema.fields.map(field => ({
      title: field.name,
      dataIndex: field.name,
      key: field.name,
      render: (text: any) => {
        if (typeof text === 'object') {
          return JSON.stringify(text);
        }
        return text;
      }
    }));
  };

  return (
    <Modal
      title={
        <Space>
          <CodeOutlined />
          测试 Byzer SQL
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button 
          key="execute" 
          type="primary" 
          onClick={handleExecute}
          loading={loading}
        >
          执行
        </Button>
      ]}
    >
      <Form 
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="engineUrl"
          label="Byzer SQL引擎地址"
          rules={[{ required: true, message: '请输入Byzer SQL引擎地址' }]}
        >
          <Input placeholder="例如: http://localhost:9003" />
        </Form.Item>
        <Form.Item
          name="owner"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
          initialValue="admin"
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>
      </Form>

      <div style={{ marginBottom: 16 }}>
        <TextArea
          rows={8}
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="请输入 Byzer SQL 语句..."
        />
      </div>

      {result && (
        <Table
          columns={getColumns()}
          dataSource={result.data}
          scroll={{ x: 'max-content' }}
          pagination={false}
          size="small"
        />
      )}
    </Modal>
  );
};

export default RunByzerSQL;