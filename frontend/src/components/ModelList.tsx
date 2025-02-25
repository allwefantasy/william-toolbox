import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, message, Card, Typography, Space, Tag, Modal} from 'antd';
import { PoweroffOutlined, PauseCircleOutlined, SyncOutlined, RocketOutlined, RedoOutlined, EditOutlined } from '@ant-design/icons';
import EditModel from './EditModel';

const { Title } = Typography;

interface Model {
  name: string;
  status: 'stopped' | 'running';
  deploy_command?: any;
  product_type?: 'lite' | 'pro';
}

interface ModelListProps {
  refreshTrigger: number;
}

const ModelList: React.FC<ModelListProps> = ({ refreshTrigger }) => {
  const handleDelete = async (modelName: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '你确定要删除这个模型吗？',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        try {
          await axios.delete(`/models/${modelName}`);
          message.success('模型删除成功');
          fetchModels();
        } catch (error) {
          console.error('Error deleting model:', error);
          message.error('删除模型失败');
        }
      },
    });
  };

  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [countdowns, setCountdowns] = useState<{ [key: string]: number | undefined }>({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);

  useEffect(() => {
    fetchModels();
  }, [refreshTrigger]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (modelName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(prev => ({ ...prev, [modelName]: true }));
    setCountdowns(prev => ({ ...prev, [modelName]: 60 }));
    
    const countdownInterval = setInterval(() => {
      setCountdowns(prev => {
        const currentCountdown = prev[modelName];
        if (currentCountdown === undefined) return prev;
        const newCountdown = currentCountdown - 1;
        return newCountdown <= 0
          ? { ...prev, [modelName]: undefined }
          : { ...prev, [modelName]: newCountdown };
      });
    }, 1000);

    try {
      if (action === 'restart') {
        await axios.post(`/models/${modelName}/stop`);
        await axios.post(`/models/${modelName}/start`);
      } else {
        await axios.post(`/models/${modelName}/${action}`);
      }
      await fetchModels();
      message.success(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}模型成功`);
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
      message.error(`${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}模型失败`);
    } finally {
      setActionLoading(prev => ({ ...prev, [modelName]: false }));
      clearInterval(countdownInterval);
      setCountdowns(prev => ({ ...prev, [modelName]: undefined }));
    }
  };

  const refreshStatus = async (modelName: string) => {
    setRefreshing(prev => ({ ...prev, [modelName]: true }));
    try {
      const response = await axios.get(`/models/${modelName}/status`);
      const newStatus = response.data.success ? 'running' : 'stopped';
      setModels(prevModels =>
        prevModels.map(model =>
          model.name === modelName ? { ...model, status: newStatus } : model
        )
      );
      message.success(`刷新状态成功: ${newStatus}`);
    } catch (error) {
      console.error('Error refreshing status:', error);
      message.error('刷新状态失败');
    } finally {
      setRefreshing(prev => ({ ...prev, [modelName]: false }));
    }
  };

  const handleEdit = (model: Model) => {
    setCurrentModel(model);
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'running' ? 'green' : 'red'}>
          {status === 'running' ? '运行中' : '已停止'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Model) => {
        // 如果是 lite 模式，只显示编辑和删除按钮
        if (record.product_type === 'lite') {
          return (
            <Space size="middle">
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Button
                type="primary"
                danger
                onClick={() => handleDelete(record.name)}
              >
                删除
              </Button>
            </Space>
          );
        }
        
        // 如果是 pro 模式或未指定，显示完整的操作区
        return (
          <Space size="middle">
            <Button
              type={record.status === 'stopped' ? 'primary' : 'default'}
              icon={record.status === 'stopped' ? <RocketOutlined /> : <PauseCircleOutlined />}
              onClick={() => handleAction(record.name, record.status === 'stopped' ? 'start' : 'stop')}
              loading={actionLoading[record.name]}
              disabled={countdowns[record.name] !== undefined}
            >
              {record.status === 'stopped' ? '启动' : '停止'}
              {countdowns[record.name] !== undefined && ` (${countdowns[record.name]}s)`}
            </Button>
            <Button
              icon={<RedoOutlined />}
              onClick={() => handleAction(record.name, 'restart')}
              loading={actionLoading[record.name]}
              disabled={countdowns[record.name] !== undefined}
            >
              重启
              {countdowns[record.name] !== undefined && ` (${countdowns[record.name]}s)`}
            </Button>
            <Button
              icon={<SyncOutlined spin={refreshing[record.name]} />}
              onClick={() => refreshStatus(record.name)}
              disabled={refreshing[record.name]}
            >
              刷新状态
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.status === 'running'}
            >
              编辑
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => handleDelete(record.name)}
              disabled={record.status === 'running'}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <EditModel
        visible={editModalVisible}
        modelData={currentModel}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentModel(null);
        }}
        onUpdate={() => {
          fetchModels();
        }}
      />
      <Card>
      <Title level={2}>
        <Space>
          <RocketOutlined />
          模型列表
        </Space>
      </Title>
      <Table 
        columns={columns} 
        dataSource={models} 
        rowKey="name" 
        loading={loading}
        pagination={false}
        bordered
      />
    </Card>
    </>
  );
};

export default ModelList;
