import React, { useState, useEffect } from 'react';
import { Table, Button, Upload, message, Select, Space, Modal } from 'antd';
import { UploadOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

interface FileItem {
  name: string;
  size: string;
  modified: string;
}

const FileManagement: React.FC = () => {
  const [selectedRAG, setSelectedRAG] = useState<string>('');
  const [ragList, setRagList] = useState<string[]>([]);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRAGList();
  }, []);

  useEffect(() => {
    if (selectedRAG) {
      fetchFiles(selectedRAG);
    }
  }, [selectedRAG]);

  const fetchRAGList = async () => {
    try {
      const username = sessionStorage.getItem('username') || '';
      const userResponse = await axios.get(`/api/users/${username}`);
      const ragPermissions = userResponse.data.rag_permissions || [];
      
      const response = await axios.get('/rags');
      const runningRags = response.data
        .filter((rag: any) => rag.status === 'running' && 
                (ragPermissions.includes('*') || ragPermissions.includes(rag.name)))
        .map((rag: any) => rag.name);
      setRagList(runningRags);
      if (runningRags.length > 0) {
        setSelectedRAG(runningRags[0]);
      }
    } catch (error) {
      message.error('获取RAG列表失败');
    }
  };

  const fetchFiles = async (ragName: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/rags/${ragName}/files`);
      setFileList(response.data);
    } catch (error) {
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`/rags/${selectedRAG}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onSuccess(null, file);
      message.success(`${file.name} 上传成功`);
      fetchFiles(selectedRAG);
    } catch (error) {
      onError(error);
      message.error(`${file.name} 上传失败`);
    }
  };

  const handleDelete = async (fileName: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件 ${fileName} 吗？`,
      onOk: async () => {
        try {
          await axios.delete(`/rags/${selectedRAG}/files/${fileName}`);
          message.success('文件删除成功');
          fetchFiles(selectedRAG);
        } catch (error) {
          message.error('文件删除失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: FileItem) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.name)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '16px' }}>
        <Select
          style={{ width: 200 }}
          value={selectedRAG}
          onChange={(value: string) => setSelectedRAG(value)}
        >
          {ragList.map(rag => (
            <Option key={rag} value={rag}>{rag}</Option>
          ))}
        </Select>
        <Upload
          customRequest={handleUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>上传文件</Button>
        </Upload>
      </Space>

      <Table
        columns={columns}
        dataSource={fileList}
        loading={loading}
        rowKey="name"
      />
    </div>
  );
};

export default FileManagement;