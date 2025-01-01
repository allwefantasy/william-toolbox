import React from 'react';
import { Modal, Typography, Select, Table } from 'antd';

interface ChatCsvPreviewProps {
  visible: boolean;
  onOk: () => void;
  onCancel: () => void;
  csvData: any[];
  csvMeta: any;
  selectedColumns: string[];
  setSelectedColumns: (columns: string[]) => void;
}

const ChatCsvPreview: React.FC<ChatCsvPreviewProps> = ({
  visible,
  onOk,
  onCancel,
  csvData,
  csvMeta,
  selectedColumns,
  setSelectedColumns
}) => {
  const columns = csvMeta?.fields?.map((field: string) => ({
    title: field,
    dataIndex: field,
    key: field,
  })) || [];

  return (
    <Modal
      title="请筛选列以减少数据量（500个cell以内）"
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      width={1200}
    >
      <div>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>请选择要包含的列：</Typography.Text>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <Table
            dataSource={csvData.map((row, index) => ({
              ...row,
              key: index,
            }))}
            columns={columns.map(col => ({
              ...col,
              render: (text: string) => (
                <div style={{ 
                  maxWidth: '100%', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  width: 'fit-content'
                }}>
                  {text}
                </div>
              ),
              ellipsis: true,
              width: 'auto'
            }))}
            pagination={false}
            scroll={{ x: 'max-content', y: 500 }}
            rowSelection={undefined}
            style={{ minWidth: '100%' }}
            size="small"
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="请选择要包含的列"
            value={selectedColumns}
            onChange={(values: string[]) => setSelectedColumns(values)}
            options={columns.map(col => ({
              label: col.title,
              value: col.key,
            }))}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ChatCsvPreview;