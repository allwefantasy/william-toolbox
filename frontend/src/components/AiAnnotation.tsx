import React, { useState } from 'react';
import { Upload, Button, message, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/entry.vite';
import './AiAnnotation.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const AiAnnotation: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const onUploadChange = (info: any) => {
    if (info.file.status === 'removed') {
      setFile(null);
      return;
    }
    if (info.file.originFileObj) {
      setFile(info.file.originFileObj);
    }
  };

  return (
    <div className="ai-annotation-container">
      <Row style={{ height: '100%' }}>
        <Col span={16} className="left-doc-display">
          {file ? (
            <Document file={file}>
              <Page pageNumber={1} />
            </Document>
          ) : (
            <div style={{ padding: '20px' }}>请上传 PDF 文件</div>
          )}
        </Col>
        <Col span={8} className="right-annotation-display">
          <div style={{ padding: '20px' }}>
            <Upload 
              onChange={onUploadChange} 
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>上传 PDF 文件</Button>
            </Upload>
            <div style={{ marginTop: '20px' }}>
              {/* 在此处显示针对文档的 AI 批注信息、标记、评论等 */}
              <h3>批注列表</h3>
              <div>暂无批注</div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default AiAnnotation;