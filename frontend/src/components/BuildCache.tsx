import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Button, Space, Descriptions, Alert, Spin, notification } from 'antd';
import { ArrowLeftOutlined, BuildOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Paragraph, Text } = Typography;

interface RAGInfo {
  name: string;
  model: string;
  doc_dir: string;
  required_exts?: string;
  product_type: string;
  enable_hybrid_index: boolean;
  emb_model?: string;
  // 其他可能的属性
}

interface BuildCacheProps {
  ragName: string;
  onReturn: () => void;
}

const BuildCache: React.FC<BuildCacheProps> = ({ ragName, onReturn }) => {
  const [ragInfo, setRagInfo] = useState<RAGInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logPolling, setLogPolling] = useState<NodeJS.Timeout | null>(null);
  const logContentRef = useRef<HTMLPreElement>(null);

  // 获取RAG实例信息
  useEffect(() => {
    const fetchRagInfo = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/rags/${encodeURIComponent(ragName)}`);
        
        // 验证是否为Pro版本且启用了混合索引
        if (!response.data.enable_hybrid_index) {
          setError('此RAG实例不支持构建缓存功能。只有Pro版本且启用了混合索引的实例才能构建缓存。');
        }
        
        setRagInfo(response.data);
      } catch (err) {
        console.error('获取RAG信息失败:', err);
        setError('获取RAG信息失败。请返回重试。');
      } finally {
        setLoading(false);
      }
    };

    fetchRagInfo();
  }, [ragName]);

  // 构建缓存命令
  const buildCache = async () => {
    try {
      setBuilding(true);
      setLogs('');
      
      // 构建请求参数，包含emb_model(如果存在)
      const params: any = {};
      if (ragInfo?.emb_model) {
        params.emb_model = ragInfo.emb_model;
      }
      
      // Update API URL from /rags/{ragName}/build_cache to /rags/cache/build/{ragName}
      const response = await axios.post(
        `/rags/cache/build/${encodeURIComponent(ragName)}`        
      );
      
      if (response.data.success) {
        notification.success({
          message: '缓存构建已开始',
          description: '构建过程可能需要一些时间，请耐心等待。您可以在此页面查看构建日志。',
        });
        
        // 开始轮询日志
        pollBuildLogs();
      }
    } catch (err) {
      console.error('启动缓存构建失败:', err);
      notification.error({
        message: '启动缓存构建失败',
        description: axios.isAxiosError(err) && err.response ? err.response.data.detail : '未知错误',
      });
      setBuilding(false);
    }
  };

  // 轮询构建日志
  const pollBuildLogs = () => {
    // 清除可能存在的之前的轮询
    if (logPolling) {
      clearInterval(logPolling);
    }

    const interval = setInterval(async () => {
      try {
        // Update API URL from /rags/{ragName}/build_cache/logs to /rags/cache/logs/{ragName}
        const response = await axios.get(`/rags/cache/logs/${encodeURIComponent(ragName)}`);
        setLogs(response.data.logs);
        
        // 自动滚动到日志底部
        scrollToBottom();
        
        // 如果构建已完成，停止轮询
        if (response.data.completed) {
          notification.success({
            message: '缓存构建完成',
            description: response.data.success ? '缓存构建成功！' : '缓存构建失败，请查看日志了解详情。',
          });
          clearInterval(logPolling!);
          setLogPolling(null);
          setBuilding(false);
        }
      } catch (err) {
        console.error('获取构建日志失败:', err);
      }
    }, 2000); // 每2秒轮询一次
    
    setLogPolling(interval);
  };

  // 滚动到日志底部
  const scrollToBottom = () => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  };

  // 组件卸载时清除轮询
  useEffect(() => {
    return () => {
      if (logPolling) {
        clearInterval(logPolling);
      }
    };
  }, [logPolling]);

  if (loading) {
    return (
      <Card style={{ margin: '20px', textAlign: 'center' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: '20px' }}>加载RAG实例信息...</Paragraph>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ margin: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onReturn}>
            返回RAG列表
          </Button>
          <Alert type="error" message={error} showIcon />
        </Space>
      </Card>
    );
  }

  return (
    <Card style={{ margin: '20px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onReturn}>
            返回RAG列表
          </Button>
          <Title level={2}>
            <BuildOutlined /> 构建RAG缓存
          </Title>
        </Space>

        <Descriptions title="RAG实例信息" bordered>
          <Descriptions.Item label="名称" span={3}>{ragInfo?.name}</Descriptions.Item>
          <Descriptions.Item label="模型" span={3}>{ragInfo?.model}</Descriptions.Item>
          {ragInfo?.emb_model && (
            <Descriptions.Item label="向量模型" span={3}>{ragInfo.emb_model}</Descriptions.Item>
          )}
          <Descriptions.Item label="文档目录" span={3}>{ragInfo?.doc_dir}</Descriptions.Item>
          <Descriptions.Item label="文件类型" span={3}>{ragInfo?.required_exts || '.md,.rst,.txt'}</Descriptions.Item>
        </Descriptions>

        <Alert 
          type="info" 
          message="构建缓存说明" 
          description={
            <div>
              <Paragraph>
                构建缓存将为RAG服务创建预处理的混合索引，可以显著提高检索效率和结果质量。构建过程可能需要一些时间，
                具体取决于文档数量和复杂度。
              </Paragraph>
              <Paragraph>
                将执行的命令: <Text code>{`auto-coder.rag build_hybrid_index --model ${ragInfo?.model} ${ragInfo?.emb_model ? `--emb_model ${ragInfo.emb_model}` : ''} --doc_dir ${ragInfo?.doc_dir} ${ragInfo?.required_exts ? `--required_exts ${ragInfo.required_exts}` : ''} --enable_hybrid_index`}</Text>
              </Paragraph>
            </div>
          }
          showIcon
        />

        <Button 
          type="primary" 
          icon={building ? <SyncOutlined spin /> : <BuildOutlined />} 
          onClick={buildCache}
          loading={building}
          disabled={building}
          size="large"
          block
        >
          {building ? '正在构建缓存...' : '开始构建缓存'}
        </Button>

        <Card 
          title="构建日志" 
          type="inner" 
          style={{ display: logs || building ? 'block' : 'none' }}
        >
          <pre
            ref={logContentRef}
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              height: '400px',
              overflowY: 'auto',
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.5',
              fontFamily: 'monospace'
            }}
          >
            {logs || '等待构建开始...'}
          </pre>
        </Card>
      </Space>
    </Card>
  );
};

export default BuildCache; 