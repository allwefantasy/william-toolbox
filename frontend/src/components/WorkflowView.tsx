import React, { useCallback } from 'react';
import 'reactflow/dist/style.css';
import ReactFlow, { 
  Node,
  Edge,
  Background,
  Controls,
  Panel,
  NodeTypes,
  useNodesState,
  useEdgesState,
  Position,
  MiniMap,
  useReactFlow,
  BackgroundVariant,
  ReactFlowProvider
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
// 优化的布局算法
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 320;
  const nodeHeight = 150;
  
  // 增大节点间距以优化展示
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: 100,  // 增加水平间距
    ranksep: 150,  // 增加垂直间距
    ranker: 'longest-path' // 使用最长路径算法优化布局
  });
  
  // 添加节点
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  
  // 添加边
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  // 计算布局
  dagre.layout(dagreGraph);
  
  // 应用计算后的位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      // 添加一些随机偏移量避免完全对齐
      position: {
        x: nodeWithPosition.x - nodeWidth / 2 + Math.random() * 20 - 10,
        y: nodeWithPosition.y - nodeHeight / 2 + Math.random() * 20 - 10,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: true, // 允许节点拖拽
    };
  });
  
  return { nodes: layoutedNodes, edges };
};

// Move the main component implementation into a separate component
const WorkflowViewContent: React.FC<WorkflowViewProps> = ({ queries, onShowDiff }) => {
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

  // 智能创建边 - 基于file_number顺序连接
  const initialEdges: Edge[] = [];
  for (let i = 0; i < sortedQueries.length - 1; i++) {
    const currentNode = sortedQueries[i];
    const nextNode = sortedQueries[i + 1];
    
    // 只有当file_number连续时才创建边
    // 不需要检查连续性，创建所有边
    initialEdges.push({
      id: `e${currentNode.file_number}-${nextNode.file_number}`,
      source: currentNode.file_number.toString(),
      target: nextNode.file_number.toString(),
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#1890ff', strokeWidth: 2 },
    });
  }

  // 使用dagre计算布局
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const { fitView } = useReactFlow();

  // 自适应画布
  const onInit = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  return (
    <div style={{ height: '70vh', border: '1px solid #ddd', borderRadius: '4px' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          onInit={onInit}
          minZoom={0.1}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
        <Background color="#aaa" gap={16} variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap 
          nodeColor="#1890ff"
          maskColor="rgb(0, 0, 0, 0.1)"
          style={{
            backgroundColor: '#fff',
            border: '1px solid #1890ff',
          }}
        />
        <Panel position="top-right">
          <Card size="small">
            <Text type="secondary">按照文件编号顺序自动布局,可拖拽调整位置</Text>
          </Card>
        </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

// Create a wrapper component that provides the ReactFlow context
const WorkflowView: React.FC<WorkflowViewProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowViewContent {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowView;