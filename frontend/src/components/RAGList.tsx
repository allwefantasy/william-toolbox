import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, DatabaseOutlined, FileOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

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
  const [logPolling, setLogPolling] = useState<NodeJS.Timeout | null>(null);
  const [currentLogRequest, setCurrentLogRequest] = useState<{
    ragName: string;
    logType: string;
  } | null>(null);

  const [logOffsets, setLogOffsets] = useState<{ [key: string]: number }>({});
  const logContentRef = useRef<HTMLPreElement>(null);

  const showLogModal = async (ragName: string, logType: string) => {
    setCurrentLogRequest({ ragName, logType });
    setLogModal({
      visible: true,
      content: '',
      title: `${ragName} ${logType === 'out' ? 'Standard Output' : 'Standard Error'}`,
    });
    setLogOffsets({ [`${ragName}-${logType}`]: 0 }); // Reset offset for new log view
    
    // Start polling logs
    if (logPolling) {
      clearInterval(logPolling);
    }
    
    const pollLogs = async () => {
      try {
        const currentOffset = logOffsets[`${ragName}-${logType}`] || 0;
        const response = await axios.get(`/rags/${ragName}/logs/${logType}`, {
          params: { offset: currentOffset }
        });
        
        if (response.data.content) {
          setLogModal(prev => ({
            ...prev,
            content: prev.content + response.data.content,
          }));
          setLogOffsets(prev => ({
            ...prev,
            [`${ragName}-${logType}`]: response.data.offset
          }));
          
          // Scroll to bottom
          if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
          }
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        message.error('Failed to fetch logs');
      }
    };

    await pollLogs(); // Initial fetch
    const interval = setInterval(pollLogs, 1000); // Poll every second
    setLogPolling(interval);
  };

  const handleCloseLogModal = () => {
    if (logPolling) {
      clearInterval(logPolling);
      setLogPolling(null);
    }
    setCurrentLogRequest(null);
    setLogModal(prev => ({ ...prev, visible: false }));
  };

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

  const handleAction = async (ragName: string, action: 'start' | 'stop') => {
    try {
      const response = await axios.post(`/rags/${ragName}/${action}`);
      if (response.data.message) {
        message.success(response.data.message);
        await fetchRAGs();
      }
    } catch (error) {
      console.error(`Error ${action}ing RAG:`, error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`${action === 'start' ? '启动' : '停止'}RAG失败: ${error.response.data.detail}`);
      } else {
        message.error(`${action === 'start' ? '启动' : '停止'}RAG失败`);
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
            overflowY: 'auto'
          }}
        >
          {logModal.content || 'No logs available'}
        </pre>
      </Modal>
    </Card>
  );
};

export default RAGList;
