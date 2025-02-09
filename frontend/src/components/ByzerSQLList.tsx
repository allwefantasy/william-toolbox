import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Tooltip, Modal, Progress, Form, Input } from 'antd';
import RegisterByzerModel from './RegisterByzerModel';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { ProgressInfo} from './CreateByzerSQL';
import EditByzerSQL from './EditByzerSQL';
import RunByzerSQL from './RunByzerSQL';
import CreateByzerSQL from './CreateByzerSQL';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, ThunderboltOutlined, FileOutlined, EditOutlined, ExclamationCircleOutlined, DeleteOutlined, CodeOutlined, RobotOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { confirm } = Modal;

interface ByzerSQL {
  name: string;
  status: 'stopped' | 'running';
  install_dir: string;
  process_id?: number;
  is_alive?: boolean;
  host: string;
  port: number;
}

interface ByzerSQLListProps {
  refreshTrigger: number;
}

const ByzerSQLList: React.FC<ByzerSQLListProps> = ({ refreshTrigger }) => {
  const [services, setServices] = useState<ByzerSQL[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<ByzerSQL | null>(null);
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
  const [operationStatus, setOperationStatus] = useState<{ [key: string]: 'starting' | 'stopping' | null }>({});
  const [configModal, setConfigModal] = useState<{
    visible: boolean;
    service: string | null;
  }>({
    visible: false,
    service: null,
  });
  const [configForm] = Form.useForm();
  const [testServiceName, setTestServiceName] = useState<string | null>(null);
  const [registerModelService, setRegisterModelService] = useState<ByzerSQL | null>(null);
  const [progress, setProgress] = useState<ProgressInfo>({
    visible: false,
    percent: 0,
    status: 'normal',
    title: '',
    subTitle: ''
  });
  const logContentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetchServices();
  }, [refreshTrigger]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/byzer-sql');
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      message.error('获取Byzer SQL列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showLogModal = async (serviceName: string, logType: string) => {
    setLogModal({
      visible: true,
      content: '',
      title: `${serviceName} ${logType === 'byzer' ? 'Byzer Engine Log' : 'Shell Error Log'}`,
    });

    const fetchLogs = async () => {
      try {
        const response = await axios.get(`/byzer-sql/${serviceName}/logs/${logType}/-10000`);
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

  const showConfigModal = async (serviceName: string) => {
    try {
      const response = await axios.get(`/byzer-sql/${serviceName}/config`);
      const config = response.data.config;
      const configList = Object.entries(config).map(([key, value]) => ({ key, value }));
      configForm.setFieldsValue({ configs: configList });
      setConfigModal({ visible: true, service: serviceName });
    } catch (error) {
      console.error('Error fetching config:', error);
      message.error('获取配置失败');
    }
  };

  const handleUpdateConfig = async (values: any) => {
    if (!configModal.service) return;

    try {
      const config = values.configs.reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      await axios.put(`/byzer-sql/${configModal.service}/config`, config);
      message.success('配置更新成功');
      setConfigModal({ visible: false, service: null });
    } catch (error) {
      console.error('Error updating config:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`更新失败: ${error.response.data.detail}`);
      } else {
        message.error('更新失败');
      }
    }
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

  const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'delete') => {
    try {
      if (action === 'delete') {
        const response = await axios.delete(`/byzer-sql/${serviceName}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchServices();
        }
      } else {
        setOperationStatus(prev => ({ ...prev, [serviceName]: action === 'start' ? 'starting' : 'stopping' }));

        const response = await axios.post(`/byzer-sql/${serviceName}/${action}`);
        if (response.data.message) {
          message.success(response.data.message);
          await fetchServices();
          // 立即获取最新状态
          await refreshStatus(serviceName);
          // Reset operation status after successful operation
          setOperationStatus(prev => ({ ...prev, [serviceName]: null }));
        }
      }
    } catch (error) {
      setOperationStatus(prev => ({ ...prev, [serviceName]: null }));
      console.error(`Error ${action}ing service:`, error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Byzer SQL失败: ${error.response.data.detail}`);
      } else {
        message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '删除'}Byzer SQL失败`);
      }
    } finally {
      // Ensure operation status is reset even if fetchServices fails
      setOperationStatus(prev => ({ ...prev, [serviceName]: null }));
    }
  };

  const refreshStatus = async (serviceName: string) => {
    setRefreshing(prev => ({ ...prev, [serviceName]: true }));
    try {
      const response = await axios.get(`/byzer-sql/${serviceName}/status`);
      if (response.data.success) {
        setServices(prevServices =>
          prevServices.map(service =>
            service.name === serviceName ? { ...service, status: response.data.status } : service
          )
        );
        message.success(`刷新状态成功: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [serviceName]: false }));
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
      title: '安装目录',
      dataIndex: 'install_dir',
      key: 'install_dir',
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
      render: (status: string, record: ByzerSQL) => (
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
      render: (_: any, record: ByzerSQL) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Space size="small">
            <Button
              type={record.status === 'stopped' ? 'primary' : 'default'}
              icon={record.status === 'stopped' ? <PoweroffOutlined /> : <PauseCircleOutlined />}
              onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
              loading={operationStatus[record.name] === 'starting' || operationStatus[record.name] === 'stopping'}
              disabled={!!operationStatus[record.name] || 
                (record.status === 'stopped' && operationStatus[record.name] === 'starting') || 
                (record.status === 'running' && operationStatus[record.name] === 'stopping')}
            >
              {record.status === 'stopped' ? '启动' : '停止'}
            </Button>
            <Button
              icon={<SyncOutlined spin={refreshing[record.name]} />}
              onClick={() => refreshStatus(record.name)}
              disabled={refreshing[record.name] || !!operationStatus[record.name]}
            >
              刷新状态
            </Button>
            <Button
              icon={<FileOutlined />}
              onClick={() => showLogModal(record.name, 'byzer')}
            >
              引擎日志
            </Button>
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={() => showLogModal(record.name, 'shell')}
            >
              Shell错误日志
            </Button>
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={() => showLogModal(record.name, 'check-env')}
            >
              环境检查日志
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => showConfigModal(record.name)}
              disabled={record.status === 'running' || !!operationStatus[record.name]}
            >
              编辑配置
            </Button>
          </Space>
          <Space size="small">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                confirm({
                  title: '确认删除',
                  content: '你确定要删除这个Byzer SQL服务吗？',
                  onOk: () => handleAction(record.name, 'delete'),
                });
              }}
              disabled={record.status !== 'stopped' || !!operationStatus[record.name]}
            >
              删除
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditingService(record)}
              disabled={record.status === 'running' || !!operationStatus[record.name]}
            >
              编辑
            </Button>
            <Button
              icon={<CodeOutlined />}
              onClick={() => setTestServiceName(record.name)}
            >
              测试引擎
            </Button>
            <Button
              icon={<RobotOutlined />}
              onClick={() => setRegisterModelService(record)}
            >
              注册模型
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
            Byzer SQL列表
          </Space>
        </Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          style={{ marginBottom: 16 }}
          onClick={() => setShowCreateForm(true)}
        >
          添加Byzer SQL
        </Button>
        
        <CreateByzerSQL 
          visible={showCreateForm}
          onCancel={() => setShowCreateForm(false)}
          onServiceAdded={() => {
            setShowCreateForm(false);
            fetchServices();
          }}
          onProgressChange={setProgress}
        />

      <Modal
        visible={progress.visible}
        title={progress.title}
        footer={null}
        closable={false}
        maskClosable={false}
        width={500}
      >
        <Progress
          percent={progress.percent}
          status={progress.status}
        />
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          {progress.subTitle}
        </div>
      </Modal>

        <EditByzerSQL
          visible={!!editingService}
          onCancel={() => setEditingService(null)}
          service={editingService}
          onServiceUpdated={() => {
            setEditingService(null);
            fetchServices();
          }}
        />
        
        <Table
          columns={columns}
          dataSource={services}
          rowKey="name"
          loading={loading}
          pagination={false}
          bordered
        />
      </Card>

      <Modal
        title={
          <Space>
            <SettingOutlined />
            编辑 Byzer SQL 配置
          </Space>
        }
        visible={configModal.visible}
        onCancel={() => setConfigModal({ visible: false, service: null })}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setConfigModal({ visible: false, service: null })}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => configForm.submit()}>
            保存
          </Button>
        ]}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={handleUpdateConfig}
        >
          <Form.List name="configs">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'key']}
                      rules={[{ required: true, message: '请输入配置项' }]}
                    >
                      <Input placeholder="配置项" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: '请输入配置值' }]}
                    >
                      <Input placeholder="配置值" />
                    </Form.Item>
                    <Button onClick={() => remove(name)} type="link" danger>
                      删除
                    </Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    添加配置项
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

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

      <RunByzerSQL
        visible={!!testServiceName}
        onCancel={() => setTestServiceName(null)}
        serviceName={testServiceName || ''}
      />
      
      <RegisterByzerModel
        visible={!!registerModelService}
        onCancel={() => setRegisterModelService(null)}
        serviceName={registerModelService?.name || ''}
        host={registerModelService?.host || ''}
        port={registerModelService?.port || 0}
      />
    </>
  );
};

export default ByzerSQLList;