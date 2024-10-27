import React from 'react';
import { Card, Button, Typography, Space } from 'antd';
import { FolderOutlined, CodeOutlined } from '@ant-design/icons';
import ReactFlow, { 
  Controls, 
  Background,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

const { Text } = Typography;

interface Query {
  query: string;
  timestamp?: string;
  response?: string;
  urls?: string[];
  file_number: number;
}

interface WorkflowViewProps {
  queries: Query[];
  onShowDiff: (response: string | undefined) => void;
}

const WorkflowView: React.FC<WorkflowViewProps> = ({ queries, onShowDiff }) => {
  const nodes = queries.map((query, index) => ({
    id: `${query.file_number}`,
    position: { x: 50, y: index * 150 },
    data: {
      label: (
        <Card 
          size="small" 
          title={`${query.file_number}_chat_action.yml`}
          extra={
            query.response && (
              <Button 
                icon={<CodeOutlined />} 
                type="link"
                onClick={() => onShowDiff(query.response)}
              >
                查看变更
              </Button>
            )
          }
          style={{ width: 300 }}
        >
          <Text ellipsis={{ rows: 2 }}>{query.query}</Text>
          {query.timestamp && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {query.timestamp}
              </Text>
            </div>
          )}
        </Card>
      )
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const edges = queries.slice(0, -1).map((_, index) => ({
    id: `e${index}-${index + 1}`,
    source: `${queries[index].file_number}`,
    target: `${queries[index + 1].file_number}`,
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  }));

  return (
    <div style={{ height: '70vh', border: '1px solid #ddd', borderRadius: 4 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default WorkflowView;