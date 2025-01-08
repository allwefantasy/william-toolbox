import React, { useState, useRef } from 'react';
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
      if (file.type === 'application/pdf') {
        setDocumentType('pdf');
        setPdfUrl(URL.createObjectURL(file));
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setDocumentType('docx');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocumentContent(result.value);
      } else {
        message.error('仅支持 DOCX 和 PDF 文件格式');
        return false;
      }
      return false;
    } catch (error) {
      message.error('文件处理失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      setSelectedText(selection.toString());
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
          />
        ),
        onOk: async () => {
          // 添加批注逻辑
          const newAnnotation: Annotation = {
            id: Date.now().toString(),
            text: selectedText,
            comment: '',
            timestamp: new Date().toISOString(),
          };
          
          try {
            // 调用 AI 分析接口
            const response = await fetch('/api/analyze-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: selectedText }),
            });
            const aiAnalysis = await response.json();
            newAnnotation.aiAnalysis = aiAnalysis.content;
          } catch (error) {
            console.error('AI 分析失败:', error);
          }

          setAnnotations([...annotations, newAnnotation]);
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
            dangerouslySetInnerHTML={{ __html: documentContent }}
          />
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
import React, { useState } from 'react';
import { Upload, Button, message, Spin, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import './styles.css';

const { Text } = Typography;

const Annotation: React.FC = () => {
  const [fileUuid, setFileUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documentContent, setDocumentContent] = useState<{
    full_text: string;
    comments: any[];
  } | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // 获取当前登录用户名
      const username = sessionStorage.getItem('username') || 'anonymous';
      
      // 调用上传接口
      const uploadResponse = await axios.post('/api/annotations/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: {
          username,
        },
      });

      setFileUuid(uploadResponse.data.uuid);
      message.success('文件上传成功');

      // 获取文档内容
      const contentResponse = await axios.get(`/api/annotations/document/${uploadResponse.data.uuid}`);
      setDocumentContent(contentResponse.data);
    } catch (error) {
      message.error('文件上传失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
    return false; // 阻止默认上传行为
  };

  const renderDocumentContent = () => {
    if (!documentContent) return null;

    return (
      <div style={{ marginTop: 20 }}>
        <h3>文档内容：</h3>
        <div style={{ 
          border: '1px solid #ddd', 
          padding: 16, 
          borderRadius: 4,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <Text>{documentContent.full_text}</Text>
        </div>

        <h3 style={{ marginTop: 20 }}>标注信息：</h3>
        <div style={{ 
          border: '1px solid #ddd', 
          padding: 16, 
          borderRadius: 4,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {documentContent.comments.map((comment, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <Text strong>标注 {index + 1}:</Text>
              <Text style={{ marginLeft: 8 }}>{comment.text}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                (作者: {comment.author}, 时间: {comment.date})
              </Text>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept=".docx"
        >
          <Button icon={<UploadOutlined />}>上传文档</Button>
        </Upload>

        {renderDocumentContent()}
      </Spin>
    </div>
  );
};

export default Annotation;