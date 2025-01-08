import React, { useState } from 'react';
import { Upload, Button, List, Card, Layout, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Document, Page } from 'react-pdf';
import './AnnotationView.css';

const { Content, Sider } = Layout;

const AnnotationView = () => {
  const [file, setFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [numPages, setNumPages] = useState<number | null>(null);

  const handleUpload = (file: File) => {
    setFile(file);
    // TODO: Call API to process file and get annotations
    setAnnotations([
      {
        id: 1,
        content: 'This is an example annotation',
        page: 1,
        position: { x: 100, y: 200 },
        timestamp: new Date().toISOString()
      }
    ]);
    return false;
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <Layout className="annotation-container">
      <Content className="document-viewer">
        {file ? (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={800}
              />
            ))}
          </Document>
        ) : (
          <div className="upload-area">
            <Upload
              beforeUpload={handleUpload}
              accept=".pdf,.doc,.docx"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} size="large">
                上传文档
              </Button>
            </Upload>
          </div>
        )}
      </Content>
      
      <Sider width={400} className="annotation-sidebar">
        <Card title="批注" bordered={false}>
          <List
            dataSource={annotations}
            renderItem={(item) => (
              <List.Item>
                <Card size="small">
                  <p>{item.content}</p>
                  <div className="annotation-meta">
                    <span>Page {item.page}</span>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      </Sider>
    </Layout>
  );
};

export default AnnotationView;