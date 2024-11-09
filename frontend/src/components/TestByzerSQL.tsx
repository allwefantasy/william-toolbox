import React, { useState } from 'react';
import { Modal, Input, Button, Table, message, Space } from 'antd';
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

const TestByzerSQL: React.FC<TestByzerSQLProps> = ({ visible, onCancel, serviceName }) => {
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);

  const handleExecute = async () => {
    if (!sql.trim()) {
      message.error('请输入SQL语句');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/run/script', {
        sql: sql,
        owner: 'admin',
        jobType: 'script',
        executeMode: 'query',
        jobName: `test_sql_${Date.now()}`,
        includeSchema: true
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

export default TestByzerSQL;