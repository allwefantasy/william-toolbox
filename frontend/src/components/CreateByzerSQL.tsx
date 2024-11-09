import React, { useState } from 'react';
import { Form, Input, Button, message, Modal, Typography, Space, Select, Progress } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface CreateByzerSQLProps {
  onServiceAdded: () => void;
  visible: boolean;
  onCancel: () => void;
}

const DOWNLOAD_OPTIONS = [
  {
    name: 'MacOS',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-darwin-amd64-3.3.0-2.3.9.tar.gz'
  },
  {
    name: 'Linux',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-linux-amd64-3.3.0-2.3.9.tar.gz'
  },
  {
    name: 'Windows',
    url: 'https://download.byzer.org/byzer-lang/2.3.9/byzer-lang-all-in-one-win-amd64-3.3.0-2.3.9.tar.gz'
  }
];

interface ProgressInfo {
  visible: boolean;
  percent: number;
  status: 'active' | 'exception' | 'success' | 'normal';
  title: string;
  subTitle: string;
}

// 工具函数：格式化文件大小
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 工具函数：格式化时间
const formatTime = (seconds: number): string => {
  if (!seconds || seconds === Infinity) return '计算中...';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}分${remainingSeconds}秒`;
};

// 工具函数：格式化速度
const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatBytes(bytesPerSecond)}/s`;
};

// 处理下载进度更新
const handleProgressUpdate = (data: any, setProgress: Function) => {  
  if (data.type === 'download') {
    setProgress({
      visible: true,
      percent: data.progress,
      status: 'active',
      title: '下载中',
      subTitle: `${formatBytes(data.downloaded_size)} / ${formatBytes(data.total_size)} | 速度: ${formatSpeed(data.speed)} | 剩余时间: ${formatTime(data.estimated_time)}`
    });
  } else if (data.type === 'extract') {
    setProgress({
      visible: true,
      percent: data.progress,
      status: 'active',
      title: '解压中',
      subTitle: `${data.progress}%`
    });
  }
};

// 处理下载完成
const handleDownloadComplete = (setProgress: Function, onServiceAdded: () => void) => {
  setProgress({
    visible: true,
    percent: 100,
    status: 'success',
    title: '完成',
    subTitle: '下载并解压完成'
  });
  setTimeout(() => {
    setProgress(prev => ({ ...prev, visible: false }));
    onServiceAdded();
  }, 1500);
};

// 处理下载错误
const handleDownloadError = (error: string, setProgress: Function) => {
  setProgress({
    visible: true,
    percent: 100,
    status: 'exception',
    title: '错误',
    subTitle: error
  });
};

// 处理确认下载
const handleDownloadConfirm = async (taskId: string, onServiceAdded: () => void, setProgress: Function) => {
  console.log("Starting EventSource connection with taskId:", taskId);
  const eventSource = new EventSource(`/api/download-progress/${taskId}`);
  // Log when connection is opened
  eventSource.onopen = () => {
    console.log("EventSource connection opened");
  };
  
  // Log general errors
  eventSource.onerror = (error) => {
    console.error("EventSource error:", error);
    eventSource.close();
    handleDownloadError('下载过程发生错误', setProgress);
  };

  setProgress({
    visible: true,
    percent: 0,
    status: 'active',
    title: '准备下载',
    subTitle: '正在初始化...'
  });

  eventSource.onmessage = (event) => {
    console.log("Received SSE event:", event);
    console.log(event.data);
    const data = JSON.parse(event.data);
    
    if (data.completed) {
      eventSource.close();
      handleDownloadComplete(setProgress, onServiceAdded);
      return;
    }
    
    if (data.error) {
      eventSource.close();
      handleDownloadError(data.error, setProgress);
      return;
    }
    
      handleProgressUpdate(data, setProgress);
  };

  eventSource.onerror = () => {
    eventSource.close();
    handleDownloadError('下载过程发生错误', isMessageVisible);
  };
};

// 处理取消下载
const handleDownloadCancel = (taskId: string) => {
  message.info({
    content: '下载已取消',
    key: 'downloadProgress'
  });
};

const CreateByzerSQL: React.FC<CreateByzerSQLProps> = ({ onServiceAdded, visible, onCancel }) => {
  const [form] = Form.useForm();
  const [progress, setProgress] = useState<ProgressInfo>({
    visible: false,
    percent: 0,
    status: 'normal',
    title: '',
    subTitle: ''
  });

  const handleSubmit = async (values: any) => {
    try {
      const response = await axios.post('/byzer-sql/add', values);

      if (!values.install_dir.includes('bin')) {
        Modal.confirm({
          title: '选择下载版本',
          content: (
            <Select
              style={{ width: '100%' }}
              placeholder="选择适合您操作系统的版本"
              onChange={async (value) => {
                try {
                  // 创建下载请求并获取 taskId
                  const downloadResponse = await axios.post('/byzer-sql/download', {
                    download_url: value,
                    install_dir: values.install_dir                    
                  });
                  const taskId = downloadResponse.data.task_id;

                  // 确认下载对话框
                  Modal.confirm({
                    title: '确认下载',
                    content: '这可能需要几分钟时间，请耐心等待',
                    onOk: () => handleDownloadConfirm(taskId, onServiceAdded, setProgress),
                    cancelText: '取消下载',
                    onCancel: () => handleDownloadCancel(taskId),
                  });
                } catch (error) {
                  message.destroy();
                  console.error('Error downloading Byzer SQL:', error);
                  if (axios.isAxiosError(error) && error.response) {
                    message.error(`下载失败: ${error.response.data.detail}`);
                  } else {
                    message.error('下载失败');
                  }
                }
              }}
            >
              {DOWNLOAD_OPTIONS.map(option => (
                <Select.Option key={option.url} value={option.url}>
                  {option.name}
                </Select.Option>
              ))}
            </Select>
          ),
          okText: '关闭',
          cancelText: null
        });
      }

      message.success('Byzer SQL添加成功');
      form.resetFields();
      onServiceAdded();
    } catch (error) {
      console.error('Error adding Byzer SQL:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`添加失败: ${error.response.data.detail}`);
      } else {
        message.error('添加失败');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          添加 Byzer SQL
        </Space>
      }
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <>
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

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
        <Form.Item
          name="name"
          label="服务名称"
          rules={[{ required: true, message: '请输入服务名称' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="install_dir"
          label="安装目录"
          rules={[{ required: true, message: '请输入安装目录' }]}
          help="如果目录不包含bin/byzer.sh，系统将提示您下载"
        >
          <Input />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form.Item>
      </Form>
      </>
    </Modal>
  );
};

export default CreateByzerSQL;