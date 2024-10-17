import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface RAG {
  name: string;
  status: 'stopped' | 'running';
  model: string;
  tokenizer_path: string;
  doc_dir: string;
  rag_doc_filter_relevance: number;
  process_id?: number;
  is_alive?: boolean;
  host: string;
  port: number;
}

const RAGList: React.FC = () => {
  const [rags, setRAGs] = useState<RAG[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchRAGs();
  }, []);

  const fetchRAGs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/rags');
      setRAGs(response.data);
    } catch (error) {
      console.error('Error fetching RAGs:', error);
      message.error('获取RAG列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (ragName: string, action: 'start' | 'stop') => {
    try {
      const response = await axios.post(`/rags/${ragName}/${action}`);
      if (response.data.message) {
        message.success(response.data.message);
        await fetchRAGs();
      }
    } catch (error) {
      console.error(`Error ${action}ing RAG:`, error);
      message.error(`${action === 'start' ? '启动' : '停止'}RAG失败`);
    }
  };

  const refreshStatus = async (ragName: string) => {
    setRefreshing(prev => ({ ...prev, [ragName]: true }));
    try {
      const response = await axios.get(`/rags/${ragName}/status`);
      if (response.data.success) {
        setRAGs(prevRAGs =>
          prevRAGs.map(rag =>
            rag.name === ragName ? { ...rag, status: response.data.status } : rag
          )
        );
        message.success(`刷新状态成功: ${response.data.status} (PID: ${response.data.process_id}, 存活: ${response.data.is_alive})`);
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [ragName]: false }));
    }
  };

  const columns = [
    {
      title: 'RAG名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Tokenizer路径',
      dataIndex: 'tokenizer_path',
      key: 'tokenizer_path',
    },
    {
      title: '文档目录',
      dataIndex: 'doc_dir',
      key: 'doc_dir',
    },
    {
      title: '文档过滤相关度',
      dataIndex: 'rag_doc_filter_relevance',
      key: 'rag_doc_filter_relevance',
    },
    {
      title: '主机:端口',
      key: 'hostPort',
      render: (_, record: RAG) => `${record.host}:${record.port}`,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
        render: (status: string, record: RAG) => (
          <Space direction="vertical">
            <Tag color={status === 'running' ? 'green' : 'red'}>
              {status === 'running' ? '运行中' : '已停止'}
            </Tag>
            {record.process_id && (
              <Typography.Text type={record.is_alive ? 'success' : 'danger'}>
                PID: {record.process_id} ({record.is_alive ? '存活' : '已终止'})
              </Typography.Text>
            )}
          </Space>
        ),
      },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RAG) => (
        <Space size="middle">
          <Button
            type={record.status === 'stopped' ? 'primary' : 'default'}
            icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
            onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
          >
            {record.status === 'stopped' ? '启动' : '停止'}
          </Button>
          <Button
            icon={<SyncOutlined spin={refreshing[record.name]} />}
            onClick={() => refreshStatus(record.name)}
            disabled={refreshing[record.name]}
          >
            刷新状态
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Title level={2}>
        <Space>
          <DatabaseOutlined />
          RAG列表
        </Space>
      </Title>
      <Table 
        columns={columns} 
        dataSource={rags} 
        rowKey="name" 
        loading={loading}
        pagination={false}
        bordered
      />
    </Card>
  );
};

export default RAGList;