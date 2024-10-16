import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 定义模型类型
interface Model {
  name: string;
  status: 'stopped' | 'running';
}

function App() {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleAction = async (modelName: string, action: 'start' | 'stop') => {
    try {
      await axios.post(`/models/${modelName}/${action}`);
      fetchModels(); // Refresh the model list after action
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
    }
  };

  return (
    <div className="App">
      <div className="sidebar">
        <h2>菜单</h2>
        <ul>
          <li>模型管理</li>
        </ul>
      </div>
      <div className="main-content">
        <h1>模型管理</h1>
        <table>
          <thead>
            <tr>
              <th>模型名称</th>
              <th>当前状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {models.map(model => (
              <tr key={model.name}>
                <td>{model.name}</td>
                <td>{model.status}</td>
                <td>
                  {model.status === 'stopped' && (
                    <button onClick={() => handleAction(model.name, 'start')}>启动</button>
                  )}
                  {model.status === 'running' && (
                    <button onClick={() => handleAction(model.name, 'stop')}>停止</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
