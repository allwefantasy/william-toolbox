import React, { useState, useEffect, useRef } from 'react';
import EditRAG from './EditRAG';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal, Select, Input, Empty } from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, DatabaseOutlined, FileOutlined, EditOutlined, ExclamationCircleOutlined, DeleteOutlined, SearchOutlined, BuildOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

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
  product_type: string;
  enable_hybrid_index?: boolean;
}

interface RAGListProps {
  refreshTrigger: number;
  onBuildCache?: (ragName: string) => void;
}

const RAGList: React.FC<RAGListProps> = ({ refreshTrigger, onBuildCache }) => {
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentRAG, setCurrentRAG] = useState<RAG | null>(null);
  const [searchText, setSearchText] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');

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

  const [startingRags, setStartingRags] = useState<{ [key: string]: boolean }>({});

  const handleAction = async (ragName: string, action: 'start' | 'stop' | 'delete') => {
    try {
      if (action === 'delete') {
        const response = await axios.delete(`/rags/${ragName}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchRAGs();
        }
      } else {
        if (action === 'start') {
          setStartingRags(prev => ({ ...prev, [ragName]: true }));
          message.loading('正在检测服务是否可以服务,请耐心等待(最多持续45秒)...', 0);
        }

        const response = await axios.post(`/rags/${ragName}/${action}`);
        if (response.data.message) {
          message.success(response.data.message);

          if (action === 'start') {
            const startTime = Date.now();
            const timeout = 45000; // 45 seconds
            const pollInterval = 1000; // 每秒轮询一次
            let found = false;

            try {
              while (Date.now() - startTime < timeout) {
                // 检查err和out日志
                const [errResponse, outResponse] = await Promise.all([
                  axios.get(`/rags/${ragName}/logs/err/-10000`),
                  axios.get(`/rags/${ragName}/logs/out/-10000`)
                ]);

                const errContent = errResponse.data.content || '';
                const outContent = outResponse.data.content || '';

                // 检查是否包含成功运行的标志
                if (errContent.includes('Uvicorn running on') || outContent.includes('Uvicorn running on')) {
                  message.success('服务启动成功');
                  found = true;
                  await fetchRAGs();
                  break;
                }

                // 等待一段时间后再次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }

              if (!found) {
                showLogModal(ragName, 'err');
              }
              await fetchRAGs();              
            } finally {
              // 清除loading消息和启动状态
              message.destroy();
              setStartingRags(prev => ({ ...prev, [ragName]: false }));
            }
          } else {
            await fetchRAGs();
          }
        }
      }
    } catch (error) {
      if (action === 'start') {
        setStartingRags(prev => ({ ...prev, [ragName]: false }));
        message.destroy();
      }
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

  const handleBuildCache = (ragName: string) => {
    if (onBuildCache) {
      onBuildCache(ragName);
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
      title: '配置类型',
      dataIndex: 'product_type',
      key: 'product_type',
      render: (type: string) => (
        <Tag color={type === 'lite' ? 'orange' : 'blue'}>
          {type === 'lite' ? 'Lite' : 'Pro'}
        </Tag>
      ),
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Space size="small">
            <Button
              type={record.status === 'stopped' ? 'primary' : 'default'}
              icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
              onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
              disabled={record.status === 'stopped' ? startingRags[record.name] : false}
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
            {record.product_type === 'pro' && record.enable_hybrid_index && (
              <Button
                icon={<BuildOutlined />}
                onClick={() => handleBuildCache(record.name)}
              >
                构建缓存
              </Button>
            )}
          </Space>
          <Space size="small">
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
              disabled={record.status !== 'stopped'}
            >
              删除
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setCurrentRAG(record);
                setEditModalVisible(true);
              }}
            >
              编辑
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  // 过滤RAG列表 (名称和配置类型)
  const filteredRAGs = rags.filter(rag => {
    const nameMatches = rag.name.toLowerCase().includes(searchText.toLowerCase());
    const typeMatches = productTypeFilter === 'all' || 
                       rag.product_type === productTypeFilter;
    return nameMatches && typeMatches;
  });

  return (
    <>
      <EditRAG
        visible={editModalVisible}
        ragData={currentRAG}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentRAG(null);
        }}
        onUpdate={fetchRAGs}
      />
      <Card>
        <Title level={2}>
          <Space>
            <DatabaseOutlined />
            RAG列表
          </Space>
        </Title>
        
        <div style={{ display: 'flex', marginBottom: 16, gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Search
            placeholder="按RAG名称搜索"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            onSearch={value => setSearchText(value)}
            onChange={e => setSearchText(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <Space>
            <span>配置类型：</span>
            <Select 
              defaultValue="all" 
              style={{ width: 130 }} 
              onChange={value => setProductTypeFilter(value)}
            >
              <Option value="all">全部</Option>
              <Option value="lite">轻量版 (Lite)</Option>
              <Option value="pro">专业版 (Pro)</Option>
            </Select>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredRAGs}
          rowKey="name"
          loading={loading}
          pagination={false}
          bordered
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的RAG服务" />
          }}
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
    </>
  );
};

export default RAGList;
