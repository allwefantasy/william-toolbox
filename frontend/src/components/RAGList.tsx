import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal, Select } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, DatabaseOutlined, FileOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

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

interface RAGListProps {
  refreshTrigger: number;
}

const RAGList: React.FC<RAGListProps> = ({ refreshTrigger }) => {
  const [rags, setRAGs] = useState<RAG[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [logModal, setLogModal] = useState<{
    visible: boolean;
    content: string;
    title: string;
  }>({
    visible: false,
    content: '',
    title: '',
  });
  // State for managing log auto-scrolling
  
  const [logPolling, setLogPolling] = useState<NodeJS.Timeout | null>(null);
    
  const showLogModal = async (ragName: string, logType: string) => {
    setLogModal({
      visible: true,
      content: '',
      title: `${ragName} ${logType === 'out' ? 'Standard Output' : 'Standard Error'}`,
    });

    const fetchLogs = async () => {
      try {
        // 直接请求最新的10000个字符
        const response = await axios.get(`/rags/${ragName}/logs/${logType}/-10000`);
        if (response.data.content) {
          setLogModal(prev => ({
            ...prev,
            content: response.data.content
          }));
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        message.error('Failed to fetch logs');
      }
    };

    // 立即获取一次日志
    await fetchLogs();
    
    // 每3秒轮询一次
    const interval = setInterval(fetchLogs, 3000);
    setLogPolling(interval);
  };

  // 监听滚动事件来控制自动滚动
  // Create a ref for the log content container
const logContentRef = useRef<HTMLPreElement>(null);

const handleCloseLogModal = () => {
    if (logPolling) {
      clearInterval(logPolling);
      setLogPolling(null);
    }
    setLogModal(prev => ({ ...prev, visible: false }));
  };

// Function to scroll to bottom
const scrollToBottom = () => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
};

// Update useEffect to scroll when content changes
useEffect(() => {
    if (logModal.visible) {
      scrollToBottom();
    }
}, [logModal.content]);

  useEffect(() => {
    fetchRAGs();
  }, [refreshTrigger]);

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

  const handleAction = async (ragName: string, action: 'start' | 'stop' | 'delete') => {
    try {
      if (action === 'delete') {
        const response = await axios.delete(`/rags/${ragName}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchRAGs();
        }
      } else {
        const response = await axios.post(`/rags/${ragName}/${action}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchRAGs();
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing RAG:`, error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}RAG失败: ${error.response.data.detail}`);
      } else {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}RAG失败`);
      }
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
      render: (text: string) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }} style={{ maxWidth: 200 }}>
            {text}
          </Paragraph>
        </Tooltip>
      ),
    },
    {
      title: '文档目录',
      dataIndex: 'doc_dir',
      key: 'doc_dir',
      render: (text: string) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }} style={{ maxWidth: 200 }}>
            {text}
          </Paragraph>
        </Tooltip>
      ),
    },
    {
      title: '文档过滤相关度',
      dataIndex: 'rag_doc_filter_relevance',
      key: 'rag_doc_filter_relevance',
    },
    {
      title: '主机:端口',
      key: 'hostPort',
      render: (_: any, record: RAG) => `${record.host}:${record.port}`,
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
            PID: {record.process_id}
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
          <Button
            icon={<FileOutlined />}
            onClick={() => showLogModal(record.name, 'out')}
          >
            标准输出
          </Button>
          <Button
            icon={<ExclamationCircleOutlined />}
            onClick={() => showLogModal(record.name, 'err')}
          >
            标准错误
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: '你确定要删除这个RAG服务吗？',
                okText: '确认',
                cancelText: '取消',
                onOk: () => handleAction(record.name, 'delete')
              });
            }}
            disabled={record.status === 'running'}
          >
            删除
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
      <Modal
        title={logModal.title}
        visible={logModal.visible}
        onCancel={handleCloseLogModal}
        footer={null}
        width={800}
        bodyStyle={{ maxHeight: '500px', overflow: 'auto' }}
      >
        <pre 
          ref={logContentRef}
          style={{ 
            whiteSpace: 'pre-wrap', 
            wordWrap: 'break-word',
            maxHeight: '450px',
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'monospace'
          }}
        >
          {logModal.content || 'No logs available'}
        </pre>
      </Modal>
    </Card>
  );
};

export default RAGList;
