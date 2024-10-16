import React, { useState } from 'react';
import './App.css';

// 定义软件类型
interface Software {
  id: number;
  name: string;
  status: 'not installed' | 'stopped' | 'running';
}

function App() {
  // 模拟软件列表
  const [softwares, setSoftwares] = useState<Software[]>([
    { id: 1, name: 'Software A', status: 'not installed' },
    { id: 2, name: 'Software B', status: 'stopped' },
    { id: 3, name: 'Software C', status: 'running' },
  ]);

  // 处理安装
  const handleInstall = (id: number) => {
    setSoftwares(softwares.map(sw => 
      sw.id === id ? { ...sw, status: 'stopped' } : sw
    ));
  };

  // 处理启动
  const handleStart = (id: number) => {
    setSoftwares(softwares.map(sw => 
      sw.id === id ? { ...sw, status: 'running' } : sw
    ));
  };

  // 处理关闭
  const handleStop = (id: number) => {
    setSoftwares(softwares.map(sw => 
      sw.id === id ? { ...sw, status: 'stopped' } : sw
    ));
  };

  return (
    <div className="App">
      <div className="sidebar">
        <h2>菜单</h2>
        <ul>
          <li>软件管理</li>
          {/* 可以添加更多菜单项 */}
        </ul>
      </div>
      <div className="main-content">
        <h1>软件管理</h1>
        <table>
          <thead>
            <tr>
              <th>软件名称</th>
              <th>当前状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {softwares.map(software => (
              <tr key={software.id}>
                <td>{software.name}</td>
                <td>{software.status}</td>
                <td>
                  {software.status === 'not installed' && (
                    <button onClick={() => handleInstall(software.id)}>安装</button>
                  )}
                  {software.status === 'stopped' && (
                    <button onClick={() => handleStart(software.id)}>启动</button>
                  )}
                  {software.status === 'running' && (
                    <button onClick={() => handleStop(software.id)}>关闭</button>
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
