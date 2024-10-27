import React, { useCallback } from 'react';
import ReactFlow, { 
  Node,
  Edge,
  Background,
  Controls,
  Panel,
  NodeTypes,
  useNodesState,
  useEdgesState,
  Position
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Card, Typography, Button, Space, Tag } from 'antd';
import { CodeOutlined, NumberOutlined } from '@ant-design/icons';

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
          <Space>
            <Tag color="blue" icon={<NumberOutlined />}>
              #{data.file_number}
            </Tag>
            <Text strong>chat_action.yml</Text>
          </Space>
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
      style={{ 
        maxWidth: 300,
        border: '2px solid #1890ff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
      bodyStyle={{ backgroundColor: '#fafafa' }}
    >
      <Text ellipsis={{ tooltip: data.query }}>
        {data.query.length > 100 ? `${data.query.slice(0, 100)}...` : data.query}
      </Text>
      {data.urls && data.urls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Tag color="green">{data.urls.length} 个相关文件</Tag>
        </div>
      )}
    </Card>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// 使用dagre库进行布局计算
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 320;
  const nodeHeight = 150;
  
  // 设置图的布局方向和节点大小
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });
  
  // 添加节点到dagre图
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  
  // 添加边到dagre图
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  // 计算布局
  dagre.layout(dagreGraph);
  
  // 应用计算后的位置到节点
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
  
  return { nodes: layoutedNodes, edges };
};

const WorkflowView: React.FC<WorkflowViewProps> = ({ queries, onShowDiff }) => {
  // 按file_number排序
  const sortedQueries = [...queries].sort((a, b) => a.file_number - b.file_number);
  
  // 创建节点
  const initialNodes: Node[] = sortedQueries.map((query) => ({
    id: query.file_number.toString(),
    type: 'custom',
    position: { x: 0, y: 0 }, // 初始位置会被dagre重新计算
    data: {
      ...query,
      onShowDiff
    },
  }));

  // 创建边 - 按file_number的顺序连接
  const initialEdges: Edge[] = sortedQueries.slice(0, -1).map((query, index) => ({
    id: `e${query.file_number}-${sortedQueries[index + 1].file_number}`,
    source: query.file_number.toString(),
    target: sortedQueries[index + 1].file_number.toString(),
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#1890ff', strokeWidth: 2 },
  }));

  // 使用dagre计算布局
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  return (
    <div style={{ height: '70vh', border: '1px solid #ddd', borderRadius: '4px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <Panel position="top-right">
          <Card size="small">
            <Text type="secondary">按照文件编号顺序自动布局</Text>
          </Card>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default WorkflowView;