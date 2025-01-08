import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Layout, Upload, Button, Typography, List, Avatar, Empty, Spin, Modal, message } from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  MessageOutlined,
  RobotOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import mammoth from 'mammoth';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import './styles.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface Annotation {
  id: string;
  text: string;
  comment: string;
  timestamp: string;
  aiAnalysis?: string;
}

const Annotation: React.FC = () => {
  const [documentContent, setDocumentContent] = useState<string>('');
  const [documentType, setDocumentType] = useState<'docx' | 'pdf' | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const quillRef = useRef<ReactQuill>(null);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const username = sessionStorage.getItem('username') || '';
      const formData = new FormData();
      formData.append('file', file);
      
      // 上传文件
      const uploadResponse = await axios.post('/api/annotations/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'          
        },
        params: {
          username
        }
      });
      
      const fileUuid = uploadResponse.data.uuid;
      
      // 获取文档内容
      const [contentResponse, infoResponse] = await Promise.all([
        axios.get(`/api/annotations/document/${fileUuid}`),
        axios.get(`/api/annotations/document/${fileUuid}/info`)
      ]);
      
      const { full_text, comments } = contentResponse.data;
      const fileInfo = infoResponse.data;
      
      if (fileInfo.original_name.endsWith('.pdf')) {
        setDocumentType('pdf');
        setPdfUrl(`/data/upload/${fileUuid}`);
      } else {
        setDocumentType('docx');
        setDocumentContent(full_text);
        // 将注释转换为 annotations 状态
        const formattedAnnotations = comments.map((comment: any) => ({
          id: comment.id,
          text: comment.text,
          comment: comment.comment,
          timestamp: comment.timestamp,
          aiAnalysis: comment.aiAnalysis
        }));
        setAnnotations(formattedAnnotations);
      }
      
      return false;
    } catch (error) {
      message.error('文件上传或处理失败');
      console.error(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const selectedText = selection.toString();
      setSelectedText(selectedText);
      
      Modal.confirm({
        title: '添加批注',
        content: (
          <ReactQuill
            theme="snow"
            placeholder="请输入批注内容..."
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                ['link'],
                [{ list: 'ordered' }, { list: 'bullet' }],
              ],
            }}
            onChange={(value) => {
              // 更新批注内容
              const newAnnotation: Annotation = {
                id: Date.now().toString(),
                text: selectedText,
                comment: value,
                timestamp: new Date().toISOString(),
              };
              setAnnotations(prev => [...prev, newAnnotation]);
              
              // 保存批注到后端
              const username = sessionStorage.getItem('username') || '';
              axios.post('/api/annotations/save', {
                annotation: newAnnotation,
                username
              }, {
                headers: {
                  'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`
                }
              }).catch(error => {
                console.error('保存批注失败:', error);
                message.error('保存批注失败');
              });
            }}
          />
        ),
        onOk: () => {
          message.success('批注已添加');
        },
      });
    }
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(anno => anno.id !== id));
  };

  return (
    <Layout className="annotation-container">
      <Content className="document-container">
        <div className="document-header">
          <Title level={4}>文档查看器</Title>
          <Upload
            accept=".docx,.pdf"
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <Button icon={<UploadOutlined />}>上传文档</Button>
          </Upload>
        </div>
        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
          </div>
        ) : documentType === 'pdf' ? (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <Viewer
              fileUrl={pdfUrl}
              plugins={[defaultLayoutPluginInstance]}
            />
          </Worker>
        ) : (
          <div
            className="document-content"
            onMouseUp={handleTextSelection}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {documentContent}
          </div>
        )}
      </Content>
      <Sider width={400} className="annotation-sider">
        <div className="annotation-header">
          <Title level={4}>批注列表</Title>
        </div>
        {annotations.length === 0 ? (
          <Empty description="暂无批注" />
        ) : (
          <List
            className="annotation-list"
            itemLayout="vertical"
            dataSource={annotations}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteAnnotation(item.id)}
                  >
                    删除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<MessageOutlined />} />}
                  title={<Text ellipsis>{item.text}</Text>}
                  description={new Date(item.timestamp).toLocaleString()}
                />
                <div className="annotation-content">
                  <ReactQuill
                    value={item.comment}
                    readOnly
                    theme="bubble"
                  />
                </div>
                {item.aiAnalysis && (
                  <div className="ai-analysis">
                    <Avatar icon={<RobotOutlined />} />
                    <Text type="secondary">{item.aiAnalysis}</Text>
                  </div>
                )}
              </List.Item>
            )}
          />
        )}
      </Sider>
    </Layout>
  );
};

export default Annotation;