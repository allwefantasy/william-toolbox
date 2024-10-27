import React, { useCallback } from 'react';
import ReactFlow, { 
  Node,
  Edge,
  Background,
  Controls,
  Panel,
  NodeTypes,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, Typography, Button, Space } from 'antd';
import { CodeOutlined } from '@ant-design/icons';

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

const CustomNode = ({ data }: any) => {
  return (
    <Card 
      size="small" 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>{`${data.file_number}_chat_action.yml`}</Text>
          {data.timestamp && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {data.timestamp}
            </Text>
          )}
        </div>
      }
      extra={
        data.response && (
          <Button 
            icon={<CodeOutlined />} 
            type="link" 
            onClick={() => data.onShowDiff(data.response)}
          >
            查看变更
          </Button>
        )
      }
      style={{ maxWidth: 300 }}
    >
      <Text ellipsis={{ tooltip: data.query }}>
        {data.query.length > 100 ? `${data.query.slice(0, 100)}...` : data.query}
      </Text>
    </Card>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const WorkflowView: React.FC<WorkflowViewProps> = ({ queries, onShowDiff }) => {
  // Create nodes from queries
  const initialNodes: Node[] = queries.map((query, index) => ({
    id: query.file_number.toString(),
    type: 'custom',
    position: { x: 50, y: index * 150 },
    data: {
      ...query,
      onShowDiff
    },
  }));

  // Create edges connecting sequential nodes
  const initialEdges: Edge[] = queries.slice(0, -1).map((query, index) => ({
    id: `e${query.file_number}-${queries[index + 1].file_number}`,
    source: query.file_number.toString(),
    target: queries[index + 1].file_number.toString(),
    type: 'smoothstep',
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ height: '70vh', border: '1px solid #ddd', borderRadius: '4px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default WorkflowView;