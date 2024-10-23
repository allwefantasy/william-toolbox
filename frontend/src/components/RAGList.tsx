import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal, Select } from 'antd';
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
  // State for managing log auto-scrolling
  const [autoScroll, setAutoScroll] = useState(true);
  const [logPolling, setLogPolling] = useState<NodeJS.Timeout | null>(null);
  const [pollingInterval, setPollingInterval] = useState(3000); // 默认3秒
  const [maxLogSize, setMaxLogSize] = useState(100000); // 默认最大日志大小(字符)
  const [currentLogRequest, setCurrentLogRequest] = useState<{
    ragName: string;
    logType: string;
  } | null>(null);

  const [logOffsets, setLogOffsets] = useState<{ [key: string]: number }>({});
  const logContentRef = useRef<HTMLPreElement>(null);
  
  // 动态调整轮询间隔
  const adjustPollingInterval = (contentLength: number) => {
    // 根据内容长度动态调整轮询间隔
    if (contentLength > 50000) {
      return 5000; // 内容较大时降低频率
    } else if (contentLength > 10000) {
      return 3000;
    }
    return 1000; // 内容较小时提高频率
  };

  const showLogModal = async (ragName: string, logType: string) => {
    setAutoScroll(true);
    setCurrentLogRequest({ ragName, logType });
    setLogModal({
      visible: true,
      content: '',
      title: `${ragName} ${logType === 'out' ? 'Standard Output' : 'Standard Error'}`,
    });
    
    try {
      const initialResponse = await axios.get(`/rags/${ragName}/logs/${logType}/-1`);
      const initialOffset = initialResponse.data.offset || 0;
      setLogOffsets({ [`${ragName}-${logType}`]: initialOffset });
    } catch (error) {
      console.error('Error getting initial offset:', error);
      setLogOffsets({ [`${ragName}-${logType}`]: 0 });
    }

    if (logPolling) {
      clearInterval(logPolling);
    }
    
    const pollLogs = async () => {
      // if (!currentLogRequest) return;
      
      try {
        console.log(`currentLogRequest: ${currentLogRequest?.ragName} ${currentLogRequest?.logType} maxLogSize: ${maxLogSize} logOffsets: ${logOffsets}`);
        const currentOffset = logOffsets[`${ragName}-${logType}`] || 0;
        const response = await axios.get(`/rags/${ragName}/logs/${logType}/${currentOffset}`);        
        
        if (response.data.content) {
          setLogModal(prev => {
            let newContent = prev.content + response.data.content;
            // 限制日志大小
            if (newContent.length > maxLogSize) {
              newContent = newContent.slice(-maxLogSize);
            }
            return {
              ...prev,
              content: newContent
            };
          });
          
          setLogOffsets(prev => ({
            ...prev,
            [`${ragName}-${logType}`]: response.data.offset
          }));

          // 根据内容长度调整轮询间隔
          const newInterval = adjustPollingInterval(response.data.content.length);
          if (newInterval !== pollingInterval) {
            setPollingInterval(newInterval);
            // 重启轮询
            if (logPolling) {
              clearInterval(logPolling);
              const newPoll = setInterval(pollLogs, newInterval);
              setLogPolling(newPoll);
            }
          }
          
          // 仅在autoScroll为true时滚动到底部
          if (autoScroll && logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
          }
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        message.error('Failed to fetch logs');
      }
    };

    await pollLogs(); // Initial fetch
    const interval = setInterval(pollLogs, pollingInterval);
    setLogPolling(interval);
  };

  // 监听滚动事件来控制自动滚动
  const handleScroll = () => {
    if (logContentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContentRef.current;
      // 如果用户向上滚动,禁用自动滚动
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 30);
    }
  };

  const handleCloseLogModal = () => {
    if (logPolling) {
      clearInterval(logPolling);
      setLogPolling(null);
    }
    setCurrentLogRequest(null);
    setLogModal(prev => ({ ...prev, visible: false }));
  };

  const clearLogs = () => {
    setLogModal(prev => ({
      ...prev,
      content: ''
    }));
    // 重置 offset
    if (currentLogRequest) {
      const { ragName, logType } = currentLogRequest;
      setLogOffsets(prev => ({
        ...prev,
        [`${ragName}-${logType}`]: 0
      }));
    }
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
        footer={[
          <Button key="clear" onClick={clearLogs}>
            清除日志
          </Button>,
          <Button key="autoScroll" onClick={() => setAutoScroll(!autoScroll)}>
            {autoScroll ? '禁用自动滚动' : '启用自动滚动'}
          </Button>
        ]}
        width={800}
        bodyStyle={{ maxHeight: '500px', overflow: 'auto' }}
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            轮询间隔: {pollingInterval}ms
            <Select
              value={maxLogSize}
              style={{ width: 200 }}
              onChange={(value) => setMaxLogSize(value)}
            >
              <Select.Option value={50000}>最大50K字符</Select.Option>
              <Select.Option value={100000}>最大100K字符</Select.Option>
              <Select.Option value={500000}>最大500K字符</Select.Option>
            </Select>
          </Space>
        </div>
        <pre 
          ref={logContentRef}
          onScroll={handleScroll}
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
