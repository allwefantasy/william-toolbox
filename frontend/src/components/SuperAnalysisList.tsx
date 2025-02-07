import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import CreateSuperAnalysis from './CreateSuperAnalysis';
import EditSuperAnalysis from './EditSuperAnalysis';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, ThunderboltOutlined, FileOutlined, EditOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { confirm } = Modal;

interface SuperAnalysis {
  name: string;
  status: 'stopped' | 'running';
  served_model_name: string;
  port: number;
  schema_rag_base_url: string;
  context_rag_base_url: string;
  byzer_sql_url: string;
  host: string;
  process_id?: number;
  is_alive?: boolean;
}

interface SuperAnalysisListProps {
  refreshTrigger: number;
}

const SuperAnalysisList: React.FC<SuperAnalysisListProps> = ({ refreshTrigger }) => {
  const [analyses, setAnalyses] = useState<SuperAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<SuperAnalysis | null>(null);
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
  const [startingAnalyses, setStartingAnalyses] = useState<{ [key: string]: boolean }>({});
  const logContentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetchAnalyses();
  }, [refreshTrigger]);

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/super-analysis');
      setAnalyses(response.data);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      message.error('获取Super Analysis列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showLogModal = async (analysisName: string, logType: string) => {
    setLogModal({
      visible: true,
      content: '',
      title: `${analysisName} ${logType === 'out' ? 'Standard Output' : 'Standard Error'}`,
    });

    const fetchLogs = async () => {
      try {
        const response = await axios.get(`/super-analysis/${analysisName}/logs/${logType}/-100000`);
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

    await fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    setLogPolling(interval);
  };

  const handleCloseLogModal = () => {
    if (logPolling) {
      clearInterval(logPolling);
      setLogPolling(null);
    }
    setLogModal(prev => ({ ...prev, visible: false }));
  };

  const scrollToBottom = () => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (logModal.visible) {
      scrollToBottom();
    }
  }, [logModal.content]);

  const handleAction = async (analysisName: string, action: 'start' | 'stop' | 'delete') => {
    try {
      if (action === 'delete') {
        const response = await axios.delete(`/super-analysis/${analysisName}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchAnalyses();
        }
      } else {
        if (action === 'start') {
          setStartingAnalyses(prev => ({ ...prev, [analysisName]: true }));
          message.loading('正在检测服务是否可以服务,请耐心等待(最多持续45秒)...', 0);
        }

        const response = await axios.post(`/super-analysis/${analysisName}/${action}`);
        if (response.data.message) {
          message.success(response.data.message);

          if (action === 'start') {
            const startTime = Date.now();
            const timeout = 45000; // 45 seconds
            const pollInterval = 1000; // 每秒轮询一次
            let found = false;

            try {
              while (Date.now() - startTime < timeout) {
                const [errResponse, outResponse] = await Promise.all([
                  axios.get(`/super-analysis/${analysisName}/logs/err/-10000`),
                  axios.get(`/super-analysis/${analysisName}/logs/out/-10000`)
                ]);

                const errContent = errResponse.data.content || '';
                const outContent = outResponse.data.content || '';

                if (errContent.includes('Uvicorn running on') || outContent.includes('Uvicorn running on')) {
                  message.success('服务启动成功');
                  found = true;
                  await fetchAnalyses();
                  break;
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }

              if (!found) {
                showLogModal(analysisName, 'err');
              }
              await fetchAnalyses();
            } finally {
              message.destroy();
              setStartingAnalyses(prev => ({ ...prev, [analysisName]: false }));
            }
          } else {
            await fetchAnalyses();
          }
        }
      }
    } catch (error) {
      if (action === 'start') {
        setStartingAnalyses(prev => ({ ...prev, [analysisName]: false }));
        message.destroy();
      }
      console.error(`Error ${action}ing analysis:`, error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Super Analysis失败: ${error.response.data.detail}`);
      } else {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Super Analysis失败`);
      }
    }
  };

  const refreshStatus = async (analysisName: string) => {
    setRefreshing(prev => ({ ...prev, [analysisName]: true }));
    try {
      const response = await axios.get(`/super-analysis/${analysisName}/status`);
      if (response.data.success) {
        setAnalyses(prevAnalyses =>
          prevAnalyses.map(analysis =>
            analysis.name === analysisName ? { ...analysis, status: response.data.status } : analysis
          )
        );
        message.success(`刷新状态成功: ${response.data.status} (PID: ${response.data.process_id}, 存活: ${response.data.is_alive})`);
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [analysisName]: false }));
    }
  };



  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '服务模型',
      dataIndex: 'served_model_name',
      key: 'served_model_name',
    },
    {
      title: '主机:端口',
      key: 'hostPort',
      render: (_: any, record: SuperAnalysis) => `${record.host}:${record.port}`,
    },
    {
      title: 'Schema RAG URL',
      dataIndex: 'schema_rag_base_url',
      key: 'schema_rag_base_url',
      render: (text: string) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 1 }}>{text}</Paragraph>
        </Tooltip>
      ),
    },
    {
      title: 'Context RAG URL',
      dataIndex: 'context_rag_base_url',
      key: 'context_rag_base_url',
      render: (text: string) => (
        <Tooltip title={text}>
          <Paragraph ellipsis={{ rows: 1 }}>{text}</Paragraph>
        </Tooltip>
      ),
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: SuperAnalysis) => (
        <Space direction="vertical">
          <Tag color={status === 'running' ? 'green' : 'red'}>
            {status === 'running' ? '运行中' : '已停止'}
          </Tag>
          {record.process_id && <span>PID: {record.process_id}</span>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SuperAnalysis) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Space size="small">
            <Button
              type={record.status === 'stopped' ? 'primary' : 'default'}
              icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
              onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
              disabled={record.status === 'stopped' ? startingAnalyses[record.name] : false}
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
          <Space size="small">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                confirm({
                  title: '确认删除',
                  content: '你确定要删除这个Super Analysis服务吗？',
                  onOk: () => handleAction(record.name, 'delete'),
                });
              }}
              disabled={record.status !== 'stopped'}
            >
              删除
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditingAnalysis(record)}
              disabled={record.status === 'running'}
            >
              编辑
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <Title level={2}>
          <Space>
            <ThunderboltOutlined />
            Super Analysis列表
          </Space>
        </Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          style={{ marginBottom: 16 }}
          onClick={() => setShowCreateForm(true)}
        >
          添加Super Analysis
        </Button>
        
  <CreateSuperAnalysis 
    visible={showCreateForm}
    onCancel={() => setShowCreateForm(false)}
    onAnalysisAdded={() => {
      setShowCreateForm(false);
      fetchAnalyses();
    }}
  />

  <EditSuperAnalysis
    visible={!!editingAnalysis}
    onCancel={() => setEditingAnalysis(null)}
    analysis={editingAnalysis as SuperAnalysis}
    onAnalysisUpdated={() => {
      setEditingAnalysis(null);
      fetchAnalyses();
    }}
  />
        <Table
          columns={columns}
          dataSource={analyses}
          rowKey="name"
          loading={loading}
          pagination={false}
          bordered
        />
      </Card>



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
    </>
  );
};

export default SuperAnalysisList;